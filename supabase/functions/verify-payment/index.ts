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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function razorpaySignatureIsValid(orderId: string, paymentId: string, signature: string) {
  const secret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!secret) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${orderId}|${paymentId}`)
  );
  const expected = Array.from(new Uint8Array(signed))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return expected === signature;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const templateVersionId = clean(body?.templateVersionId);
    const customerEmail = clean(body?.customerEmail) || null;
    const paymentMode = clean(body?.paymentMode);

    if (!templateVersionId) {
      return json({ success: false, error: "Template version is required" }, 400);
    }

    const { data: version, error: versionError } = await supabase
      .from("template_versions")
      .select("id, template_id, is_active")
      .eq("id", templateVersionId)
      .eq("is_active", true)
      .maybeSingle();
    if (versionError) throw versionError;
    if (!version) return json({ success: false, error: "Invalid or inactive template version" }, 400);

    const { data: template, error: templateError } = await supabase
      .from("templates")
      .select("id, base_price, is_active")
      .eq("id", version.template_id)
      .eq("is_active", true)
      .maybeSingle();
    if (templateError) throw templateError;
    if (!template) return json({ success: false, error: "Template is not available" }, 400);

    const amount = Number(template.base_price);
    let provider = "razorpay";
    let providerOrderId = clean(body?.razorpayOrderId) || null;
    let providerPaymentId = clean(body?.razorpayPaymentId) || null;

    const bypassEnabled = Deno.env.get("DEV_PAYMENT_BYPASS_ENABLED") === "true";
    if (paymentMode === "bypass") {
      if (!bypassEnabled) {
        return json({ success: false, error: "Development payment bypass is disabled" }, 403);
      }
      provider = "development";
      providerOrderId = `dev_order_${crypto.randomUUID()}`;
      providerPaymentId = `dev_payment_${crypto.randomUUID()}`;
    } else {
      const signature = clean(body?.razorpaySignature);
      if (!providerOrderId || !providerPaymentId || !signature) {
        return json({ success: false, error: "Razorpay verification details are required" }, 400);
      }
      if (!(await razorpaySignatureIsValid(providerOrderId, providerPaymentId, signature))) {
        return json({ success: false, error: "Payment signature verification failed" }, 402);
      }
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payment_orders")
      .insert({
        provider,
        provider_order_id: providerOrderId,
        provider_payment_id: providerPaymentId,
        template_version_id: templateVersionId,
        amount,
        currency: "INR",
        status: "verified",
        customer_email: customerEmail,
        verified_at: new Date().toISOString(),
      })
      .select("id, amount, currency, status")
      .single();
    if (paymentError) throw paymentError;

    return json({ success: true, payment });
  } catch (error) {
    console.error("verify-payment error:", error);
    return json({ success: false, error: "Payment verification failed" }, 500);
  }
});
