import React, { useEffect, useState } from "react";
import { supabase } from "../core/supabase/client";
import { getAdminSessionHeaders,} from "./AdminSession";
import "../styles/settings-panel.css";

export default function SettingsPanel() {
  const [settings, setSettings] = useState({
    site_name: "",
    support_email: "",
    whatsapp_number: "",
    instagram_url: "",
    maintenance_mode: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

 async function getAdminHeaders() {
  return await getAdminSessionHeaders();
}

  async function loadSettings() {
    try {
      setLoading(true);
      setError("");

      const headers = await getAdminHeaders();

      const { data, error: functionError } =
        await supabase.functions.invoke(
          "settings-management",
          {
            body: {
              action: "get",
            },
            headers,
          }
        );

      if (functionError) {
        throw functionError;
      }

      if (data?.settings) {
        setSettings({
          site_name:
            data.settings.site_name || "",

          support_email:
            data.settings.support_email || "",

          whatsapp_number:
            data.settings.whatsapp_number || "",

          instagram_url:
            data.settings.instagram_url || "",

          maintenance_mode:
            data.settings.maintenance_mode === true,
        });
      }
    } catch (err) {
      console.error(
        "Settings loading failed:",
        err
      );

      setError(
        err?.message ||
          "Failed to load settings."
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    try {
      setSaving(true);
      setMessage("");
      setError("");

      const headers = await getAdminHeaders();

      const { data, error: functionError } =
        await supabase.functions.invoke(
          "settings-management",
          {
            body: {
              action: "update",
              settings,
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
            "Failed to save settings."
        );
      }

      if (data.settings) {
        setSettings({
          site_name:
            data.settings.site_name || "",

          support_email:
            data.settings.support_email || "",

          whatsapp_number:
            data.settings.whatsapp_number || "",

          instagram_url:
            data.settings.instagram_url || "",

          maintenance_mode:
            data.settings.maintenance_mode === true,
        });
      }

      setMessage(
        "Settings saved successfully."
      );
    } catch (err) {
      console.error(
        "Settings save failed:",
        err
      );

      setError(
        err?.message ||
          "Failed to save settings."
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  function updateField(field, value) {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));

    setMessage("");
    setError("");
  }

 if (loading) {
  return (
    <section className="settings-panel">
      <div className="settings-header">
        <span className="sp-label">SETTINGS</span>
        <h2>Settings</h2>
        <p>Manage your Surprizyy website configuration.</p>
      </div>

      <div className="sp-loading">
        <div className="sp-loader" />
        <strong>Loading settings</strong>
        <p>Please wait...</p>
      </div>
    </section>
  );
}

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h3>Settings</h3>
        <p>
          Manage your Surprizyy website
          configuration.
        </p>
      </div>

      <div className="settings-field">
        <label>Site Name</label>

        <input
          type="text"
          value={settings.site_name}
          onChange={(e) =>
            updateField(
              "site_name",
              e.target.value
            )
          }
        />
      </div>

      <div className="settings-field">
        <label>Support Email</label>

        <input
          type="email"
          value={settings.support_email}
          onChange={(e) =>
            updateField(
              "support_email",
              e.target.value
            )
          }
        />
      </div>

      <div className="settings-field">
        <label>WhatsApp Number</label>

        <input
          type="text"
          value={settings.whatsapp_number}
          onChange={(e) =>
            updateField(
              "whatsapp_number",
              e.target.value
            )
          }
          placeholder="919876543210"
        />
      </div>

      <div className="settings-field">
        <label>Instagram URL</label>

        <input
          type="url"
          value={settings.instagram_url}
          onChange={(e) =>
            updateField(
              "instagram_url",
              e.target.value
            )
          }
          placeholder="https://instagram.com/..."
        />
      </div>

      <div className="settings-field">
        <label>
          <input
            type="checkbox"
            checked={
              settings.maintenance_mode
            }
            onChange={(e) =>
              updateField(
                "maintenance_mode",
                e.target.checked
              )
            }
          />

          {" "}Maintenance Mode
        </label>
      </div>

      {message && (
        <p className="settings-success">
          {message}
        </p>
      )}

      {error && (
        <p className="settings-error">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={saveSettings}
        disabled={saving}
      >
        {saving
          ? "Saving..."
          : "Save Settings"}
      </button>
    </div>
  );
}