import React, { useEffect, useState } from "react";
import { supabase } from "../core/supabase/client";
import { getAdminSessionHeaders,} from "./AdminSession";
import "../styles/publish-manager.css";

export default function PublishManager() {
  const [surprises, setSurprises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

 async function getAdminHeaders() {
  return await getAdminSessionHeaders();
}

  async function loadSurprises() {
    try {
      setLoading(true);
      setError("");

      const headers = await getAdminHeaders();

      const { data, error: functionError } =
        await supabase.functions.invoke(
          "surprise-management",
          {
            body: {
              action: "list_drafts",
            },
            headers,
          }
        );

      if (functionError) {
        throw functionError;
      }

      if (!data?.success) {
        throw new Error(
          data?.error ||
            "Failed to load surprises."
        );
      }

      setSurprises(data.surprises || []);
    } catch (err) {
      console.error(
        "Failed to load surprises:",
        err
      );

      setError(
        err?.message ||
          "Failed to load surprises."
      );
    } finally {
      setLoading(false);
    }
  }

  async function publishSurprise(surpriseId) {
    try {
      setPublishingId(surpriseId);
      setMessage("");
      setError("");

      const headers = await getAdminHeaders();

      const { data, error: functionError } =
        await supabase.functions.invoke(
          "publish-surprise",
          {
            body: {
              surprise_id: surpriseId,
            },
            headers,
          }
        );

      if (functionError) {
        throw functionError;
      }

      if (!data?.success) {
        throw new Error(
          data?.error ||
            "Failed to publish surprise."
        );
      }
      console.log(
  "PUBLISH FUNCTION RESPONSE:",
  data
);

      setMessage(
        "Surprise published successfully."
      );

      setSurprises((current) =>
        current.filter(
          (item) => item.id !== surpriseId
        )
      );
    } catch (err) {
      console.error(
        "Publish failed:",
        err
      );

      setError(
        err?.message ||
          "Failed to publish surprise."
      );
    } finally {
      setPublishingId(null);
    }
  }

  async function deleteSurprise(surprise) {
    const confirmed = window.confirm(
      `Delete the draft for ${surprise.recipient_name || "this customer"}? This also permanently deletes its uploaded media.`
    );
    if (!confirmed) return;

    try {
      setDeletingId(surprise.id);
      setMessage("");
      setError("");
      const headers = await getAdminHeaders();
      const { data, error: functionError } =
        await supabase.functions.invoke("surprise-management", {
          body: {
            action: "delete_surprise",
            surprise_id: surprise.id,
          },
          headers,
        });

      if (functionError || !data?.success) {
        throw new Error(
          data?.error ||
            functionError?.message ||
            "Failed to delete surprise."
        );
      }

      setSurprises((current) =>
        current.filter((item) => item.id !== surprise.id)
      );
      setMessage("Surprise deleted successfully.");
    } catch (err) {
      console.error("Delete failed:", err);
      setError(err?.message || "Failed to delete surprise.");
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    loadSurprises();
  }, []);

  if (loading) {
  return (
    <section className="publish-manager">
      <div className="pm-header">
        <div>
          <span className="pm-label">PUBLISH</span>
          <h2>Publish Manager</h2>
          <p>Manage draft surprises before publishing.</p>
        </div>
      </div>

      <div className="pm-loading">
        <div className="pm-loader" />
        <strong>Loading drafts</strong>
        <p>Please wait while your surprises are loaded.</p>
      </div>
    </section>
  );
}

  return (
    <section className="publish-manager">
      <h3>Publish Surprises</h3>

      <div className="pm-stats">
  <div className="pm-stat">
    <span>Draft Surprises</span>
    <strong>{surprises.length}</strong>
  </div>

  <div className="pm-stat">
    <span>Ready to Publish</span>
    <strong>{surprises.length}</strong>
  </div>
</div>

      {message && (
  <div className="pm-message pm-success">
    {message}
  </div>
)}

{error && (
  <div className="pm-message pm-error">
    {error}
  </div>
)}

      {surprises.length === 0 ? (
  <div className="pm-empty-state">
    <div className="pm-empty-icon">✦</div>
    <strong>No draft surprises</strong>
    <p>
      New draft surprises will appear here when they are ready to publish.
    </p>
  </div>
      ) : (
        surprises.map((surprise) => (
          <div
  key={surprise.id}
  className="pm-draft-card"
>
            <div className="pm-draft-card-content">
  <div className="pm-draft-card-top">
    <strong>
      {surprise.recipient_name ||
        "Unnamed recipient"}
    </strong>

    <span className="pm-status">
      {surprise.status}
    </span>
  </div>

  <p>
    {surprise.customer_email ||
      "No email"}
  </p>
</div>

<div className="pm-draft-card-actions">
  <button
    type="button"
    className="pm-publish-button"
    onClick={() =>
      publishSurprise(surprise.id)
    }
    disabled={publishingId === surprise.id}
  >
    {publishingId === surprise.id
      ? "Publishing..."
      : "Publish"}
  </button>
  <button
    type="button"
    className="pm-delete-button"
    onClick={() => deleteSurprise(surprise)}
    disabled={
      publishingId === surprise.id ||
      deletingId === surprise.id
    }
  >
    {deletingId === surprise.id ? "Deleting..." : "Delete"}
  </button>
</div>
          </div>
        ))
      )}
       </section>
  );
}