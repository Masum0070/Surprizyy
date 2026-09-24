import { useEffect, useState } from "react";
import { supabase } from "../core/supabase/client";
import {getAdminSessionHeaders,} from "./AdminSession";
import "../styles/template-manager.css";
import { compressImage } from "../core/imageCompression";

function TemplateManager() {
  const [templates, setTemplates] = useState([]);
  const [templatePage, setTemplatePage] = useState(1);
const [templateTotal, setTemplateTotal] = useState(0);
const [templateTotalPages, setTemplateTotalPages] = useState(1);
  const [giftTypes, setGiftTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [versions, setVersions] = useState({});
const [versionInput, setVersionInput] = useState({});
const [search, setSearch] = useState("");
const [debouncedSearch, setDebouncedSearch] = useState("");
const [statusFilter, setStatusFilter] = useState("all");
const [giftFilter, setGiftFilter] = useState("all");
const [previewFile, setPreviewFile] = useState(null);
const [formDirty, setFormDirty] = useState(false);

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(search);
  }, 400);

  return () => clearTimeout(timer);
}, [search]);

  const [form, setForm] = useState({
    gift_type_id: "",
    name: "",
    slug: "",
    description: "",
    base_price: "",
    discount_percentage: "0",
  });

async function callApi(action, extra = {}) {
  const headers = await getAdminSessionHeaders();

  const { data, error } =
    await supabase.functions.invoke(
      "template-management",
      {
        body: {
          action,
          ...extra,
        },
        headers,
      }

    );

  if (error) {
    let message = error.message || "Request failed.";

    if (error.context) {
      try {
        const responseBody = await error.context.text();
        const parsedBody = JSON.parse(responseBody);
        message = parsedBody?.error || message;
      } catch {
        // Keep the original Supabase error when the response is not JSON.
      }
    }

    throw new Error(message);
  }

  if (!data?.success) {
    throw new Error(
      data?.error || "Request failed."
    );
  }

  return data;
}

async function uploadPreview(templateId, previewFile) {
  if (!previewFile) return;

  const compressed = await compressImage(previewFile);
  const formData = new FormData();
  formData.append("template_id", templateId);
  formData.append("file", compressed, compressed.name);
  const headers = await getAdminSessionHeaders();
  const { data, error } = await supabase.functions.invoke(
    "template-preview-upload",
    { body: formData, headers }
  );

  if (error || !data?.success) {
    let detail = data?.error;

    if (!detail && error?.context) {
      try {
        const response = error.context;
        const body = await response.json();
        detail = body?.error;
      } catch {
        detail = null;
      }
    }

    throw new Error(
      detail || error?.message || "Failed to upload preview."
    );
  }
}

  async function loadVersions(templateId) {
  try {
    const data = await callApi("list_versions", {
      template_id: templateId,
    });

    setVersions((current) => ({
      ...current,
      [templateId]: data.versions || [],
    }));
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Failed to load template versions."
    );
  }
}
async function handleCreateVersion(templateId) {
  const version = (versionInput[templateId] || "").trim();

  if (!version) {
    setError("Version is required.");
    return;
  }

  setError("");
  setMessage("");

  try {
    await callApi("create_version", {
      template_id: templateId,
      version,
    });

    setVersionInput((current) => ({
      ...current,
      [templateId]: "",
    }));

    setMessage("Version created successfully.");
    await loadVersions(templateId);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Failed to create version."
    );
  }
}
async function handleUpdateVersion(templateId, versionId, currentVersion) {
  const version = window.prompt(
    "Enter the new version:",
    currentVersion
  );

  if (version === null) {
    return;
  }

  const trimmedVersion = version.trim();

  if (!trimmedVersion) {
    setError("Version is required.");
    return;
  }

  setError("");
  setMessage("");

  try {
    await callApi("update_version", {
      id: versionId,
      version: trimmedVersion,
    });

    setMessage("Version updated successfully.");
    await loadVersions(templateId);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Failed to update version."
    );
  }
}
  async function loadData(page = 1) {
    setLoading(true);
    setError("");

    try {
      const [templateData, giftData] = await Promise.all([
  callApi("list", {
  page,
  search: debouncedSearch,
  status: statusFilter,
  gift_type_id: giftFilter === "all"
    ? ""
    : giftFilter,
}),
        supabase
          .from("gift_types")
          .select("id, name, slug")
          .order("name", { ascending: true }),
      ]);

      if (giftData.error) {
        throw new Error(giftData.error.message);
      }

      const loadedTemplates = templateData.templates || [];

setTemplates(loadedTemplates);
setGiftTypes(giftData.data || []);

setTemplatePage(
  templateData.pagination?.page || page
);

setTemplateTotal(
  templateData.pagination?.total || 0
);

setTemplateTotalPages(
  templateData.pagination?.total_pages || 1
);

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load templates."
      );
    } finally {
      setLoading(false);
    }
  }

