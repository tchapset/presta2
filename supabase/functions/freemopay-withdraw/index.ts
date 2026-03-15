import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FREEMOPAY_BASE = "https://api-v2.freemopay.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const appKey = Deno.env.get("FREEMOPAY_APP_KEY");
    const secretKey = Deno.env.get("FREEMOPAY_SECRET_KEY");
    if (!appKey || !secretKey) {
      throw new Error("FreeMoPay credentials not configured");
    }

    const body = await req.json();
    const { transfer_id } = body;

    if (!transfer_id) {
      return new Response(JSON.stringify({ error: "transfer_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the transfer record
    const { data: transfer, error: transferErr } = await supabase
      .from("mobile_money_transfers")
      .select("*")
      .eq("id", transfer_id)
      .single();

    if (transferErr || !transfer) {
      return new Response(JSON.stringify({ error: "Transfer not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (transfer.status !== "pending") {
      return new Response(JSON.stringify({ error: "Transfer already processed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build Basic Auth
    const basicAuth = btoa(`${appKey}:${secretKey}`);
    const callbackUrl = `${Deno.env.get("SUPABASE_URL")!}/functions/v1/freemopay-webhook`;
    const externalId = `withdraw-${transfer_id}-${Date.now()}`;

    // Call FreeMoPay direct-withdraw API
    const res = await fetch(`${FREEMOPAY_BASE}/api/v2/payment/direct-withdraw`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        receiver: transfer.phone,
        amount: String(transfer.amount),
        externalId,
        callback: callbackUrl,
      }),
    });

    const data = await res.json();
    console.log("FreeMoPay withdraw response:", JSON.stringify(data));

    if (!res.ok || data.status === "FAILED") {
      // Refund the wallet
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
      }

      await supabase
        .from("mobile_money_transfers")
        .update({
          status: "failed",
          error_message: data.message || "Échec du retrait",
          processed_at: new Date().toISOString(),
        })
        .eq("id", transfer_id);

      // Update transaction
      await supabase
        .from("transactions")
        .update({ status: "failed" })
        .eq("description", `Retrait ${(transfer.operator || "").toUpperCase()} vers ${transfer.phone}`)
        .eq("wallet_id", wallet?.id || "")
        .eq("status", "pending");

      // Notify user
      await supabase.from("notifications").insert({
        user_id: transfer.user_id,
        title: "Retrait échoué",
        message: `Votre retrait de ${transfer.amount.toLocaleString()} FCFA a échoué. Le montant a été recrédité à votre portefeuille.`,
        type: "payment",
        link: "/portefeuille",
      });

      return new Response(JSON.stringify({ success: false, error: data.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update transfer with reference - status stays pending until callback confirms
    await supabase
      .from("mobile_money_transfers")
      .update({
        status: "processing",
        admin_note: `FreeMoPay ref: ${data.reference}`,
      })
      .eq("id", transfer_id);

    return new Response(
      JSON.stringify({
        success: true,
        reference: data.reference,
        message: "Retrait en cours de traitement",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Withdraw error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
