import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getPublicOrigin(req: Request) {
  const configuredUrl = Deno.env.get("PUBLIC_APP_URL")?.trim();
  const requestOrigin = req.headers.get("origin")?.trim();
  const origin = configuredUrl || requestOrigin;

  if (!origin) {
    return null;
  }

  try {
    const parsed = new URL(origin);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const publicId = typeof body?.publicId === "string" ? body.publicId.trim() : "";
    const managementToken = typeof body?.managementToken === "string" ? body.managementToken.trim() : "";
    if (!publicId || !managementToken) {
      return json({ success: false, error: "Surprise ID and management token are required" }, 400);
    }

    const { data: surprise, error: findError } = await supabase
      .from("surprises")
      .select("id, public_id, status, expires_at, payment_id")
      .eq("public_id", publicId)
      .eq("management_token_hash", await hashToken(managementToken))
      .maybeSingle();
    if (findError) throw findError;
    if (!surprise) return json({ success: false, error: "Invalid surprise credentials" }, 401);
    if (surprise.status !== "draft") return json({ success: false, error: "Surprise is not ready to generate" }, 409);
    if (!surprise.payment_id) {
      return json({ success: false, error: "Verified payment is required" }, 402);
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payment_orders")
      .select("status")
      .eq("id", surprise.payment_id)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment || payment.status !== "verified") {
      return json({ success: false, error: "Payment is not verified" }, 402);
    }

    if (surprise.expires_at && new Date(surprise.expires_at).getTime() <= Date.now()) {
      return json({ success: false, error: "Surprise has expired" }, 410);
    }

    const origin = getPublicOrigin(req);

    if (!origin) {
      return json(
        {
          success: false,
          error: "Public app URL is not configured",
        },
        500
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("surprises")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", surprise.id)
      .eq("status", "draft")
      .select("public_id, status, published_at, expires_at")
      .single();
    if (updateError) throw updateError;

    return json({
      success: true,
      surprise: updated,
      publicUrl: `${origin}/surprise/${updated.public_id}`,
    });
  } catch (error) {
    console.error("generate-surprise error:", error);
    return json({ success: false, error: "Failed to generate surprise" }, 500);
  }
});