useEffect(() => {
  setTemplatePage(1);
  loadData(1);
}, [debouncedSearch, giftFilter, statusFilter]);
  function updateField(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
    setFormDirty(true);
  }

  function makeSlug(value) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function handleNameChange(event) {
    const value = event.target.value;

    setForm((current) => ({
      ...current,
      name: value,
      slug:
        current.slug === makeSlug(current.name)
          ? makeSlug(value)
          : current.slug,
    }));
    setFormDirty(true);
  }

  async function handleCreate(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!form.gift_type_id) {
      setError("Please select a gift type.");
      return;
    }

    if (!form.name.trim()) {
      setError("Template name is required.");
      return;
    }

    if (!form.slug.trim()) {
      setError("Template slug is required.");
      return;
    }

    if (form.base_price === "") {
      setError("Base price is required.");
      return;
    }

    setSaving(true);

    try {
      const created = await callApi("create", {
        gift_type_id: form.gift_type_id,
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
        base_price: Number(form.base_price),
        discount_percentage: Number(
          form.discount_percentage || 0
        ),
      });
      await uploadPreview(created.template.id, previewFile);

      setForm({
        gift_type_id: "",
        name: "",
        slug: "",
        description: "",
        base_price: "",
        discount_percentage: "0",
      });

      setMessage("Template created successfully.");
      setShowCreateForm(false);
      setPreviewFile(null);
      setFormDirty(false);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create template."
      );
    } finally {
      setSaving(false);
    }
  }

