import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Decode JWT directly to get user ID without calling getUser()
    const token = authHeader.replace("Bearer ", "");
    let userId: string;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      userId = payload.sub;
      if (!userId) throw new Error("No user ID in token");
    } catch {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { escrow_id, action } = body;

    if (!escrow_id || !action) {
      return new Response(JSON.stringify({ error: "escrow_id and action required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: escrow, error: escrowErr } = await serviceClient
      .from("escrow_payments")
      .select("*, missions!inner(client_id, provider_id, title, status)")
      .eq("id", escrow_id)
      .single();

    if (escrowErr || !escrow) {
      return new Response(JSON.stringify({ error: "Escrow not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mission = (escrow as any).missions;

    // --- PROVIDER MARKS COMPLETE ---
    if (action === "provider_complete") {
      if (userId !== mission.provider_id) {
        return new Response(JSON.stringify({ error: "Only provider can mark complete" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (escrow.status !== "held") {
        return new Response(JSON.stringify({ error: "Escrow not in held state" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const autoReleaseAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      await serviceClient
        .from("escrow_payments")
        .update({ status: "provider_completed", auto_release_at: autoReleaseAt })
        .eq("id", escrow_id);

      await serviceClient
        .from("missions")
        .update({ provider_confirmed_at: new Date().toISOString() })
        .eq("id", escrow.mission_id);

      await serviceClient.from("notifications").insert({
        user_id: mission.client_id,
        title: "Travail terminé",
        message: `Le prestataire a terminé "${mission.title}". Vérifiez et confirmez dans les 48h, sinon les fonds seront libérés automatiquement.`,
        type: "payment",
        link: `/mission/${escrow.mission_id}`,
      });

      return new Response(
        JSON.stringify({ success: true, auto_release_at: autoReleaseAt }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- CLIENT CONFIRMS ---
    if (action === "client_confirm") {
      if (userId !== mission.client_id) {
        return new Response(JSON.stringify({ error: "Only client can confirm" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!["held", "provider_completed"].includes(escrow.status)) {
        return new Response(JSON.stringify({ error: "Cannot confirm in current state" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const now = new Date().toISOString();

      await serviceClient
        .from("escrow_payments")
        .update({ status: "released", released_at: now })
        .eq("id", escrow_id);

      await serviceClient
        .from("missions")
        .update({ client_confirmed_at: now, status: "completed", completed_at: now })
        .eq("id", escrow.mission_id);

      if (mission.provider_id) {
        // Credit wallet
        const { data: wallet } = await serviceClient
          .from("wallets")
          .select("id, balance")
          .eq("user_id", mission.provider_id)
          .single();

        if (wallet) {
          await serviceClient
            .from("wallets")
            .update({ balance: (wallet.balance || 0) + escrow.provider_amount })
            .eq("id", wallet.id);

          await serviceClient.from("transactions").insert({
            wallet_id: wallet.id,
            amount: escrow.provider_amount,
            type: "escrow_release",
            description: `Paiement mission "${mission.title}" (commission ${escrow.commission_rate}%)`,
            mission_id: escrow.mission_id,
            status: "completed",
          });
        }

        await serviceClient.from("notifications").insert({
          user_id: mission.provider_id,
          title: "Paiement reçu ! 💰",
          message: `${escrow.provider_amount.toLocaleString()} FCFA crédités dans votre portefeuille pour "${mission.title}". Vous pouvez demander un retrait depuis votre portefeuille.`,
          type: "payment",
          link: `/portefeuille`,
        });
      }

      return new Response(
        JSON.stringify({ success: true, message: "Escrow released" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- CLIENT OPENS DISPUTE ---
    if (action === "client_dispute") {
      if (userId !== mission.client_id) {
        return new Response(JSON.stringify({ error: "Only client can dispute" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { reason, evidence_urls } = body;

      await serviceClient
        .from("escrow_payments")
        .update({
          status: "disputed",
          dispute_reason: reason || "Travail non conforme",
          dispute_evidence_urls: evidence_urls || [],
        })
        .eq("id", escrow_id);

      await serviceClient
        .from("missions")
        .update({ status: "disputed" })
        .eq("id", escrow.mission_id);

      if (mission.provider_id) {
        await serviceClient.from("notifications").insert({
          user_id: mission.provider_id,
          title: "Litige ouvert",
          message: `Le client a ouvert un litige pour "${mission.title}". L'escrow est bloqué en attendant la médiation.`,
          type: "dispute",
          link: `/mission/${escrow.mission_id}`,
        });
      }

      return new Response(
        JSON.stringify({ success: true, message: "Dispute opened" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- ADMIN RESOLVES DISPUTE ---
    if (action === "admin_resolve") {
      const { data: isAdmin } = await serviceClient.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });

      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { resolution, note } = body;
      const now = new Date().toISOString();

      if (resolution === "refund_client") {
        await serviceClient
          .from("escrow_payments")
          .update({ status: "refunded", refunded_at: now, admin_resolution: resolution, admin_resolution_note: note })
          .eq("id", escrow_id);

        const { data: clientWallet } = await serviceClient
          .from("wallets")
          .select("id, balance")
          .eq("user_id", mission.client_id)
          .single();

        if (clientWallet) {
          await serviceClient.from("wallets").update({ balance: (clientWallet.balance || 0) + escrow.amount }).eq("id", clientWallet.id);
          await serviceClient.from("transactions").insert({
            wallet_id: clientWallet.id, amount: escrow.amount, type: "refund",
            description: `Remboursement litige "${mission.title}"`, mission_id: escrow.mission_id, status: "completed",
          });
        }
      } else if (resolution === "release_provider") {
        await serviceClient
          .from("escrow_payments")
          .update({ status: "released", released_at: now, admin_resolution: resolution, admin_resolution_note: note })
          .eq("id", escrow_id);

        if (mission.provider_id) {
          const { data: provWallet } = await serviceClient
            .from("wallets")
            .select("id, balance")
            .eq("user_id", mission.provider_id)
            .single();

          if (provWallet) {
            await serviceClient.from("wallets").update({ balance: (provWallet.balance || 0) + escrow.provider_amount }).eq("id", provWallet.id);
            await serviceClient.from("transactions").insert({
              wallet_id: provWallet.id, amount: escrow.provider_amount, type: "escrow_release",
              description: `Libération litige "${mission.title}" (commission ${escrow.commission_rate}%)`, mission_id: escrow.mission_id, status: "completed",
            });
          }

          await serviceClient.from("notifications").insert({
            user_id: mission.provider_id,
            title: "Paiement reçu ! 💰",
            message: `${escrow.provider_amount.toLocaleString()} FCFA crédités dans votre portefeuille pour "${mission.title}".`,
            type: "payment",
            link: `/portefeuille`,
          });
        }
      } else if (resolution === "partial_refund") {
        const halfAmount = Math.round(escrow.amount / 2);
        const reducedCommission = Math.round(halfAmount * 5 / 100);
        const providerHalf = halfAmount - reducedCommission;

        await serviceClient
          .from("escrow_payments")
          .update({ status: "partially_refunded", released_at: now, admin_resolution: resolution, admin_resolution_note: note })
          .eq("id", escrow_id);

        const { data: clientWallet } = await serviceClient
          .from("wallets")
          .select("id, balance")
          .eq("user_id", mission.client_id)
          .single();

        if (clientWallet) {
          await serviceClient.from("wallets").update({ balance: (clientWallet.balance || 0) + halfAmount }).eq("id", clientWallet.id);
          await serviceClient.from("transactions").insert({
            wallet_id: clientWallet.id, amount: halfAmount, type: "refund",
            description: `Remboursement partiel litige "${mission.title}"`, mission_id: escrow.mission_id, status: "completed",
          });
        }

        if (mission.provider_id) {
          const { data: provWallet } = await serviceClient
            .from("wallets")
            .select("id, balance")
            .eq("user_id", mission.provider_id)
            .single();

          if (provWallet) {
            await serviceClient.from("wallets").update({ balance: (provWallet.balance || 0) + providerHalf }).eq("id", provWallet.id);
            await serviceClient.from("transactions").insert({
              wallet_id: provWallet.id, amount: providerHalf, type: "escrow_release",
              description: `Libération partielle litige "${mission.title}" (commission réduite 5%)`, mission_id: escrow.mission_id, status: "completed",
            });
          }
        }
      }

      await serviceClient
        .from("missions")
        .update({ status: resolution === "release_provider" ? "completed" : "cancelled", completed_at: now })
        .eq("id", escrow.mission_id);

      return new Response(
        JSON.stringify({ success: true, resolution }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Escrow release error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
