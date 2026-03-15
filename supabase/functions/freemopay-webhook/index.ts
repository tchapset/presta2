import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("FreeMoPay webhook received:", JSON.stringify(body));

    const { reference, status, externalId, amount, transactionType } = body;

    if (!reference || !status) {
      return new Response(JSON.stringify({ error: "Invalid webhook payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if this is a withdrawal callback (externalId starts with "withdraw-")
    if (externalId && externalId.startsWith("withdraw-")) {
      const transferId = externalId.split("-")[1];
      
      const { data: transfer } = await supabase
        .from("mobile_money_transfers")
        .select("*")
        .eq("id", transferId)
        .single();

      if (!transfer) {
        console.error("Transfer not found for externalId:", externalId);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (status === "SUCCESS") {
        await supabase
          .from("mobile_money_transfers")
          .update({
            status: "completed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", transferId);

        // Update transaction status
        const { data: wallet } = await supabase
          .from("wallets")
          .select("id")
          .eq("user_id", transfer.user_id)
          .single();

        if (wallet) {
          await supabase
            .from("transactions")
            .update({ status: "completed" })
            .eq("wallet_id", wallet.id)
            .eq("status", "pending")
            .like("description", `Retrait%${transfer.phone}%`);
        }

        // Notify user
        await supabase.from("notifications").insert({
          user_id: transfer.user_id,
          title: "Retrait effectué ✅",
          message: `Votre retrait de ${transfer.amount.toLocaleString()} FCFA vers ${transfer.phone} a été envoyé avec succès.`,
          type: "payment",
          link: "/portefeuille",
        });

        // Send push notification
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")!}/functions/v1/send-push-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            },
            body: JSON.stringify({
              user_id: transfer.user_id,
              title: "Retrait effectué ✅",
              body: `${transfer.amount.toLocaleString()} FCFA envoyés vers ${transfer.phone}`,
              url: "/portefeuille",
            }),
          });
        } catch {}
      } else if (status === "FAILED") {
        // Refund wallet
        const { data: wallet } = await supabase
          .from("wallets")
          .select("id, balance")
          .eq("user_id", transfer.user_id)
          .single();

        if (wallet) {
          await supabase
            .from("wallets")
            .update({ balance: (wallet.balance || 0) + transfer.amount })
            .eq("id", wallet.id);

          await supabase
            .from("transactions")
            .update({ status: "failed" })
            .eq("wallet_id", wallet.id)
            .eq("status", "pending")
            .like("description", `Retrait%${transfer.phone}%`);
        }

        await supabase
          .from("mobile_money_transfers")
          .update({
            status: "failed",
            error_message: body.message || "Échec du retrait",
            processed_at: new Date().toISOString(),
          })
          .eq("id", transferId);

        await supabase.from("notifications").insert({
          user_id: transfer.user_id,
          title: "Retrait échoué ❌",
          message: `Votre retrait de ${transfer.amount.toLocaleString()} FCFA a échoué. Le montant a été recrédité.`,
          type: "payment",
          link: "/portefeuille",
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- ESCROW PAYMENT CALLBACK (original logic) ---
    const { data: escrow, error: findErr } = await supabase
      .from("escrow_payments")
      .select("*")
      .eq("freemopay_reference", reference)
      .single();

    if (findErr || !escrow) {
      console.error("Escrow not found for reference:", reference);
      return new Response(JSON.stringify({ error: "Escrow not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (status === "SUCCESS") {
      await supabase
        .from("escrow_payments")
        .update({
          status: "held",
          callback_received_at: new Date().toISOString(),
        })
        .eq("id", escrow.id);

      await supabase
        .from("missions")
        .update({ status: "in_progress" })
        .eq("id", escrow.mission_id);

      const { data: mission } = await supabase
        .from("missions")
        .select("client_id, provider_id, title")
        .eq("id", escrow.mission_id)
        .single();

      if (mission) {
        const notifications = [
          {
            user_id: mission.client_id,
            title: "Paiement confirmé",
            message: `Votre paiement de ${escrow.amount.toLocaleString()} FCFA pour "${mission.title}" est sécurisé en escrow.`,
            type: "payment",
            link: `/mission/${escrow.mission_id}`,
          },
        ];
        if (mission.provider_id) {
          notifications.push({
            user_id: mission.provider_id,
            title: "Paiement reçu en escrow",
            message: `Le client a payé ${escrow.amount.toLocaleString()} FCFA pour "${mission.title}". Vous pouvez commencer le travail.`,
            type: "payment",
            link: `/mission/${escrow.mission_id}`,
          });
        }
        await supabase.from("notifications").insert(notifications);
      }
    } else if (status === "FAILED") {
      await supabase
        .from("escrow_payments")
        .update({
          status: "failed",
          callback_received_at: new Date().toISOString(),
        })
        .eq("id", escrow.id);

      const { data: mission } = await supabase
        .from("missions")
        .select("client_id, title")
        .eq("id", escrow.mission_id)
        .single();

      if (mission) {
        await supabase.from("notifications").insert({
          user_id: mission.client_id,
          title: "Paiement échoué",
          message: `Le paiement pour "${mission.title}" a échoué. Veuillez réessayer.`,
          type: "payment",
          link: `/mission/${escrow.mission_id}`,
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
