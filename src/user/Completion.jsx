import React, { useState } from "react";
import { supabase } from "../core/supabase/client";

export default function Completion({ navigate, template }) {
  const [loading, setLoading] = useState(false);
  const [publicUrl, setPublicUrl] = useState("");
  const [error, setError] = useState("");
  const isPremium = template === "birthday-premium";

  let surpriseData = {};

  try {
    surpriseData = JSON.parse(
      sessionStorage.getItem("surprizyy_draft") || "{}"
    );
  } catch {
    surpriseData = {};
  }

  const recipientName =
    surpriseData.recipientName || "Someone Special";

  const price = isPremium ? 499 : 299;

  async function generateSurprise() {
    setLoading(true);
    setError("");

    try {
      const generated = JSON.parse(
        sessionStorage.getItem("surprizyy_surprise") || "{}"
      );

      const { data, error: functionError } =
        await supabase.functions.invoke("generate-surprise", {
          body: {
            publicId: generated.publicId,
            managementToken: generated.managementToken,
          },
        });

      if (functionError || !data?.success || !data.publicUrl) {
        throw new Error(
          data?.error ||
            functionError?.message ||
            "Failed to generate your surprise."
        );
      }

      setPublicUrl(data.publicUrl);
      sessionStorage.setItem(
        "surprizyy_public_url",
        data.publicUrl
      );
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Failed to generate your surprise."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="completion-page">
      <section className="completion-card">
        <div className="completion-icon">
          ✓
        </div>

        <span className="completion-label">
          ✨ Almost ready
        </span>

        <h1>
          Your surprise is ready to go!
        </h1>

        <p>
          Everything looks perfect for{" "}
          <strong>{recipientName}</strong>.
          Generate it when you are ready to create the
          public link.
        </p>

        <div className="completion-summary">
          <div>
            <span>Template</span>
            <strong>
              {isPremium
                ? "Birthday Premium"
                : "Birthday Cute"}
            </strong>
          </div>

          <div>
            <span>Amount</span>
            <strong>₹{price}</strong>
          </div>
        </div>

        <div className="completion-note">
          <span>🔒</span>

          <p>
            Your photos and personal details stay private
            and will only be used to create your surprise.
          </p>
        </div>

        {error && (
          <p role="alert" className="completion-error">
            {error}
          </p>
        )}

        {publicUrl && (
          <div className="completion-public-link">
            <strong>Your surprise link is ready</strong>
            <a href={publicUrl} target="_blank" rel="noreferrer">
              {publicUrl}
            </a>
            <button
              type="button"
              className="completion-main-button"
              onClick={() => window.open(publicUrl, "_blank", "noopener,noreferrer")}
            >
              Open Surprise →
            </button>
          </div>
        )}

        {!publicUrl && (
          <button
            type="button"
            className="completion-main-button"
            disabled={loading}
            onClick={generateSurprise}
          >
            {loading ? "Generating..." : "Generate Surprise →"}
          </button>
        )}

        <button
          type="button"
          className="completion-home-button"
          onClick={() =>
            navigate(
              `/create/birthday/${template}/final-preview`
            )
          }
        >
          ← Back to Final Preview
        </button>

        <button
          type="button"
          className="completion-home-button"
          onClick={() => navigate("/")}
        >
          Back to Home
        </button>
      </section>
    </main>
  );
}