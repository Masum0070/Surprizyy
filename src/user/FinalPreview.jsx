import React, { useState } from "react";

export default function FinalPreview({ navigate, template }) {
  let checkoutData = {};
  let surpriseData = {};

  try {
    checkoutData = JSON.parse(
      sessionStorage.getItem("surprizyy_checkout") || "{}"
    );

    surpriseData = JSON.parse(
      sessionStorage.getItem("surprizyy_draft") || "{}"
    );
  } catch {
    checkoutData = {};
    surpriseData = {};
  }

  const paymentVerified =
    checkoutData.paymentStatus === "verified" &&
    checkoutData.paymentId &&
    checkoutData.templateVersionId;

  const memoryCount = Number(
  sessionStorage.getItem("surprizyy_memory_count") || "0"
);

const [photos, setPhotos] = useState(() => {
  try {
    return JSON.parse(
      sessionStorage.getItem(
        "surprizyy_memory_previews"
      ) || "[]"
    );
  } catch {
    return [];
  }
});
    

  if (!paymentVerified) {
    return (
      <main className="final-preview-page">
        <section className="final-preview-card">
          <h1>Payment verification required</h1>

          <p>
            Please complete checkout before continuing.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate(
                `/create/birthday/${template}/checkout`
              )
            }
          >
            Back to Checkout →
          </button>
        </section>
      </main>
    );
  }

  if (memoryCount === 0) {
    return (
      <main className="final-preview-page">
        <section className="final-preview-card">
          <h1>Add your memories first</h1>

          <p>
            Please add at least one photo before viewing
            the final preview.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate(
                `/create/birthday/${template}/memories`
              )
            }
          >
            Add Memories →
          </button>
        </section>
      </main>
    );
  }
  


  const recipientName =
    surpriseData.recipientName || "Someone Special";

  const message =
    surpriseData.message ||
    "Wishing you the happiest birthday!";

  const isPremium = template === "birthday-premium";

  function loadPhotos(event) {
  const files = Array.from(event.target.files || []);

  const previews = files.map((file) => ({
    id: `${file.name}-${file.lastModified}-${Math.random()}`,
    url: URL.createObjectURL(file),
  }));

  setPhotos((current) => {
    return [...current, ...previews].slice(0, 9);
  });

  event.target.value = "";
}

  return (
    <main className="final-preview-page">
      <button
        type="button"
        className="back-button"
        onClick={() => {
  console.log("Looks Perfect clicked");
  console.log("template:", template);
  console.log(
    "checkout:",
    sessionStorage.getItem("surprizyy_checkout")
  );
  console.log(
    "draft:",
    sessionStorage.getItem("surprizyy_draft")
  );
  navigate(`/create/birthday/${template}/complete`);
}}
      >
        ← Back
      </button>

      <section className="final-preview-header">
        <span>✨ Final Preview</span>

        <h1>
          This is how your surprise will feel.
        </h1>

        <p>
          Take one last look before we prepare the final
          experience.
        </p>
      </section>

      <section className="final-surprise">
        <div className="birthday-cover">
          <span className="birthday-sparkle">✨</span>

          <span className="birthday-small">
            A surprise made especially for
          </span>

          <h2>{recipientName}</h2>

          <div className="birthday-cake">
            🎂
          </div>

          <h3>Happy Birthday!</h3>

          <p>{message}</p>

          <div className="birthday-template">
            {isPremium
              ? "Birthday Premium"
              : "Birthday Cute"}
          </div>
        </div>

        <div className="final-memory-section">
          <div className="final-memory-heading">
            <div>
              <span>Your memories</span>
              <h2>Little moments</h2>
            </div>

            {photos.length < 9 && (
  <label className="final-add-button">
    + Add
    <input
      type="file"
      accept="image/*"
      multiple
      onChange={loadPhotos}
      hidden
    />
  </label>
)}
          </div>

          {photos.length > 0 ? (
            <div className="final-photo-grid">
              {photos.map((photo, index) => (
                <div
                  className="final-photo"
                  key={photo.id}
                >
                  <img
                    src={photo.url}
                    alt={`Memory ${index + 1}`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="final-empty-memory">
              📸
              <span>
                Your uploaded memories will appear here.
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="final-actions">
        <button
          type="button"
          className="final-edit-button"
          onClick={() =>
            navigate(`/create/birthday/${template}/memories`)
          }
        >
          ← Edit Memories
        </button>

        <button
          type="button"
          className="final-continue-button"
          onClick={() =>
            navigate(`/create/birthday/${template}/complete`)
          }
        >
          Looks Perfect →
        </button>
      </section>
    </main>
  );
}