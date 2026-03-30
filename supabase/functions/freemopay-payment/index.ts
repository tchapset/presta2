import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FREEMOPAY_BASE = "https://api-v2.freemopay.com";

async function getFreemoToken(): Promise<string> {
  const appKey = Deno.env.get("FREEMOPAY_APP_KEY");
  const secretKey = Deno.env.get("FREEMOPAY_SECRET_KEY");
  if (!appKey || !secretKey) throw new Error("FreeMoPay credentials not configured");

  const res = await fetch(`${FREEMOPAY_BASE}/api/v2/payment/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appKey, secretKey }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`FreeMoPay token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // --- INIT ESCROW PAYMENT ---
    if (req.method === "POST" && path === "freemopay-payment") {
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

      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userId = authUser.id;

      const body = await req.json();
      const { mission_id, amount, payer_phone, operator } = body;

      if (!mission_id || !amount || !payer_phone) {
        return new Response(
          JSON.stringify({ error: "mission_id, amount, payer_phone requis" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Verify user is the client of this mission
      const { data: mission, error: missionErr } = await serviceClient
        .from("missions")
        .select("client_id, provider_id, status")
        .eq("id", mission_id)
        .single();

      if (missionErr || !mission) {
        return new Response(JSON.stringify({ error: "Mission introuvable" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (mission.client_id !== userId) {
        return new Response(JSON.stringify({ error: "Seul le client peut payer" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const commissionRate = 6;
      const commissionAmount = Math.round(amount * commissionRate / 100);
      const providerAmount = amount - commissionAmount;
      const externalId = `escrow-${mission_id}-${Date.now()}`;

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const callbackUrl = `${supabaseUrl}/functions/v1/freemopay-webhook`;

      // Get FreeMoPay token and init payment
      let freemoToken: string;
      try {
        freemoToken = await getFreemoToken();
      } catch (e: any) {
        return new Response(
          JSON.stringify({ error: `Erreur connexion FreeMoPay: ${e.message}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const paymentPayload: any = {
        payer: payer_phone,
        amount: String(amount),
        externalId,
        description: `Paiement escrow mission PRESTA237`,
        callback: callbackUrl,
      };
      if (operator) paymentPayload.operator = operator;

      const paymentRes = await fetch(`${FREEMOPAY_BASE}/api/v2/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${freemoToken}`,
        },
        body: JSON.stringify(paymentPayload),
      });

      const paymentData = await paymentRes.json();
      console.log("FreeMoPay response:", JSON.stringify(paymentData));

      if (!paymentRes.ok || paymentData.status === "FAILED") {
        const errMsg = paymentData.message || paymentData.error || "Échec de l'initiation du paiement. Vérifiez votre numéro et votre solde.";
        return new Response(
          JSON.stringify({ error: errMsg }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create escrow record
      const { data: escrow, error: escrowErr } = await serviceClient
        .from("escrow_payments")
        .insert({
          mission_id,
          payer_id: userId,
          amount,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          provider_amount: providerAmount,
          freemopay_reference: paymentData.reference,
          external_id: externalId,
          status: "pending",
          payer_phone,
        })
        .select()
        .single();

      if (escrowErr) {
        return new Response(
          JSON.stringify({ error: "Erreur création escrow", details: escrowErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await serviceClient
        .from("missions")
        .update({ total_amount: amount, deposit_amount: amount })
        .eq("id", mission_id);

      return new Response(
        JSON.stringify({
          success: true,
          escrow_id: escrow.id,
          freemopay_reference: paymentData.reference,
          message: "Paiement initié. Validez sur votre téléphone.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- ACHETER DES CREDITS ---
    if (req.method === "POST" && path === "freemopay-payment" && req.url.includes("buy-credits")) {
      // handled below via action param
    }

    const body2 = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    
    // --- ACHETER DES CREDITS (action=buy_credits) ---
    if (req.method === "POST" && body2?.action === "buy_credits") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { payer_phone, operator, credits_pack } = body2;
      // Packs: 10 credits = 500 FCFA, 25 credits = 1000 FCFA, 50 credits = 1800 FCFA
      const packs: Record<string, { credits: number; amount: number }> = {
        "10": { credits: 10, amount: 500 },
        "25": { credits: 25, amount: 1000 },
        "50": { credits: 50, amount: 1800 },
      };
      const pack = packs[String(credits_pack)];
      if (!pack) {
        return new Response(JSON.stringify({ error: "Pack invalide" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const externalId = `credits-${authUser.id}-${Date.now()}`;
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const callbackUrl = `${supabaseUrl}/functions/v1/freemopay-webhook`;

      let freemoToken: string;
      try {
        freemoToken = await getFreemoToken();
      } catch (e: any) {
        return new Response(
          JSON.stringify({ error: `Erreur connexion FreeMoPay: ${e.message}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const paymentPayload: any = {
        payer: payer_phone,
        amount: String(pack.amount),
        externalId,
        description: `Achat ${pack.credits} crédits PRESTA237`,
        callback: callbackUrl,
      };
      if (operator) paymentPayload.operator = operator;

      const paymentRes = await fetch(`${FREEMOPAY_BASE}/api/v2/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${freemoToken}`,
        },
        body: JSON.stringify(paymentPayload),
      });
      const paymentData = await paymentRes.json();

      if (!paymentRes.ok || paymentData.status === "FAILED") {
        const errMsg = paymentData.message || "Échec du paiement. Vérifiez votre numéro et solde.";
        return new Response(JSON.stringify({ error: errMsg }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Store pending credit purchase
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await serviceClient.from("credit_transactions").insert({
        user_id: authUser.id,
        amount: pack.credits,
        type: "purchase",
        description: `Achat ${pack.credits} crédits - ${pack.amount} FCFA - ref:${paymentData.reference} - PENDING`,
      });

      return new Response(JSON.stringify({
        success: true,
        reference: paymentData.reference,
        message: `Paiement de ${pack.amount} FCFA initié. Validez sur votre téléphone.`,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- CHECK PAYMENT STATUS ---
    if (req.method === "GET") {
      const reference = url.searchParams.get("reference");
      if (!reference) {
        return new Response(JSON.stringify({ error: "reference required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const freemoToken = await getFreemoToken();
      const statusRes = await fetch(`${FREEMOPAY_BASE}/api/v2/payment/${reference}`, {
        headers: { Authorization: `Bearer ${freemoToken}` },
      });
      const statusData = await statusRes.json();
      return new Response(JSON.stringify(statusData), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("FreeMoPay payment error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
