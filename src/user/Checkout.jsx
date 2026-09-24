import React from "react";
import { supabase } from "../core/supabase/client";

export default function Checkout({ navigate, template }) {
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

  async function handlePayment() {
    if (!templateVersionId) {
      alert("Template version is missing. Please go back and select the template again.");
      return;
    }

    const paymentMode =
      import.meta.env.VITE_PAYMENT_MODE === "bypass"
        ? "bypass"
        : "razorpay";

    const { data, error } = await supabase.functions.invoke(
      "verify-payment",
      {
        body: {
          templateVersionId,
          customerEmail: surpriseData.customerEmail || null,
          paymentMode,
        },
      }
    );

    if (error || !data?.success || !data.payment?.id) {
      alert(data?.error || error?.message || "Payment verification failed.");
      return;
    }

    sessionStorage.setItem(
      "surprizyy_checkout",
      JSON.stringify({
        template,
        paymentId: data.payment.id,
        templateVersionId,
        amount: data.payment.amount,
        currency: data.payment.currency,
        paymentStatus: "verified",
      })
    );

    navigate(`/create/birthday/${template}/memories`);
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

          <div>
            <span>Service</span>
            <span>Included</span>
          </div>

          <hr />

          <div className="checkout-total">
            <strong>Total</strong>
            <strong>₹{price}</strong>
          </div>
        </div>

        <button
  type="button"
  className="checkout-pay-button"
  onClick={handlePayment}
>
  Continue to Payment →
</button>
      </section>
    </main>
  );
}