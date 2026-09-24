import React, { useState } from "react";
import { supabase } from "../core/supabase/client";

export default function Memories({ navigate, template }) {
  const [photos, setPhotos] = useState([]);

  let checkoutData = {};

  try {
    checkoutData = JSON.parse(
      sessionStorage.getItem("surprizyy_checkout") || "{}"
    );
  } catch {
    checkoutData = {};
  }

  const paymentVerified =
    checkoutData.paymentStatus === "verified" &&
    checkoutData.paymentId &&
    checkoutData.templateVersionId;

  function handlePhotoUpload(event) {
  if (!paymentVerified) {
    alert("Payment verification is required before uploading memories.");
    event.target.value = "";
    return;
  }

  const files = Array.from(event.target.files || []);

    const newPhotos = files.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      name: file.name,
      file,
      url: URL.createObjectURL(file),
    }));

    setPhotos((current) => {
      const combined = [...current, ...newPhotos];
      return combined.slice(0, 9);
    });

    event.target.value = "";
  }

  function removePhoto(id) {
    setPhotos((current) => {
      const photo = current.find((item) => item.id === id);

      if (photo?.url) {
        URL.revokeObjectURL(photo.url);
      }

      return current.filter((item) => item.id !== id);
    });
  }

  async function handleContinue() {
    if (!paymentVerified || photos.length === 0) return;

    let created = null;
    try {
      const existing = JSON.parse(
        sessionStorage.getItem("surprizyy_surprise") || "null"
      );
      created = existing?.publicId && existing?.managementToken
        ? existing
        : null;
    } catch {
      created = null;
    }

    if (!created) {
      const draft = JSON.parse(
        sessionStorage.getItem("surprizyy_draft") || "{}"
      );
      const { data, error } = await supabase.functions.invoke(
        "create-surprise",
        {
          body: {
            templateVersionId: checkoutData.templateVersionId,
            paymentId: checkoutData.paymentId,
            values: {
              recipient_name: draft.recipientName,
              customer_email: draft.customerEmail,
              customer_phone: draft.customerPhone,
              special_message: draft.message,
            },
          },
        }
      );

      if (error || !data?.success) {
        alert(data?.error || error?.message || "Failed to create your surprise.");
        return;
      }

      created = data;
      sessionStorage.setItem(
        "surprizyy_surprise",
        JSON.stringify(created)
      );
    }

    const formData = new FormData();
    formData.append("surpriseId", created.surpriseId);
    formData.append("managementToken", created.managementToken);
    photos.forEach((photo) => {
      if (photo.file) formData.append("files", photo.file, photo.name);
    });

    if (photos.some((photo) => photo.file)) {
      const { data, error } = await supabase.functions.invoke(
        "upload-surprise-media",
        { body: formData }
      );
      if (error || !data?.success) {
        alert(data?.error || error?.message || "Failed to upload memories.");
        return;
      }
    }

    sessionStorage.setItem(
  "surprizyy_memory_count",
  String(photos.length)
);

sessionStorage.setItem(
  "surprizyy_memory_previews",
  JSON.stringify(
    photos.map((photo) => ({
      id: photo.id,
      name: photo.name,
      url: photo.url,
    }))
  )
);

    navigate(
      `/create/birthday/${template}/final-preview`
    );
  }

    if (!paymentVerified) {
    return (
      <main className="memories-page">
        <section className="memories-card">
          <h1>Payment verification required</h1>

          <p>
            Please complete checkout before uploading your memories.
          </p>

          <button
            type="button"
            className="memories-continue-button"
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

  return (
    <main className="memories-page">
      <button
        type="button"
        className="back-button"
        onClick={() =>
          navigate(
            `/create/birthday/${template}/checkout`
          )
        }
      >
        ← Back
      </button>

      <section className="memories-header">
        <span>📸 Your Memories</span>

        <h1>Add the moments that matter.</h1>

        <p>
          Upload multiple photos and turn your favorite
          memories into part of the surprise.
        </p>
      </section>

      <section className="memories-card">
        <div className="memory-upload-area">
          <div className="memory-upload-icon">
            📷
          </div>

          <h2>Upload your memories</h2>

          <p>
            Select multiple photos at once.
            <br />
            Maximum 9 photos.
          </p>

          <label className="memory-upload-button">
            + Choose Photos

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={handlePhotoUpload}
            />
          </label>
        </div>

        <div className="memory-progress">
          <div>
            <span>Memories</span>
            <strong>{photos.length}/9</strong>
          </div>

          <div className="memory-progress-bar">
            <span
              style={{
                width: `${(photos.length / 9) * 100}%`,
              }}
            />
          </div>
        </div>

        {photos.length > 0 && (
          <section className="memory-gallery">
            <div className="memory-gallery-header">
              <div>
                <span>Your photos</span>
                <h2>Little moments</h2>
              </div>

              {photos.length < 9 && (
                <label className="memory-add-more">
                  + Add more

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    hidden
                    onChange={handlePhotoUpload}
                  />
                </label>
              )}
            </div>

            <div className="memory-photo-grid">
              {photos.map((photo, index) => (
                <article
                  className="memory-photo-card"
                  key={photo.id}
                >
                  <div className="memory-photo-image">
                    <img
                      src={photo.url}
                      alt={`Memory ${index + 1}`}
                    />

                    <button
                      type="button"
                      className="memory-remove-button"
                      onClick={() =>
                        removePhoto(photo.id)
                      }
                    >
                      ×
                    </button>

                    <span className="memory-number">
                      {index + 1}
                    </span>
                  </div>

                  <div className="memory-photo-info">
                    <strong>
                      Memory {index + 1}
                    </strong>

                    <small>
                      {photo.name}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {photos.length === 0 && (
          <div className="memory-empty-state">
            <span>🖼️</span>

            <h3>No memories added yet</h3>

            <p>
              Your selected photos will appear here.
            </p>
          </div>
        )}

        <button
          type="button"
          className="memories-continue-button"
          disabled={photos.length === 0}
          onClick={handleContinue}
        >
          Continue to Final Preview →
        </button>
      </section>
    </main>
  );
}