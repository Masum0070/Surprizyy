import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

async function createRazorpayOrder(amount: number, receipt: string) {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are not configured");
  }

  if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) {
    throw new Error("Invalid Razorpay Key ID format");
  }

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt,
      payment_capture: 1,
    }),
  });
  const result = await response.json();

  if (!response.ok || !result?.id) {
    console.error("Razorpay order creation failed:", result);
    throw new Error("Unable to create Razorpay order");
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const templateVersionId = clean(body?.templateVersionId);
    const customerName = clean(body?.customerName) || null;
    const customerEmail = clean(body?.customerEmail) || null;
    const nonRefundableAccepted = body?.nonRefundableAccepted === true;

    if (!nonRefundableAccepted) {
      return json({ success: false, error: "Non-refundable payment acknowledgement is required" }, 400);
    }

    if (!templateVersionId) {
      return json({ success: false, error: "Template version is required" }, 400);
    }

    const { data: version, error: versionError } = await supabase
      .from("template_versions")
      .select("id, template_id")
      .eq("id", templateVersionId)
      .eq("is_active", true)
      .maybeSingle();
    if (versionError) throw versionError;
    if (!version) return json({ success: false, error: "Invalid or inactive template version" }, 400);

    const { data: template, error: templateError } = await supabase
      .from("templates")
      .select("id, base_price")
      .eq("id", version.template_id)
      .eq("is_active", true)
      .maybeSingle();
    if (templateError) throw templateError;
    if (!template) return json({ success: false, error: "Template is not available" }, 400);

    const amount = Number(template.base_price);
    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ success: false, error: "Invalid template price" }, 400);
    }

    const order = await createRazorpayOrder(amount, `surprizyy_${crypto.randomUUID()}`);
    const { data: payment, error: paymentError } = await supabase
      .from("payment_orders")
      .insert({
        provider: "razorpay",
        provider_order_id: order.id,
        template_version_id: templateVersionId,
        amount,
        currency: "INR",
        status: "created",
        customer_name: customerName,
        customer_email: customerEmail,
        non_refundable_accepted: true,
        non_refundable_accepted_at: new Date().toISOString(),
        non_refundable_policy_version: "2026-09-25",
        metadata: { razorpay_order: order },
      })
      .select("id, amount, currency, status, provider_order_id")
      .single();
    if (paymentError) throw paymentError;

    return json({
      success: true,
      keyId: Deno.env.get("RAZORPAY_KEY_ID"),
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      payment,
    });
  } catch (error) {
    console.error("create-razorpay-order error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to start payment",
    }, 500);
  }
});
