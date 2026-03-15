import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();
    const { data: expired, error } = await supabase
      .from("escrow_payments")
      .select("*, missions!inner(client_id, provider_id, title)")
      .eq("status", "provider_completed")
      .lt("auto_release_at", now);

    if (error) throw error;
    if (!expired || expired.length === 0) {
      return new Response(JSON.stringify({ released: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let released = 0;
    for (const escrow of expired) {
      const mission = (escrow as any).missions;

      await supabase
        .from("escrow_payments")
        .update({ status: "released", released_at: now })
        .eq("id", escrow.id);

      await supabase
        .from("missions")
        .update({ status: "completed", completed_at: now, client_confirmed_at: now })
        .eq("id", escrow.mission_id);

      if (mission.provider_id) {
        // Get provider phone
        const { data: profile } = await supabase
          .from("profiles")
          .select("mobile_money_phone, phone")
          .eq("user_id", mission.provider_id)
          .single();

        const momoPhone = profile?.mobile_money_phone || profile?.phone || "";

        // Credit wallet
        const { data: wallet } = await supabase
          .from("wallets")
          .select("id, balance")
          .eq("user_id", mission.provider_id)
          .single();

        if (wallet) {
          await supabase
            .from("wallets")
            .update({ balance: (wallet.balance || 0) + escrow.provider_amount })
            .eq("id", wallet.id);

          await supabase.from("transactions").insert({
            wallet_id: wallet.id,
            amount: escrow.provider_amount,
            type: "escrow_release",
            description: `Auto-libération après 48h - "${mission.title}"`,
            mission_id: escrow.mission_id,
            status: "completed",
          });
        }

        // Record transfer for admin processing
        await supabase.from("mobile_money_transfers").insert({
          user_id: mission.provider_id,
          mission_id: escrow.mission_id,
          escrow_id: escrow.id,
          amount: escrow.provider_amount,
          phone: momoPhone,
          status: "pending",
        });

        await supabase.from("notifications").insert([
          {
            user_id: mission.provider_id,
            title: "Paiement auto-libéré 💰",
            message: `${escrow.provider_amount.toLocaleString()} FCFA crédités pour "${mission.title}". Le transfert Mobile Money sera effectué sous peu.`,
            type: "payment",
            link: `/mission/${escrow.mission_id}`,
          },
          {
            user_id: mission.client_id,
            title: "Paiement auto-libéré",
            message: `Le paiement pour "${mission.title}" a été libéré automatiquement après 48h.`,
            type: "payment",
            link: `/mission/${escrow.mission_id}`,
          },
        ]);
      }

      released++;
    }

    return new Response(JSON.stringify({ released }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Auto-release error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
