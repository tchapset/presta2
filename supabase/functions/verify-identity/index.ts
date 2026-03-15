import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase config missing");

    // Get auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { verification_id } = await req.json();
    if (!verification_id) throw new Error("Missing verification_id");

    // Get the verification request
    const { data: verReq, error: verErr } = await supabaseAdmin
      .from("verification_requests")
      .select("*")
      .eq("id", verification_id)
      .eq("user_id", user.id)
      .single();

    if (verErr || !verReq) throw new Error("Verification request not found");
    if (verReq.status !== "pending") throw new Error("Already processed");

    // Download both images from storage
    const [idDoc, selfie] = await Promise.all([
      supabaseAdmin.storage.from("verification-docs").download(verReq.id_document_url),
      supabaseAdmin.storage.from("verification-docs").download(verReq.selfie_url),
    ]);

    if (idDoc.error || selfie.error) throw new Error("Failed to download verification images");

    // Convert to base64
    const idBase64 = btoa(String.fromCharCode(...new Uint8Array(await idDoc.data.arrayBuffer())));
    const selfieBase64 = btoa(String.fromCharCode(...new Uint8Array(await selfie.data.arrayBuffer())));

    const idMime = verReq.id_document_url.endsWith(".png") ? "image/png" : "image/jpeg";
    const selfieMime = verReq.selfie_url.endsWith(".png") ? "image/png" : "image/jpeg";

    // Call OpenAI GPT-4o Vision to compare the two images
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an identity verification system. You compare two images:
1. An ID document (passport, national ID card, or driver's license)
2. A selfie of a person holding the same ID document

Your task is to determine if the person in the selfie matches the person on the ID document.

Respond ONLY with a JSON object using this exact format:
{"match": true/false, "confidence": 0-100, "reason": "brief explanation"}

Be strict but fair. Look for:
- Face similarity between the ID photo and the selfie person
- The ID document being visible in the selfie
- Signs of photo manipulation

If the images are unclear or you cannot make a determination, set match to false with a clear reason.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Compare these two images. Image 1 is the ID document. Image 2 is the selfie with the ID." },
              { type: "image_url", image_url: { url: `data:${idMime};base64,${idBase64}` } },
              { type: "image_url", image_url: { url: `data:${selfieMime};base64,${selfieBase64}` } },
            ],
          },
        ],
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`OpenAI API error: ${aiResponse.status} - ${errText}`);
    }

    const aiData = await aiResponse.json();
    const resultText = aiData.choices?.[0]?.message?.content;
    if (!resultText) throw new Error("No response from AI");

    let result: { match: boolean; confidence: number; reason: string };
    try {
      result = JSON.parse(resultText);
    } catch {
      throw new Error("Invalid AI response format");
    }

    // Update verification request based on AI result
    const newStatus = result.match && result.confidence >= 70 ? "approved" : "rejected";

    const { error: updateErr } = await supabaseAdmin
      .from("verification_requests")
      .update({
        status: newStatus,
        ai_confidence: result.confidence,
        ai_reason: result.reason,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", verification_id);

    if (updateErr) throw new Error("Failed to update verification status");

    // If approved, update user profile
    if (newStatus === "approved") {
      await supabaseAdmin
        .from("profiles")
        .update({ is_verified: true })
        .eq("id", user.id);
    }

    return new Response(
      JSON.stringify({ success: true, status: newStatus, confidence: result.confidence, reason: result.reason }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("verify-identity error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
