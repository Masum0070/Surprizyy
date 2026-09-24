import React from "react";

export default function SurprisePreview({ navigate, template }) {
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
    surpriseData.recipientName || "Someone special";

  const message =
    surpriseData.message ||
    "A little surprise made especially for someone special.";

  const templateVersionId =
    surpriseData.templateVersionId || null;

  return (
    <main className="surprise-preview-page">
      <button
        type="button"
        className="back-button"
        onClick={() =>
          navigate(`/create/birthday/${template}`)
        }
      >
        ← Back
      </button>

      <section className="preview-header">
        <span>👀 Preview</span>

        <h1>Your surprise is taking shape.</h1>

        <p>
          Here's a preview of the experience your recipient will see.
        </p>
      </section>

      <section className="preview-layout">
        <div className="preview-device">
          <div className="preview-screen">
            <span className="preview-heart">♥</span>

            <h2>Happy Birthday, {recipientName}!</h2>

            <p>{message}</p>

            <div className="preview-album">
              <span>📸</span>
              <span>💌</span>
              <span>✨</span>
            </div>

            <small>
              {isPremium
                ? "Birthday Premium"
                : "Birthday Cute"}
            </small>
          </div>
        </div>

        <div className="preview-details">
          <div>
            <span className="preview-label">
              Selected template
            </span>

            <h2>
              {isPremium
                ? "Birthday Premium"
                : "Birthday Cute"}
            </h2>
          </div>

          <div className="preview-features">
            <div>📖 Interactive surprise experience</div>
            <div>📸 Memory photos</div>
            <div>💌 Personal message</div>
            <div>🎵 Special moments & animations</div>
          </div>

          <button
            type="button"
            className="preview-continue-button"
            onClick={() => {
              if (!templateVersionId) {
                return;
              }

              navigate(
                `/create/birthday/${template}/checkout`
              );
            }}
          >
            Continue →
          </button>

          <button
            type="button"
            className="preview-edit-button"
            onClick={() =>
              navigate(`/create/birthday/${template}`)
            }
          >
            Edit Details
          </button>
        </div>
      </section>
    </main>
  );
}