async function handleUpdate(event) {
  event.preventDefault();

  setError("");
  setMessage("");

  if (!editingId) {
    return;
  }

  if (!form.gift_type_id) {
    setError("Please select a gift type.");
    return;
  }

  if (!form.name.trim()) {
    setError("Template name is required.");
    return;
  }

  if (!form.slug.trim()) {
    setError("Template slug is required.");
    return;
  }

  if (form.base_price === "") {
    setError("Base price is required.");
    return;
  }

  setSaving(true);

  try {
    await callApi("update", {
      id: editingId,
      gift_type_id: form.gift_type_id,
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      base_price: Number(form.base_price),
      discount_percentage: Number(
        form.discount_percentage || 0
      ),
      is_active: true,
    });
    await uploadPreview(editingId, previewFile);

    setEditingId(null);
    setShowCreateForm(false);
    setPreviewFile(null);
    setFormDirty(false);

    setForm({
      gift_type_id: "",
      name: "",
      slug: "",
      description: "",
      base_price: "",
      discount_percentage: "0",
    });
    setPreviewFile(null);
    setFormDirty(false);

    setMessage("Template updated successfully.");
    await loadData();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Failed to update template."
    );
  } finally {
    setSaving(false);
  }
}

  async function handleToggleActive(template) {
    const nextActive = !template.is_active;
    const confirmed = window.confirm(
      nextActive
        ? `Activate "${template.name}"?`
        : `Deactivate "${template.name}"?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      await callApi("update", {
        id: template.id,
        is_active: nextActive,
      });

      setMessage(
        nextActive
          ? "Template activated."
          : "Template deactivated."
      );
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : nextActive
            ? "Failed to activate template."
            : "Failed to deactivate template."
      );
    }
  }

  async function handleDelete(template) {
    const confirmed = window.confirm(
      `Permanently delete "${template.name}"? Only inactive templates with no versions can be deleted.`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      await callApi("delete", { id: template.id });
      setMessage("Template deleted.");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete template."
      );
    }
  }

    
        const filteredTemplates = templates.filter((template) => {
    const searchText = search.toLowerCase().trim();

    const matchesSearch =
      !searchText ||
      template.name?.toLowerCase().includes(searchText) ||
      template.slug?.toLowerCase().includes(searchText);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && template.is_active) ||
      (statusFilter === "inactive" && !template.is_active);

    const matchesGift =
      giftFilter === "all" ||
      template.gift_type_id === giftFilter;

    return matchesSearch && matchesStatus && matchesGift;
  });

  const activeTemplateCount = templates.filter(
    (template) => template.is_active
  ).length;

  const inactiveTemplateCount = templates.filter(
    (template) => !template.is_active
  ).length;
  if (loading) {
    return (
      <section className="admin-template-manager">
        <div className="admin-section-header">
          <div>
            <span className="admin-header-label">TEMPLATES</span>
            <h2>Template Manager</h2>
            <p>Loading your Surprizyy templates...</p>
          </div>
        </div>

        <div className="admin-template-empty">
  <div className="admin-template-empty-icon">✦</div>

  <strong>
    {search || giftFilter !== "all" || statusFilter !== "all"
      ? "No matching templates"
      : "No templates yet"}
  </strong>

  <p>
    {search || giftFilter !== "all" || statusFilter !== "all"
      ? "Try changing your search or filters."
      : "Create your first Surprizyy template above."}
  </p>
</div>
      </section>
    );
  }

  return (
    <section className="admin-template-manager">
      <div className="admin-template-header">
        <div>
          <span className="admin-header-label">TEMPLATES</span>
          <h2>Template Manager</h2>
          <p>Manage Surprizyy templates, pricing and versions.</p>
        </div>

        <button
          type="button"
          className="admin-template-create-button"
          onClick={() => {
            setEditingId(null);
            setShowCreateForm((current) => !current);

            setForm({
              gift_type_id: "",
              name: "",
              slug: "",
              description: "",
              base_price: "",
              discount_percentage: "0",
            });
            setPreviewFile(null);
            setFormDirty(false);

            setError("");
            setMessage("");
          }}
        >
          {showCreateForm ? "Close" : "+ New Template"}
        </button>
      </div>

      {error && (
        <div className="admin-error">
          {error}
        </div>
      )}

      {message && (
        <div className="admin-success">
          {message}
        </div>
      )}
      <div className="admin-template-stats">
        <div className="admin-template-stat">
          <span>Total Templates</span>
          <strong>{templates.length}</strong>
        </div>

        <div className="admin-template-stat">
          <span>Active</span>
          <strong>{activeTemplateCount}</strong>
        </div>

        <div className="admin-template-stat">
          <span>Inactive</span>
          <strong>{inactiveTemplateCount}</strong>
        </div>
      </div>

      <div className="admin-template-toolbar">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search templates..."
          aria-label="Search templates"
        />

        <select
          value={giftFilter}
          onChange={(event) =>
            setGiftFilter(event.target.value)
          }
          aria-label="Filter by gift type"
        >
          <option value="all">All Gift Types</option>

          {giftTypes.map((gift) => (
            <option key={gift.id} value={gift.id}>
              {gift.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value)
          }
          aria-label="Filter by status"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      {showCreateForm && (
        <form
          className="admin-template-form"
          onSubmit={editingId ? handleUpdate : handleCreate}
        >
        <div className="admin-template-form-heading">
          <div>
            <span>
              {editingId ? "EDIT TEMPLATE" : "NEW TEMPLATE"}
            </span>

            <h3>
              {editingId
                ? "Update template"
                : "Create a template"}
            </h3>
          </div>

          {editingId && (
            <button
              type="button"
              className="admin-template-cancel"
              onClick={() => {
                setEditingId(null);

                setForm({
                  gift_type_id: "",
                  name: "",
                  slug: "",
                  description: "",
                  base_price: "",
                  discount_percentage: "0",
                });

                setPreviewFile(null);
                setFormDirty(false);
                setError("");
                setMessage("");
              }}
            >
              Cancel
            </button>
          )}
        </div>

        <div className="admin-template-form-grid">
          <div className="admin-form-field">
            <label htmlFor="gift_type_id">
              Gift Type
            </label>

            <select
              id="gift_type_id"
              name="gift_type_id"
              value={form.gift_type_id}
              onChange={updateField}
              required
            >
              <option value="">
                Select gift type
              </option>

              {giftTypes.map((gift) => (
                <option
                  key={gift.id}
                  value={gift.id}
                >
                  {gift.name}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-form-field">
            <label htmlFor="template-name">
              Template Name
            </label>

            <input
              id="template-name"
              name="name"
              value={form.name}
              onChange={handleNameChange}
              placeholder="Birthday Premium"
              required
            />
          </div>

          <div className="admin-form-field">
            <label htmlFor="template-slug">
              Slug
            </label>

            <input
              id="template-slug"
              name="slug"
              value={form.slug}
              onChange={updateField}
              placeholder="birthday-premium"
              required
            />
          </div>

          <div className="admin-form-field">
            <label htmlFor="base-price">
              Base Price
            </label>

            <input
              id="base-price"
              name="base_price"
              type="number"
              min="0"
              step="0.01"
              value={form.base_price}
              onChange={updateField}
              placeholder="499"
              required
            />
          </div>

          <div className="admin-form-field">
            <label htmlFor="discount">
              Discount %
            </label>

            <input
              id="discount"
              name="discount_percentage"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.discount_percentage}
              onChange={updateField}
            />
          </div>

          <div className="admin-form-field admin-template-description-field">
            <label htmlFor="template-description">
              Description
            </label>

            <textarea
              id="template-description"
              name="description"
              value={form.description}
              onChange={updateField}
              placeholder="Premium birthday surprise template"
              rows="3"
            />
          </div>

          <div className="admin-form-field">
            <label htmlFor="template-preview">
              Preview image
            </label>
            <input
              id="template-preview"
              type="file"
              accept="image/*"
              onChange={(event) => {
                setPreviewFile(event.target.files?.[0] || null);
                setFormDirty(true);
              }}
            />
            <small>
              Images are compressed before being saved to the public preview bucket.
            </small>
          </div>
        </div>

        <div className="admin-template-form-footer">
          <small className="admin-template-draft-status">
            {formDirty
              ? "Draft changes are local until you save this form."
              : "No unsaved changes."}
          </small>
          <button
            type="submit"
            className="admin-template-submit"
            disabled={saving}
          >
            {saving
              ? editingId
                ? "Updating..."
                : "Creating..."
              : editingId
                ? "Update Template"
                : "Create Template"}
          </button>
        </div>
        </form>
      )}

      <div className="admin-template-list-section">
        <div className="admin-list-header">
          <div>
            <h3>Templates</h3>
            <p className="admin-template-count">
              {templates.length} template
              {templates.length === 1 ? "" : "s"}
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {filteredTemplates.length === 0 ? (
          <div className="admin-template-empty">
            <strong>No templates found</strong>
            <p>Create your first Surprizyy template above.</p>
          </div>
        ) : (
          <>
          <div className="admin-template-grid">
            {filteredTemplates.map((template) => (
              <article
                className="admin-template-card"
                key={template.id}
              >
                <div className="admin-template-preview">
                  {template.preview_url ? (
                    <img
                      src={template.preview_url}
                      alt={`${template.name} preview`}
                    />
                  ) : (
                    template.gift_types?.name === "Birthday"
                      ? "🎂"
                      : template.gift_types?.name === "Rakhi"
                        ? "🌸"
                        : "✨"
                  )}
                </div>

                <div>
                  <div className="admin-template-card-top">
                    <h3>{template.name}</h3>

                    <span
                      className={
                        template.is_active
                          ? "admin-template-status"
                          : "admin-template-status inactive"
                      }
                    >
                      {template.is_active
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </div>

                  <p className="admin-template-gift">
                    {template.gift_types?.name || "Unknown gift type"}
                  </p>

                  {template.description && (
                    <p>
                      {template.description}
                    </p>
                  )}

                  <div className="admin-template-details">
                    <div>
                      <span>Slug</span>
                      <strong>{template.slug}</strong>
                    </div>

                    <div>
                      <span>Price</span>
                      <strong>₹{template.base_price}</strong>
                    </div>

                    <div>
                      <span>Discount</span>
                      <strong>
                        {template.discount_percentage || 0}%
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="admin-template-actions">
                  <>
                    <button
                        type="button"
                        onClick={() => {
                          setEditingId(template.id);
                          setShowCreateForm(true);

                          setForm({
                            gift_type_id:
                              template.gift_type_id || "",
                            name:
                              template.name || "",
                            slug:
                              template.slug || "",
                            description:
                              template.description || "",
                            preview_url:
                              template.preview_url || "",
                            base_price:
                              template.base_price ?? "",
                            discount_percentage:
                              template.discount_percentage ?? "0",
                          });

                          setError("");
                          setMessage("");
                        }}
                      >
                        Edit
                      </button>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(template)}
                    >
                      {template.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </>
                  <button
                    type="button"
                    className="admin-template-delete-button"
                    onClick={() => handleDelete(template)}
                  >
                    Delete
                  </button>
                </div>

                <div className="template-versions">
                  <div className="template-versions-heading">
                    <div>
                      <span>VERSIONS</span>
                      <h4>Template versions</h4>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        loadVersions(template.id)
                      }
                    >
                      Load
                    </button>
                  </div>

                  {(versions[template.id] || []).length === 0 ? (
                    <p className="template-no-versions">
                      No versions loaded.
                    </p>
                  ) : (
                    <div className="template-version-list">
                      {(versions[template.id] || []).map(
                        (version) => (
                          <div
                            className="template-version-row"
                            key={version.id}
                          >
                            <div>
                              <strong>
                                {version.version}
                              </strong>

                              <span
                                className={
                                  version.is_active
                                    ? "version-active"
                                    : "version-inactive"
                                }
                              >
                                {version.is_active
                                  ? "Active"
                                  : "Inactive"}
                              </span>
                            </div>

                            <div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateVersion(
                                    template.id,
                                    version.id,
                                    version.version
                                  )
                                }
                              >
                                Edit
                              </button>

                              {version.is_active && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await callApi(
                                        "deactivate_version",
                                        {
                                          id: version.id,
                                        }
                                      );

                                      setMessage(
                                        "Version deactivated."
                                      );

                                      await loadVersions(
                                        template.id
                                      );
                                    } catch (err) {
                                      setError(
                                        err instanceof Error
                                          ? err.message
                                          : "Failed to deactivate version."
                                      );
                                    }
                                  }}
                                >
                                  Deactivate
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <div className="template-add-version">
                    <input
                      type="text"
                      value={
                        versionInput[template.id] || ""
                      }
                      onChange={(event) =>
                        setVersionInput((current) => ({
                          ...current,
                          [template.id]:
                            event.target.value,
                        }))
                      }
                      placeholder="e.g. v1"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        handleCreateVersion(template.id)
                      }
                    >
                      + Add Version
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {templateTotalPages > 1 && (
  <div className="admin-template-pagination">
    <div>
      <span>
        Page {templatePage} of {templateTotalPages}
      </span>

      <small>
        {templateTotal} total templates
      </small>
    </div>

    <div className="admin-template-pagination-actions">
      <button
        type="button"
        disabled={templatePage <= 1 || loading}
        onClick={() => {
          loadData(templatePage - 1);
        }}
      >
        ← Previous
      </button>

      <button
        type="button"
        disabled={
          templatePage >= templateTotalPages ||
          loading
        }
        onClick={() => {
          loadData(templatePage + 1);
        }}
      >
        Next →
      </button>
    </div>
  </div>
  )}
</>
        )}
      </div>
    </section>
  );
}

export default TemplateManager;