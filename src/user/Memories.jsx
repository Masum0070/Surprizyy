import React, { useEffect, useState } from "react";
import { supabase } from "../core/supabase/client";
import { compressImage } from "../core/imageCompression";
import {
  clearPendingMedia,
  getPendingMedia,
} from "../core/pendingMedia";

export default function Memories({ navigate, template }) {
  const [photos, setPhotos] = useState([]);
  const [compressingPhotos, setCompressingPhotos] = useState(false);
  const [sections, setSections] = useState([]);
  const [fieldValues, setFieldValues] = useState({});
  const [musicOptions, setMusicOptions] = useState([]);
  const [formError, setFormError] = useState("");

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

  let draftData = {};
  try {
    draftData = JSON.parse(
      sessionStorage.getItem("surprizyy_draft") || "{}"
    );
  } catch {
    draftData = {};
  }

  useEffect(() => {
    let active = true;

    async function loadFields() {
      const { data, error } = await supabase.functions.invoke("public-form", {
        body: {
          template_version_id: checkoutData.templateVersionId,
        },
      });

      if (!active) return;

      if (error || !data?.success) {
        const { data: directSections, error: directError } = await supabase
          .from("form_sections")
          .select("id, title, description, sort_order, is_active")
          .eq("template_version_id", checkoutData.templateVersionId)
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        if (directError) {
          setFormError(
            error?.message ||
              data?.error ||
              directError.message ||
              "Failed to load your form."
          );
          return;
        }

        const sectionIds = (directSections || []).map((section) => section.id);
        const { data: directFields, error: fieldsError } = sectionIds.length
          ? await supabase
              .from("form_fields")
              .select("*")
              .in("section_id", sectionIds)
              .eq("is_active", true)
              .order("sort_order", { ascending: true })
          : { data: [], error: null };

        if (fieldsError) {
          setFormError(fieldsError.message);
          return;
        }

        setSections(
          (directSections || []).map((section) => ({
            ...section,
            fields: (directFields || []).filter(
              (field) => field.section_id === section.id
            ),
          }))
        );
        setFieldValues(draftData.formValues || {});
        return;
      }

      const loadedSections = Array.isArray(data.sections) ? data.sections : [];
      setSections(loadedSections);
      setFieldValues(draftData.formValues || {});
    }

    if (paymentVerified) {
      loadFields();
    }

    return () => {
      active = false;
    };
  }, [checkoutData.templateVersionId, paymentVerified]);

  const maxPhotos = (() => {
    const rawLimit = Number(
      draftData.photoLimit ||
      sessionStorage.getItem("surprizyy_memory_limit") ||
      "9"
    );

    return Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 9;
  })();

  const prePaymentFieldKeys = new Set([
    "recipient_name",
    "customer_email",
    "customer_phone",
    "recipientName",
    "customerEmail",
    "customerPhone",
    "mobile_number",
    "phone",
  ]);

  React.useEffect(() => {
    let active = true;

    async function loadPendingPhotos() {
      try {
        const pendingMedia = await getPendingMedia();

        if (!active || pendingMedia.length === 0) {
          return;
        }

        const restoredPhotos = pendingMedia.map((item) => ({
          id: item.id,
          fieldKey: item.fieldKey,
          name: item.file.name,
          file: item.file,
          url: URL.createObjectURL(item.file),
        }));

        setPhotos(restoredPhotos.slice(0, maxPhotos));
      } catch (error) {
        console.error("Failed to restore selected photos:", error);
      }
    }

    loadPendingPhotos();

    return () => {
      active = false;
    };
  }, [maxPhotos]);

  useEffect(() => {
    let active = true;

    async function loadMusicOptions() {
      const musicFields = sections.flatMap((section) => section.fields || [])
        .filter((field) => ["music", "song"].includes(field.field_type));

      if (!musicFields.length) {
        setMusicOptions([]);
        return;
      }

      const { data, error } = await supabase.functions.invoke("public-music");

      if (!active) return;

      if (error || !data?.success) {
        setFormError(error?.message || data?.error || "Failed to load songs.");
        return;
      }

      setMusicOptions(Array.isArray(data.songs) ? data.songs : []);
    }

    loadMusicOptions();

    return () => {
      active = false;
    };
  }, [sections]);

  async function handlePhotoUpload(event, fieldKey = "memory_photos", limit = maxPhotos) {
    if (!paymentVerified) {
      alert("Payment verification is required before uploading memories.");
      event.target.value = "";
      return;
    }

    const files = Array.from(event.target.files || []);
    const fieldPhotos = photos.filter((photo) => photo.fieldKey === fieldKey);
    const remainingSlots = Math.max(limit - fieldPhotos.length, 0);

    if (remainingSlots <= 0) {
      alert(`You can upload up to ${limit} photos for this field.`);
      event.target.value = "";
      return;
    }

    const selectedFiles = files.slice(0, remainingSlots);

    setCompressingPhotos(true);

    let compressedFiles;
    try {
      compressedFiles = await Promise.all(
        selectedFiles.map((file) => compressImage(file))
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "One of the photos could not be converted."
      );
      event.target.value = "";
      setCompressingPhotos(false);
      return;
    }

    const newPhotos = compressedFiles.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      fieldKey,
      name: file.name,
      file,
      url: URL.createObjectURL(file),
    }));

    setPhotos((current) => {
      const otherPhotos = current.filter((photo) => photo.fieldKey !== fieldKey);
      const currentFieldPhotos = current.filter(
        (photo) => photo.fieldKey === fieldKey
      );
      return [
        ...otherPhotos,
        ...currentFieldPhotos,
        ...newPhotos,
      ].filter((photo) => photo.fieldKey !== fieldKey)
        .concat([...currentFieldPhotos, ...newPhotos].slice(0, limit));
    });

    event.target.value = "";
    setCompressingPhotos(false);
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
    if (!paymentVerified) return;

    setFormError("");

    for (const section of sections) {
      for (const field of section.fields || []) {
        if (
          field.required &&
          !prePaymentFieldKeys.has(field.field_key) &&
          !["file", "image", "images"].includes(field.field_type) &&
          !String(fieldValues[field.field_key] || "").trim()
        ) {
          setFormError(`${field.label || "This field"} is required.`);
          return;
        }
      }
    }

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
      const normalizedValues = {
        ...fieldValues,
        recipient_name: draft.recipientName,
        customer_email: draft.customerEmail,
        customer_phone: draft.customerPhone,
        special_message:
          fieldValues.special_message ||
          Object.values(fieldValues).find(
            (value) => typeof value === "string" && value.trim()
          ) ||
          "",
      };
      const { data, error } = await supabase.functions.invoke(
        "create-surprise",
        {
          body: {
            templateVersionId: checkoutData.templateVersionId,
            paymentId: checkoutData.paymentId,
            values: normalizedValues,
          },
        }
      );

      if (error || !data?.success) {
        let message =
          data?.error ||
          error?.message ||
          "Failed to create your surprise.";

        if (error?.context) {
          try {
            const responseBody = await error.context.text();
            const parsedBody = JSON.parse(responseBody);
            message = parsedBody?.error || message;
          } catch {
            // Keep the original Supabase error when the response is not JSON.
          }
        }

        setFormError(message);
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
    formData.append(
      "fieldKey",
      draftData.photoFields?.[0]?.fieldKey || "memory_photos"
    );
    photos.forEach((photo) => {
      if (photo.file) {
        formData.append("files", photo.file, photo.name);
        formData.append("fieldKeys", photo.fieldKey || "memory_photos");
      }
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

    await clearPendingMedia();

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
        <span>✨ Complete your surprise</span>

        <h1>Tell us everything we need.</h1>

        <p>
          Complete the sections created by the admin, including messages and
          your photo album.
        </p>
      </section>

      <section className="memories-card">
        {sections.map((section) => {
          const postPaymentFields = (section.fields || []).filter(
            (field) => !prePaymentFieldKeys.has(field.field_key)
          );

          if (postPaymentFields.length === 0) {
            return null;
          }

          return (
          <section key={section.id} className="dynamic-form-section">
            {section.title && <h2>{section.title}</h2>}
            {section.description && <p>{section.description}</p>}

            {postPaymentFields
              .map((field) => {
                const isPhotoField = ["file", "image", "images"].includes(
                  field.field_type
                );
                const fieldLimit = Math.max(1, Number(field.max_files) || 1);
                const value = fieldValues[field.field_key] || "";
                const update = (nextValue) =>
                  setFieldValues((current) => ({
                    ...current,
                    [field.field_key]: nextValue,
                  }));

                if (isPhotoField) {
                  const fieldPhotos = photos.filter(
                    (photo) => photo.fieldKey === field.field_key
                  );

                  return (
                    <div className="form-field" key={field.id}>
                      <label>
                        {field.label}
                        {field.required && " *"}
                      </label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple={field.field_type === "images" || fieldLimit > 1}
                        onChange={(event) =>
                          handlePhotoUpload(
                            event,
                            field.field_key,
                            fieldLimit
                          )
                        }
                        disabled={compressingPhotos || fieldPhotos.length >= fieldLimit}
                      />
                      <small>
                        {fieldPhotos.length}/{fieldLimit} photos selected.
                        Photos are converted to JPEG under 100 KB.
                      </small>
                    </div>
                  );
                }

                return (
                  <div className="form-field" key={field.id}>
                    <label htmlFor={`post-payment-${field.field_key}`}>
                      {field.label}
                      {field.required && " *"}
                    </label>
                    {["music", "song"].includes(field.field_type) ? (
                      <select
                        id={`post-payment-${field.field_key}`}
                        value={value}
                        onChange={(event) => update(event.target.value)}
                      >
                        <option value="">Choose a song...</option>
                        {musicOptions.map((song) => (
                          <option key={song.value} value={song.value}>
                            {song.label}
                          </option>
                        ))}
                      </select>
                    ) : field.field_type === "textarea" ? (
                      <textarea
                        id={`post-payment-${field.field_key}`}
                        rows="5"
                        value={value}
                        placeholder={field.placeholder || ""}
                        onChange={(event) => update(event.target.value)}
                      />
                    ) : field.field_type === "select" ? (
                      <select
                        id={`post-payment-${field.field_key}`}
                        value={value}
                        onChange={(event) => update(event.target.value)}
                      >
                        <option value="">Select...</option>
                        {(Array.isArray(field.options)
                          ? field.options
                          : []
                        ).map((option) => (
                          <option key={String(option)} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`post-payment-${field.field_key}`}
                        type={field.field_type || "text"}
                        value={value}
                        placeholder={field.placeholder || ""}
                        onChange={(event) => update(event.target.value)}
                      />
                    )}
                  </div>
                );
              })}
          </section>
          );
        })}

        {formError && <div className="admin-error">{formError}</div>}

        {sections.length === 0 && !formError && (
          <p>Loading your post-payment form...</p>
        )}

        {photos.length > 0 && (
          <section className="memory-gallery">
            <div className="memory-gallery-header">
              <div>
                <span>Your photos</span>
                <h2>Little moments</h2>
              </div>

              <span>{photos.length} photo{photos.length === 1 ? "" : "s"} selected</span>
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