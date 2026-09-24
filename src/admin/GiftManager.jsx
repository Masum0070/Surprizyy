import { useEffect, useState } from "react";
import { supabase } from "../core/supabase/client";
import { getAdminSessionHeaders, } from "./AdminSession";
import "../styles/gift-manager.css";

function GiftManager() {
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingGift, setEditingGift] = useState(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  async function callGiftManagement(action, payload = {}) {
    const headers = await getAdminSessionHeaders();

    const { data, error } =
      await supabase.functions.invoke(
        "gift-management",
        {
          body: {
            action,
            ...payload,
          },
          headers,
        }
      );

    if (error) {
      throw new Error(
        error.message ||
        "Gift management request failed."
      );
    }

    if (!data?.success) {
      throw new Error(
        data?.error ||
        "Gift management request failed."
      );
    }

    return data;
  }
  async function loadGifts() {
    setLoading(true);
    setError("");

    try {
      const data = await callGiftManagement("list");
      setGifts(data.gifts || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load gifts."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGifts();
  }, []);

  function makeSlug(value) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function handleNameChange(value) {
    setName(value);

    if (!slug || slug === makeSlug(name)) {
      setSlug(makeSlug(value));
    }
  }

  async function handleCreate(event) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Gift name is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await callGiftManagement("create", {
        name: name.trim(),
        slug: slug.trim() || makeSlug(name),
        description: description.trim(),
        is_active: true,
      });

      setName("");
      setSlug("");
      setDescription("");
      setShowCreateForm(false);

      await loadGifts();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create gift."
      );
    } finally {
      setSaving(false);
    }
  }

 async function handleToggle(gift) {
  setError("");

  if (
    gift.is_active &&
    !window.confirm(
      `Archive "${gift.name}"? It will no longer be available to customers.`
    )
  ) {
    return;
  }

  try {
    await callGiftManagement("update", {
      id: gift.id,
      is_active: !gift.is_active,
    });

    await loadGifts();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to update gift."
    );
  }
}

  const filteredGifts = gifts.filter((gift) => {
    const matchesSearch =
      gift.name
        ?.toLowerCase()
        .includes(search.toLowerCase()) ||
      gift.slug
        ?.toLowerCase()
        .includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && gift.is_active) ||
      (statusFilter === "inactive" && !gift.is_active);

    return matchesSearch && matchesStatus;
  });

  const activeCount = gifts.filter(
    (gift) => gift.is_active
  ).length;

  const inactiveCount = gifts.filter(
    (gift) => !gift.is_active
  ).length;

  return (
    <section className="admin-gift-manager">
      <div className="admin-section-header">
        <div>
          <h2>Gift Manager</h2>
          <p>
            Create and manage the gift types available
            on Surprizyy.
          </p>
        </div>
        <button
          type="button"
          className="admin-gift-create-button"
          onClick={() => setShowCreateForm((current) => !current)}
        >
          {showCreateForm ? "Close" : "Create Gift"}
        </button>
      </div>

      {error && (
        <div className="admin-error">
          {error}
        </div>
      )}
      <div className="admin-gift-stats">
        <div className="admin-gift-stat">
          <span>Total Gifts</span>
          <strong>{gifts.length}</strong>
        </div>

        <div className="admin-gift-stat">
          <span>Active</span>
          <strong>{activeCount}</strong>
        </div>

        <div className="admin-gift-stat">
          <span>Inactive</span>
          <strong>{inactiveCount}</strong>
        </div>
      </div>

      <div className="admin-gift-toolbar">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search gifts..."
          aria-label="Search gifts"
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value)
          }
          aria-label="Filter gifts"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      {showCreateForm && (
        <form
          className="admin-gift-form"
          onSubmit={handleCreate}
        >
        <div className="admin-form-field">
          <label htmlFor="gift-name">
            Gift Name
          </label>

          <input
            id="gift-name"
            type="text"
            value={name}
            onChange={(event) =>
              handleNameChange(event.target.value)
            }
            placeholder="Example: Birthday"
            required
          />
        </div>

        <div className="admin-form-field">
          <label htmlFor="gift-slug">
            Slug
          </label>

          <input
            id="gift-slug"
            type="text"
            value={slug}
            onChange={(event) =>
              setSlug(event.target.value)
            }
            placeholder="birthday"
            required
          />
        </div>

        <div className="admin-form-field">
          <label htmlFor="gift-description">
            Description
          </label>

          <textarea
            id="gift-description"
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            placeholder="Describe this gift type..."
            rows={3}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
        >
          {saving ? "Creating..." : "Create Gift"}
        </button>
        </form>
      )}

      <div className="admin-gift-list">
        <div className="admin-list-header">
          <h3>Gift Types</h3>

          <button
            type="button"
            onClick={loadGifts}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {loading ? (
  <div className="admin-gift-state">
    <div className="admin-gift-loader" />
    <strong>Loading gifts</strong>
    <p>Fetching your gift types...</p>
  </div>
) : filteredGifts.length === 0 ? (
  <div className="admin-gift-state">
    <div className="admin-gift-empty-icon">✦</div>
    <strong>
      {search || statusFilter !== "all"
        ? "No matching gifts"
        : "No gifts yet"}
    </strong>
    <p>
      {search || statusFilter !== "all"
        ? "Try changing your search or filter."
        : "Create your first gift type above."}
    </p>
  </div>
) : (
          <div className="admin-gift-grid">
            {filteredGifts.map((gift) => (
              <div
                className="admin-gift-card"
                key={gift.id}
              >
                <div>
                  <h4>{gift.name}</h4>

                  <p>
                    Slug:{" "}
                    <strong>
                      {gift.slug}
                    </strong>
                  </p>

                  {gift.description && (
                    <p>
                      {gift.description}
                    </p>
                  )}
                </div>

                <div className="admin-gift-card-footer">

                  <button
                    type="button"
                    onClick={() => {
                      setEditingGift(gift);
                      setEditName(gift.name || "");
                      setEditSlug(gift.slug || "");
                      setEditDescription(gift.description || "");
                    }}
                  >
                    Edit
                  </button>
                  <span
                    className={
                      gift.is_active
                        ? "admin-status-active"
                        : "admin-status-inactive"
                    }
                  >
                    {gift.is_active
                      ? "Active"
                      : "Inactive"}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      handleToggle(gift)
                    }
                  >
                    {gift.is_active
                      ? "Deactivate"
                      : "Activate"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {editingGift && (
  <div
    className="admin-gift-edit-overlay"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        setEditingGift(null);
      }
    }}
  >
    <div className="admin-gift-edit-modal">
      <div className="admin-gift-edit-header">
        <div>
          <span>Edit Gift</span>
          <h3>{editingGift.name}</h3>
        </div>

        <button
          type="button"
          onClick={() => setEditingGift(null)}
          aria-label="Close edit"
        >
          ×
        </button>
      </div>

      <div className="admin-form-field">
        <label htmlFor="edit-gift-name">Gift Name</label>
        <input
          id="edit-gift-name"
          type="text"
          value={editName}
          onChange={(event) =>
            setEditName(event.target.value)
          }
        />
      </div>

      <div className="admin-form-field">
        <label htmlFor="edit-gift-slug">Slug</label>
        <input
          id="edit-gift-slug"
          type="text"
          value={editSlug}
          onChange={(event) =>
            setEditSlug(event.target.value)
          }
        />
      </div>

      <div className="admin-form-field">
        <label htmlFor="edit-gift-description">
          Description
        </label>

        <textarea
          id="edit-gift-description"
          value={editDescription}
          onChange={(event) =>
            setEditDescription(event.target.value)
          }
          rows={4}
        />
      </div>

      <div className="admin-gift-edit-actions">
        <button
          type="button"
          onClick={() => setEditingGift(null)}
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={editSaving}
          onClick={async () => {
            if (!editName.trim() || !editSlug.trim()) {
              setError("Gift name and slug are required.");
              return;
            }

            setEditSaving(true);
            setError("");

            try {
              await callGiftManagement("update", {
                id: editingGift.id,
                name: editName.trim(),
                slug: editSlug.trim(),
                description: editDescription.trim(),
              });

              setEditingGift(null);
              await loadGifts();
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Unable to update gift."
              );
            } finally {
              setEditSaving(false);
            }
          }}
        >
          {editSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  </div>
)}
    </section>
  );
}

export default GiftManager;