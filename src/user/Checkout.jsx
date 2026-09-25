import React, { useEffect, useState } from "react";
import { supabase } from "../core/supabase/client";

export default function Checkout({ navigate, template }) {
  const [loading, setLoading] = useState(false);
  const [nonRefundableAccepted, setNonRefundableAccepted] = useState(false);
  const isPremium = template === "birthday-premium";
  const price = isPremium ? 499 : 299;
  const title = isPremium ? "Birthday Premium" : "Birthday Cute";

  let surpriseData = {};

  try {
    surpriseData = JSON.parse(
      sessionStorage.getItem("surprizyy_draft") || "{}"
    );
  } catch {
    surpriseData = {};
  }

  const templateVersionId =
    surpriseData.templateVersionId || null;

  async function getFunctionError(data, error, fallback) {
    if (data?.error) {
      return data.error;
    }

    if (error?.context) {
      try {
        const body = await error.context.clone().json();
        if (body?.error) {
          return body.error;
        }
      } catch {
        // Fall through to the Supabase error message.
      }
    }

    return error?.message || fallback;
  }

  useEffect(() => {
    if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
      return undefined;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  function saveVerifiedPayment(payment, paymentId) {
    sessionStorage.setItem(
      "surprizyy_checkout",
      JSON.stringify({
        template,
        paymentId: payment.id,
        providerPaymentId: paymentId || null,
        templateVersionId,
        amount: payment.amount,
        currency: payment.currency,
        paymentStatus: "verified",
      })
    );
    navigate(`/create/birthday/${template}/memories`);
  }

  async function handlePayment() {
    if (!nonRefundableAccepted) {
      alert("Please confirm that this payment is non-refundable.");
      return;
    }

    if (!templateVersionId) {
      alert("Template version is missing. Please go back and select the template again.");
      return;
    }

    const paymentMode = "razorpay";

    setLoading(true);

    try {
      if (!window.Razorpay) {
        throw new Error("Razorpay checkout is still loading. Please try again.");
      }

      const { data: orderData, error: orderError } =
        await supabase.functions.invoke("create-razorpay-order", {
          body: {
            templateVersionId,
            customerName: surpriseData.recipientName || null,
            customerEmail: surpriseData.customerEmail || null,
            nonRefundableAccepted: true,
          },
        });

      if (orderError || !orderData?.success || !orderData.order?.id || !orderData.keyId) {
          throw new Error(
            await getFunctionError(
              orderData,
              orderError,
              "Unable to start Razorpay checkout."
            )
          );
        }

      await new Promise((resolve, reject) => {
        const razorpay = new window.Razorpay({
          key: orderData.keyId,
          amount: orderData.order.amount,
          currency: orderData.order.currency,
          name: "Surprizyy",
          description: isPremium ? "Birthday Premium Surprise" : "Birthday Cute Surprise",
          order_id: orderData.order.id,
          prefill: {
            email: surpriseData.customerEmail || "",
            contact: surpriseData.customerPhone || "",
          },
          theme: { color: "#d85b91" },
          handler: async (response) => {
            try {
              const { data, error } = await supabase.functions.invoke(
                "verify-payment",
                {
                  body: {
                    templateVersionId,
                    customerName: surpriseData.recipientName || null,
                    customerEmail: surpriseData.customerEmail || null,
                    nonRefundableAccepted: true,
                    paymentMode,
                    razorpayOrderId: response.razorpay_order_id,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpaySignature: response.razorpay_signature,
                  },
                }
              );

              if (error || !data?.success || !data.payment?.id) {
                reject(new Error(
                  await getFunctionError(
                    data,
                    error,
                    "Payment verification failed."
                  )
                ));
                return;
              }

              saveVerifiedPayment(data.payment, response.razorpay_payment_id);
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          modal: {
            ondismiss: () => reject(new Error("Payment window was closed.")),
          },
        });
        razorpay.open();
      });
    } catch (paymentError) {
      alert(paymentError instanceof Error ? paymentError.message : "Payment failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="checkout-page">
      <button
        type="button"
        className="back-button"
        onClick={() =>
          navigate(
            `/create/birthday/${template}/preview`
          )
        }
      >
        ← Back
      </button>

      <section className="checkout-header">
        <span>💳 Checkout</span>

        <h1>Almost there.</h1>

        <p>
          Review your surprise details before continuing
          to payment.
        </p>
      </section>

      <section className="checkout-card">
        <div className="checkout-template">
          <div>
            <span>Selected template</span>
            <h2>{title}</h2>
          </div>

          <strong>₹{price}</strong>
        </div>

        <div className="checkout-section">
          <h3>Your details</h3>

          <div className="checkout-field">
            <label>Your name</label>
            <input
              type="text"
              value={surpriseData.recipientName || ""}
              readOnly
            />
          </div>

          <div className="checkout-field">
            <label>Email address</label>
            <input
              type="email"
              value={surpriseData.customerEmail || ""}
              readOnly
            />
          </div>

          <div className="checkout-field">
            <label>WhatsApp number</label>
            <input
              type="tel"
              value={surpriseData.customerPhone || ""}
              readOnly
            />
          </div>
        </div>

        <div className="checkout-summary">
          <div>
            <span>Template</span>
            <span>₹{price}</span>
          </div>

          <hr />

          <div className="checkout-total">
            <strong>Total</strong>
            <strong>₹{price}</strong>
          </div>

          <label className="checkout-non-refundable">
            <input
              type="checkbox"
              checked={nonRefundableAccepted}
              onChange={(event) =>
                setNonRefundableAccepted(event.target.checked)
              }
            />
            <span>I understand that this payment is non-refundable.</span>
          </label>
        </div>

        <button
          type="button"
          className="checkout-pay-button"
          disabled={loading || !nonRefundableAccepted}
          onClick={handlePayment}
        >
          {loading ? "Opening payment..." : "Continue to Payment →"}
        </button>
      </section>
    </main>
  );
}