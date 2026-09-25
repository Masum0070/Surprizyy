import { useEffect, useState } from "react";
export default function SurpriseForm({
  navigate,
  template,
  templateVersionId,
}) {
  const [recipientName, setRecipientName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [formError, setFormError] = useState("");

  async function handleContinue(event) {
    event.preventDefault();
    setFormError("");

    if (!recipientName.trim() || !customerEmail.trim()) {
      setFormError("Please add the recipient name and your email.");
      return;
    }

    const normalizedPhone = customerPhone.replace(/\D/g, "");

    if (normalizedPhone && normalizedPhone.length !== 10) {
      setFormError("WhatsApp number must contain exactly 10 digits.");
      return;
    }

    const surpriseData = {
      recipientName: recipientName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: normalizedPhone,
      templateVersionId,
      template,
    };

    sessionStorage.removeItem("surprizyy_checkout");
    sessionStorage.removeItem("surprizyy_surprise");
    sessionStorage.removeItem("surprizyy_public_url");
    sessionStorage.removeItem("surprizyy_memory_count");
    sessionStorage.removeItem("surprizyy_memory_previews");
    sessionStorage.setItem("surprizyy_draft", JSON.stringify(surpriseData));

    navigate(`/create/birthday/${template}/preview`);
  }

  return (
    <main className="surprise-form-page">
      <button
        type="button"
        className="back-button"
        onClick={() => navigate("/create/birthday")}
      >
        ← Back
      </button>

      <section className="surprise-form-header">
        <span>✨ Personalize your surprise</span>

        <h1>Let's make it personal.</h1>

        <p>
          Tell us a little about the person who is ordering.
        </p>
      </section>

      <form className="surprise-form-card" onSubmit={handleContinue}>
        <div className="form-field">
          <label htmlFor="recipientName">Your name</label>
          <input
            id="recipientName"
            type="text"
            value={recipientName}
            onChange={(event) => setRecipientName(event.target.value)}
            placeholder="Enter your name"
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="customerEmail">Your email</label>
          <input
            id="customerEmail"
            type="email"
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="customerPhone">WhatsApp number</label>
          <input
            id="customerPhone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            pattern="[0-9]{10}"
            value={customerPhone}
            onChange={(event) =>
              setCustomerPhone(
                event.target.value.replace(/\D/g, "").slice(0, 10)
              )
            }
            placeholder="10-digit WhatsApp number"
          />
        </div>

        {formError && <div className="admin-error">{formError}</div>}

        <button type="submit" className="form-continue-button">
          Continue to Preview →
        </button>
      </form>
    </main>
  );
}