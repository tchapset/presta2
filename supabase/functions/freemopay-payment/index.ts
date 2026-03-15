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

    // --- INIT PAYMENT ---
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

      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !claims?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userId = claims.claims.sub as string;

      const body = await req.json();
      const { mission_id, amount, payer_phone } = body;

      if (!mission_id || !amount || !payer_phone) {
        return new Response(
          JSON.stringify({ error: "mission_id, amount, payer_phone required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify user is the client of this mission
      const { data: mission, error: missionErr } = await supabase
        .from("missions")
        .select("client_id, provider_id, status")
        .eq("id", mission_id)
        .single();

      if (missionErr || !mission) {
        return new Response(JSON.stringify({ error: "Mission not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (mission.client_id !== userId) {
        return new Response(JSON.stringify({ error: "Only the client can pay" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const commissionRate = 10;
      const commissionAmount = Math.round(amount * commissionRate / 100);
      const providerAmount = amount - commissionAmount;
      const externalId = `escrow-${mission_id}-${Date.now()}`;

      // Webhook callback URL
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const callbackUrl = `${supabaseUrl}/functions/v1/freemopay-webhook`;

      // Get FreeMoPay token and init payment
      const freemoToken = await getFreemoToken();

      const paymentRes = await fetch(`${FREEMOPAY_BASE}/api/v2/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${freemoToken}`,
        },
        body: JSON.stringify({
          payer: payer_phone,
          amount: String(amount),
          externalId,
          description: `Paiement escrow mission Serviko`,
          callback: callbackUrl,
        }),
      });

      const paymentData = await paymentRes.json();

      if (!paymentRes.ok || paymentData.status === "FAILED") {
        return new Response(
          JSON.stringify({ error: "Payment init failed", details: paymentData }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create escrow record
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

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
          JSON.stringify({ error: "Failed to create escrow record", details: escrowErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update mission with total_amount
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
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
