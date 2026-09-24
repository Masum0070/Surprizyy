import { useState } from "react";
import { supabase } from "../core/supabase/client";
import "./ManageSurprise.css";

function ManageSurprise() {
  const [publicId, setPublicId] = useState("");
  const [managementToken, setManagementToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setResult(null);

    if (!publicId.trim() || !managementToken.trim()) {
      setError("Please enter your Surprise ID and Management Token.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: functionError } =
        await supabase.functions.invoke("manage-surprise", {
          body: {
            publicId: publicId.trim(),
            managementToken: managementToken.trim(),
          },
        });

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (!data?.success) {
        throw new Error(
          data?.error || "Invalid Surprise ID or Management Token."
        );
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  function getValue(item) {
    if (item.value_text != null) return item.value_text;
    if (item.value_number != null) return item.value_number;
    if (item.value_boolean != null) {
      return item.value_boolean ? "Yes" : "No";
    }
    if (item.value_date != null) return item.value_date;
    if (item.value_json != null) {
      return JSON.stringify(item.value_json);
    }

    return "";
  }

  function resetPage() {
    setPublicId("");
    setManagementToken("");
    setResult(null);
    setError("");
  }

  if (result?.success && result?.surprise) {
    const surprise = result.surprise;

    return (
      <div className="manage-surprise-page">
        <div className="manage-surprise-card">
          <div className="manage-success">
            <div className="manage-success-icon">✓</div>

            <h1>Surprise Verified</h1>

            <p>
              Your Management Token has been verified.
            </p>
          </div>

          <div className="manage-details">
            <div className="manage-detail">
              <span>Surprise ID</span>
              <strong>{surprise.public_id}</strong>
            </div>

            <div className="manage-detail">
              <span>Status</span>
              <strong>{surprise.status}</strong>
            </div>

            <div className="manage-detail">
              <span>Recipient</span>
              <strong>
                {surprise.recipient_name || "Not provided"}
              </strong>
            </div>

            <div className="manage-detail">
              <span>Email</span>
              <strong>
                {surprise.customer_email || "Not provided"}
              </strong>
            </div>

            <div className="manage-detail">
              <span>Phone</span>
              <strong>
                {surprise.customer_phone || "Not provided"}
              </strong>
            </div>

            <div className="manage-detail">
              <span>Theme</span>
              <strong>
                {surprise.theme_id || "royal-gold"}
              </strong>
            </div>

            <div className="manage-detail">
              <span>Created</span>
              <strong>
                {surprise.created_at
                  ? new Date(surprise.created_at).toLocaleString()
                  : "Unknown"}
              </strong>
            </div>
          </div>

          {result.values?.length > 0 && (
            <div className="manage-section">
              <h2>Submitted Details</h2>

              <div className="manage-values">
                {result.values.map((item) => (
                  <div
                    className="manage-value"
                    key={item.field_key}
                  >
                    <span>{item.field_key}</span>
                    <strong>{getValue(item)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

         {result.media?.length > 0 && (
  <div className="manage-section">
    <h2>Uploaded Memories</h2>

    <div className="manage-media-grid">
      {result.media.map((item) => (
        <div
          className="manage-media-card"
          key={item.id}
        >
          {item.signed_url ? (
            <img
              src={item.signed_url}
              alt={
                item.original_filename ||
                "Uploaded memory"
              }
              className="manage-media-image"
            />
          ) : (
            <div className="manage-media-placeholder">
              Image unavailable
            </div>
          )}

          <div className="manage-media-info">
            <strong>
              {item.field_key === "main_photo"
                ? "Main Photo"
                : "Memory Photo"}
            </strong>

            <small>
              {item.original_filename ||
                "Uploaded image"}
            </small>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
          

          <button
            type="button"
            onClick={resetPage}
            className="manage-reset-button"
          >
            Manage Another Surprise
          </button>

          <div className="manage-footer">
            Made with ♥ on Surprizyy
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="manage-surprise-page">
      <div className="manage-surprise-card">
        <div className="manage-header">
          <h1>Manage Your Surprise</h1>

          <p>
            Enter your Surprise ID and Management Token
            to securely access your surprise.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="manage-field">
            <label htmlFor="publicId">Surprise ID</label>

            <input
              id="publicId"
              type="text"
              value={publicId}
              onChange={(event) =>
                setPublicId(event.target.value)
              }
              placeholder="Enter Surprise ID"
              autoComplete="off"
            />
          </div>

          <div className="manage-field">
            <label htmlFor="managementToken">
              Management Token
            </label>

            <input
              id="managementToken"
              type="password"
              value={managementToken}
              onChange={(event) =>
                setManagementToken(event.target.value)
              }
              placeholder="Enter Management Token"
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="manage-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="manage-submit-button"
          >
            {loading ? "Verifying..." : "Access My Surprise"}
          </button>
        </form>

        <div className="manage-footer">
          Made with ♥ on Surprizyy
        </div>
      </div>
    </div>
  );
}

export default ManageSurprise;