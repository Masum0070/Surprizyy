import { useEffect, useState } from "react";
import { supabase } from "../core/supabase/client";
import "../styles/form-builder.css";
import { getAdminSessionHeaders, } from "./AdminSession";
function FormBuilder() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [sections, setSections] = useState([]);
  const [fields, setFields] = useState([]);
  const [reorderingSection, setReorderingSection] = useState(false);
  const [reorderingField, setReorderingField] = useState(false);
  const [updatingSectionStatus, setUpdatingSectionStatus] = useState(false);
  const [updatingFieldStatus, setUpdatingFieldStatus] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingForm, setLoadingForm] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showFieldForm, setShowFieldForm] = useState(false);

  const [showEditFieldForm, setShowEditFieldForm] = useState(false);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [showDeleteSectionForm, setShowDeleteSectionForm] = useState(false);

  const [deleteSectionTarget, setDeleteSectionTarget] = useState(null);
  const [showDeleteFieldForm, setShowDeleteFieldForm] = useState(false);

  const [deleteFieldTarget, setDeleteFieldTarget] = useState(null);

  const [sectionForm, setSectionForm] = useState({
    title: "",
    description: "",
  });


  const [editFieldForm, setEditFieldForm] = useState({
    id: "",
    fieldKey: "",
    label: "",
    fieldType: "text",
    placeholder: "",
    helperText: "",
    options: "",
    maxFiles: 0,
    required: false,
  });

  const [fieldForm, setFieldForm] = useState({
    fieldKey: "",
    label: "",
    fieldType: "text",
    placeholder: "",
    helperText: "",
    options: "",
    maxFiles: 0,
    required: false,
  });

  const [fieldFormSection, setFieldFormSection] = useState(null);
  const [showEditSectionForm, setShowEditSectionForm] = useState(false);

  const [editSectionForm, setEditSectionForm] = useState({
    id: "",
    title: "",
    description: "",
  });

  async function callApi(action, extra = {}) {
    const headers = await getAdminSessionHeaders();

    const { data, error } =
      await supabase.functions.invoke(
        "form-management",
        {
          body: {
            action,
            ...extra,
          },
          headers,
        }
      );

    if (error) {
      throw new Error(
        error.message || "Request failed."
      );
    }

    if (!data?.success) {
      throw new Error(
        data?.error || "Request failed."
      );
    }

    return data;
  }

  async function loadTemplates() {
    setLoading(true);
    setError("");

    try {
      const {
        data: templateData,
        error: templateError,
      } = await supabase
        .from("templates")
        .select("id, name, gift_type_id")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (templateError) {
        throw new Error(templateError.message);
      }

      setTemplates(templateData || []);
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

  async function loadVersions(templateId) {
    setError("");
    setVersions([]);
    setSelectedVersion("");

    if (!templateId) {
      return;
    }

    try {
      const {
        data,
        error,
      } = await supabase
        .from("template_versions")
        .select("id, version, is_active")
        .eq("template_id", templateId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      setVersions(data || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load template versions."
      );
    }
  }

  async function loadForm(templateVersionId) {
    setLoadingForm(true);
    setError("");
    setMessage("");
    setSections([]);
    setFields([]);

    if (!templateVersionId) {
      setLoadingForm(false);
      return;
    }

    try {
      const data = await callApi("list", {
        template_version_id: templateVersionId,
      });

      setSections(data.sections || []);
      setFields(data.fields || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load form."
      );
    } finally {
      setLoadingForm(false);
    }
  }
  async function normalizeSectionOrder() {
    const sortedSections = [...sections].sort(
      (a, b) => a.sort_order - b.sort_order
    );

    for (let index = 0; index < sortedSections.length; index++) {
      if (sortedSections[index].sort_order !== index) {
        await callApi("update_section", {
          id: sortedSections[index].id,
          sort_order: index,
        });
      }
    }
  }
  async function moveSection(sectionId, direction) {
    if (reorderingSection) return;

    const index = sections.findIndex(
      (section) => section.id === sectionId
    );

    if (index === -1) return;

    const newIndex =
      direction === "up"
        ? index - 1
        : index + 1;

    if (newIndex < 0 || newIndex >= sections.length) {
      return;
    }

    try {
      setError("");
      setMessage("");
      setReorderingSection(true);

      const currentSection = sections[index];
      const targetSection = sections[newIndex];

      await callApi("update_section", {
        id: currentSection.id,
        sort_order: targetSection.sort_order,
      });

      await callApi("update_section", {
        id: targetSection.id,
        sort_order: currentSection.sort_order,
      });

      setMessage("Section order updated.");

      await loadForm(selectedVersion);
      await normalizeSectionOrder();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update section order."
      );
    } finally {
      setReorderingSection(false);
    }
  }
  async function normalizeFieldOrder(sectionId) {
    const sectionFields = fields
      .filter((field) => field.section_id === sectionId)
      .sort((a, b) => a.sort_order - b.sort_order);

    for (let index = 0; index < sectionFields.length; index++) {
      if (sectionFields[index].sort_order !== index) {
        await callApi("update_field", {
          id: sectionFields[index].id,
          sort_order: index,
        });
      }
    }
  }
  async function moveField(fieldId, direction) {
    if (reorderingField) return;

    const currentIndex = fields.findIndex(
      (field) => field.id === fieldId
    );

    if (currentIndex === -1) return;

    const currentField = fields[currentIndex];

    const sectionFields = fields
      .filter((field) => field.section_id === currentField.section_id)
      .sort((a, b) => a.sort_order - b.sort_order);

    const sectionIndex = sectionFields.findIndex(
      (field) => field.id === fieldId
    );

    if (sectionIndex === -1) return;

    const newIndex =
      direction === "up"
        ? sectionIndex - 1
        : sectionIndex + 1;

    if (newIndex < 0 || newIndex >= sectionFields.length) {
      return;
    }

    try {
      setError("");
      setMessage("");
      setReorderingField(true);

      const targetField = sectionFields[newIndex];

      await callApi("update_field", {
        id: currentField.id,
        sort_order: targetField.sort_order,
      });

      await callApi("update_field", {
        id: targetField.id,
        sort_order: currentField.sort_order,
      });

      setMessage("Field order updated.");

      await normalizeFieldOrder(currentField.section_id);

      await loadForm(selectedVersion);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update field order."
      );
    } finally {
      setReorderingField(false);
    }
  }
  async function toggleSectionStatus(section) {
    if (updatingSectionStatus) return;

    try {
      setError("");
      setMessage("");
      setUpdatingSectionStatus(true);

      await callApi("update_section", {
        id: section.id,
        is_active: !section.is_active,
      });

      setMessage(
        section.is_active
          ? "Section deactivated."
          : "Section activated."
      );

      await loadForm(selectedVersion);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update section status."
      );
    } finally {
      setUpdatingSectionStatus(false);
    }
  }
  async function toggleFieldStatus(field) {
    if (updatingFieldStatus) return;

    try {
      setError("");
      setMessage("");
      setUpdatingFieldStatus(true);

      await callApi("update_field", {
        id: field.id,
        is_active: !field.is_active,
      });

      setMessage(
        field.is_active
          ? "Field deactivated."
          : "Field activated."
      );

      await loadForm(selectedVersion);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update field status."
      );
    } finally {
      setUpdatingFieldStatus(false);
    }
  }
  function addSelectOption() {
    setFieldForm((current) => ({
      ...current,
      options: current.options
        ? `${current.options}, New Option`
        : "New Option",
    }));
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    loadVersions(selectedTemplate);
  }, [selectedTemplate]);

  useEffect(() => {
    loadForm(selectedVersion);
  }, [selectedVersion]);

  if (loading) {
    return (
      <section className="form-builder">
        <div className="fb-page-header">
          <span className="fb-header-label">FORM BUILDER</span>
          <h2>Form Builder</h2>
          <p>Loading your templates...</p>
        </div>

        <div className="fb-loading-state">
          <div className="fb-loader" />
          <strong>Loading Form Builder</strong>
          <p>Please wait while your templates are loaded.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="form-builder">
      <div className="fb-page-header">
        <div>
          <span className="fb-header-label">FORM BUILDER</span>
          <h2>Form Builder</h2>
          <p>
            Build the customer form for each template version.
          </p>
        </div>
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

      <div className="fb-template-controls">
        <div className="fb-control-card">
          <label htmlFor="form-template">
            Template
          </label>

          <select
            id="form-template"
            value={selectedTemplate}
            onChange={(event) =>
              setSelectedTemplate(event.target.value)
            }
          >
            <option value="">
              Select template
            </option>

            {templates.map((template) => (
              <option
                key={template.id}
                value={template.id}
              >
                {template.name}
              </option>
            ))}
          </select>
        </div>

        <div className="fb-control-card">
          <label htmlFor="form-version">
            Template Version
          </label>

          <select
            id="form-version"
            value={selectedVersion}
            onChange={(event) =>
              setSelectedVersion(event.target.value)
            }
            disabled={!selectedTemplate}
          >
            <option value="">
              Select version
            </option>

            {versions.map((version) => (
              <option
                key={version.id}
                value={version.id}
              >
                {version.version}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadingForm && (
        <div className="fb-loading-state fb-loading-small">
          <div className="fb-loader" />
          <strong>Loading form</strong>
          <p>Fetching sections and fields...</p>
        </div>
      )}

      {!loadingForm && selectedVersion && (
        <div>
          <div>
            <h3>Sections</h3>

            <button
              type="button"
              className="add-section-button"
              onClick={() => {
                setSectionForm({
                  title: "",
                  description: "",
                });

                setShowSectionForm(true);
              }}
            >
              + Add Section
            </button>
          </div>

          {sections.length === 0 ? (
            <div className="fb-empty-state">
              <div className="fb-empty-icon">✦</div>
              <strong>No sections yet</strong>
              <p>Create your first section to start building this form.</p>
            </div>
          ) : (
            sections.map((section) => (
              <article key={section.id}>
                <div className="section-header">
                  <div>
                    <h4>{section.title}</h4>

                    {section.description && (
                      <p>{section.description}</p>
                    )}
                  </div>

                  <div className="section-order-buttons">
                    <button
                      type="button"
                      className={`section-status-button ${section.is_active ? "active" : "inactive"
                        }`}
                      disabled={updatingSectionStatus}
                      onClick={() => toggleSectionStatus(section)}
                    >
                      {section.is_active ? "Active" : "Inactive"}
                    </button>
                    <button
                      type="button"
                      disabled={
                        reorderingSection ||
                        sections.findIndex((item) => item.id === section.id) === 0
                      }
                      onClick={() => moveSection(section.id, "up")}
                      title="Move section up"
                    >
                      ↑
                    </button>

                    <button
                      type="button"
                      disabled={
                        reorderingSection ||
                        sections.findIndex((item) => item.id === section.id) ===
                        sections.length - 1
                      }
                      onClick={() => moveSection(section.id, "down")}
                      title="Move section down"
                    >
                      ↓
                    </button>
                  </div>
                </div>

                <p>
                  Fields:{" "}
                  {
                    fields.filter(
                      (field) =>
                        field.section_id === section.id
                    ).length
                  }
                </p>
                <div>
                  {fields
                    .filter((field) => field.section_id === section.id)
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((field) => (
                      <div key={field.id}>
                        <strong>{field.label}</strong>

                        <span>
                          {" "}({field.field_type})
                        </span>

                        {field.required && (
                          <span> — Required</span>
                        )}
                        {["file", "image", "images"].includes(
                          field.field_type
                        ) && (
                          <span>
                            {" "}— Max {Number(field.max_files) || 1} photo
                            {(Number(field.max_files) || 1) === 1 ? "" : "s"}
                          </span>
                        )}
                        <div className="field-order-buttons">
                          <button
                            type="button"
                            disabled={
                              reorderingField ||
                              fields
                                .filter((item) => item.section_id === field.section_id)
                                .sort((a, b) => a.sort_order - b.sort_order)
                                .findIndex((item) => item.id === field.id) === 0
                            }
                            onClick={() => moveField(field.id, "up")}
                            title="Move field up"
                          >
                            ↑
                          </button>

                          <button
                            type="button"
                            disabled={
                              reorderingField ||
                              fields
                                .filter((item) => item.section_id === field.section_id)
                                .sort((a, b) => a.sort_order - b.sort_order)
                                .findIndex((item) => item.id === field.id) ===
                              fields.filter(
                                (item) => item.section_id === field.section_id
                              ).length - 1
                            }
                            onClick={() => moveField(field.id, "down")}
                            title="Move field down"
                          >
                            ↓
                          </button>

                          <button
                            type="button"
                            className={`field-status-button ${field.is_active ? "active" : "inactive"
                              }`}
                            disabled={updatingFieldStatus}
                            onClick={() => toggleFieldStatus(field)}
                          >
                            {field.is_active ? "Active" : "Inactive"}
                          </button>
                        </div>

                        {field.placeholder && (
                          <p>Placeholder: {field.placeholder}</p>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setEditFieldForm({
                              id: field.id,
                              fieldKey: field.field_key || "",
                              label: field.label || "",
                              fieldType: field.field_type || "text",
                              placeholder: field.placeholder || "",
                              helperText: field.helper_text || "",
                              options: Array.isArray(field.options)
                                ? field.options.join(", ")
                                : field.options || "",
                              maxFiles: Number(field.max_files) || 1,
                              required: !!field.required,
                            });

                            setShowEditFieldForm(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteSectionTarget(section);
                            setShowDeleteSectionForm(true);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFieldFormSection(section);
                    setFieldForm({
                      fieldKey: "",
                      label: "",
                      fieldType: "text",
                      placeholder: "",
                      helperText: "",
                      options: "",
                      required: false,
                    });
                    setShowFieldForm(true);
                  }}
                >
                  + Add Field
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditSectionForm({
                      id: section.id,
                      title: section.title || "",
                      description: section.description || "",
                    });

                    setShowEditSectionForm(true);
                  }}
                >
                  Edit
                </button>


              </article>
            ))
          )}
          {showFieldForm && fieldFormSection && (
            <div
              className="fb-form-modal-overlay"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 10000,
                background: "rgba(0, 0, 0, 0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
                overflowY: "auto",
              }}
            >
              <div
                className="fb-form-modal"
                style={{
                  width: "100%",
                  maxWidth: "520px",
                  background: "#fff",
                  borderRadius: "18px",
                  padding: "24px",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
                }}
              >
                <h3>Add Field</h3>

                <p>
                  Section: <strong>{fieldFormSection.title}</strong>
                </p>

                <div>
                  <label>Field Key</label>
                  <input
                    type="text"
                    value={fieldForm.fieldKey}
                    placeholder="full_name"
                    onChange={(e) =>
                      setFieldForm((current) => ({
                        ...current,
                        fieldKey: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label>Field Label</label>
                  <input
                    type="text"
                    value={fieldForm.label}
                    placeholder="Full Name"
                    onChange={(e) =>
                      setFieldForm((current) => ({
                        ...current,
                        label: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label>Field Type</label>
                  <select
                    value={fieldForm.fieldType}
                    onChange={(e) =>
                      setFieldForm((current) => ({
                        ...current,
                        fieldType: e.target.value,
                        options:
                          e.target.value === "select"
                            ? current.options
                            : "",
                        maxFiles:
                          ["file", "image", "images"].includes(e.target.value)
                            ? current.maxFiles || 1
                            : 0,
                      }))
                    }
                  >
                    <option value="text">Text</option>
                    <option value="textarea">Long Text</option>
                    <option value="number">Number</option>
                    <option value="email">Email</option>
                    <option value="tel">Phone</option>
                    <option value="date">Date</option>
                    <option value="select">Select</option>
                    <option value="checkbox">Checkbox</option>
                    <option value="file">File / Image</option>
                    <option value="image">Single Photo</option>
                    <option value="images">Multiple Photos</option>
                    <option value="image">Single Photo</option>
                    <option value="images">Multiple Photos</option>
                  </select>
                </div>

                <div>
                  <label>Placeholder</label>
                  <input
                    type="text"
                    value={fieldForm.placeholder}
                    placeholder="Enter your name"
                    onChange={(e) =>
                      setFieldForm((current) => ({
                        ...current,
                        placeholder: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label>Helper Text</label>
                  <input
                    type="text"
                    value={fieldForm.helperText}
                    placeholder="Example: Enter the recipient's name"
                    onChange={(e) =>
                      setFieldForm((current) => ({
                        ...current,
                        helperText: e.target.value,
                      }))
                    }
                  />
                </div>

                {[
                  "file",
                  "image",
                  "images",
                ].includes(fieldForm.fieldType) && (
                  <div>
                    <label>Max upload count</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={fieldForm.maxFiles || 1}
                      onChange={(e) =>
                        setFieldForm((current) => ({
                          ...current,
                          maxFiles: Math.max(1, Number(e.target.value) || 1),
                        }))
                      }
                    />
                  </div>
                )}

                {fieldForm.fieldType === "select" && (
                  <div>
                    <label>Select Options</label>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        marginTop: "8px",
                      }}
                    >
                      {fieldForm.options
                        .split(",")
                        .map((option) => option.trim())
                        .filter(Boolean)
                        .map((option, index) => (
                          <div
                            key={index}
                            className="select-option-row"
                            style={{
                              display: "flex",
                              gap: "8px",
                              alignItems: "center",
                            }}
                          >
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => {
                                const rawOptions = fieldForm.options.split(",");

                                rawOptions[index] = e.target.value;

                                setFieldForm((current) => ({
                                  ...current,
                                  options: rawOptions.join(","),
                                }));
                              }}
                            />

                            <button
                              type="button"
                              onClick={() => {
                                const options = fieldForm.options
                                  .split(",")
                                  .map((item) => item.trim())
                                  .filter(Boolean);

                                options.splice(index, 1);

                                setFieldForm((current) => ({
                                  ...current,
                                  options: options.join(", "),
                                }));
                              }}
                            >
                              Remove
                            </button>
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => {
                                const options = fieldForm.options
                                  .split(",")
                                  .map((item) => item.trim())
                                  .filter(Boolean);

                                [options[index - 1], options[index]] = [
                                  options[index],
                                  options[index - 1],
                                ];

                                setFieldForm((current) => ({
                                  ...current,
                                  options: options.join(", "),
                                }));
                              }}
                            >
                              ↑
                            </button>

                            <button
                              type="button"
                              disabled={
                                index ===
                                fieldForm.options
                                  .split(",")
                                  .map((item) => item.trim())
                                  .filter(Boolean).length - 1
                              }
                              onClick={() => {
                                const options = fieldForm.options
                                  .split(",")
                                  .map((item) => item.trim())
                                  .filter(Boolean);

                                [options[index], options[index + 1]] = [
                                  options[index + 1],
                                  options[index],
                                ];

                                setFieldForm((current) => ({
                                  ...current,
                                  options: options.join(", "),
                                }));
                              }}
                            >
                              ↓
                            </button>
                          </div>
                        ))}
                    </div>

                    <button
                      type="button"
                      onClick={addSelectOption}
                      style={{ marginTop: "8px" }}
                    >
                      + Add Option
                    </button>

                    <small>
                      Add, edit, or remove options. Their order is preserved.
                    </small>
                  </div>
                )}

                <div>
                  <label>
                    <input
                      type="checkbox"
                      checked={fieldForm.required}
                      onChange={(e) =>
                        setFieldForm((current) => ({
                          ...current,
                          required: e.target.checked,
                        }))
                      }
                    />
                    {" "}Required field
                  </label>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    marginTop: "20px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowFieldForm(false);
                      setFieldFormSection(null);
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (!fieldForm.fieldKey.trim()) {
                        setError("Field key is required.");
                        return;
                      }

                      if (!fieldForm.label.trim()) {
                        setError("Field label is required.");
                        return;
                      }

                      const options =
                        fieldForm.fieldType === "select"
                          ? fieldForm.options
                            .split(",")
                            .map((option) => option.trim())
                            .filter(Boolean)
                          : null;

                      try {
                        await callApi("create_field", {
                          section_id: fieldFormSection.id,
                          field_key: fieldForm.fieldKey.trim(),
                          label: fieldForm.label.trim(),
                          field_type: fieldForm.fieldType,
                          placeholder:
                            fieldForm.placeholder.trim(),
                          helper_text:
                            fieldForm.helperText.trim(),
                          required: fieldForm.required,
                          options,
                          max_files:
                            ["file", "image", "images"].includes(
                              fieldForm.fieldType
                            )
                              ? Number(fieldForm.maxFiles) || 1
                              : null,
                          sort_order:
                            fields.filter(
                              (field) =>
                                field.section_id ===
                                fieldFormSection.id
                            ).length,
                          is_active: true,
                        });

                        setShowFieldForm(false);
                        setFieldFormSection(null);

                        setMessage("Field created successfully.");

                        await loadForm(selectedVersion);
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Failed to create field."
                        );
                      }
                    }}
                  >
                    Create Field
                  </button>
                </div>
              </div>
            </div>
          )}
          {showEditFieldForm && (
            <div
              className="fb-form-modal-overlay"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 10001,
                background: "rgba(0,0,0,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
                overflowY: "auto",
              }}
            >
              <div
                className="fb-form-modal"
                style={{
                  width: "100%",
                  maxWidth: "520px",
                  background: "#fff",
                  borderRadius: "18px",
                  padding: "24px",
                }}
              >
                <h3>Edit Field</h3>

                <div>
                  <label>Field Key</label>
                  <input
                    type="text"
                    value={editFieldForm.fieldKey}
                    onChange={(e) =>
                      setEditFieldForm((current) => ({
                        ...current,
                        fieldKey: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label>Field Label</label>
                  <input
                    type="text"
                    value={editFieldForm.label}
                    onChange={(e) =>
                      setEditFieldForm((current) => ({
                        ...current,
                        label: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label>Field Type</label>
                  <select
                    value={editFieldForm.fieldType}
                    onChange={(e) =>
                      setEditFieldForm((current) => ({
                        ...current,
                        fieldType: e.target.value,
                          maxFiles:
                            ["file", "image", "images"].includes(e.target.value)
                              ? current.maxFiles || 1
                              : 0,
                        }))
                      }
                  >
                    <option value="text">Text</option>
                    <option value="textarea">Long Text</option>
                    <option value="number">Number</option>
                    <option value="email">Email</option>
                    <option value="tel">Phone</option>
                    <option value="date">Date</option>
                    <option value="select">Select</option>
                    <option value="checkbox">Checkbox</option>
                    <option value="file">File / Image</option>
                    <option value="image">Single Photo</option>
                    <option value="images">Multiple Photos</option>
                  </select>
                </div>

                <div>
                  <label>Placeholder</label>
                  <input
                    type="text"
                    value={editFieldForm.placeholder}
                    onChange={(e) =>
                      setEditFieldForm((current) => ({
                        ...current,
                        placeholder: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label>Helper Text</label>
                  <input
                    type="text"
                    value={editFieldForm.helperText}
                    onChange={(e) =>
                      setEditFieldForm((current) => ({
                        ...current,
                        helperText: e.target.value,
                      }))
                    }
                  />
                </div>

                {[
                  "file",
                  "image",
                  "images",
                ].includes(editFieldForm.fieldType) && (
                  <div>
                    <label>Max upload count</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={editFieldForm.maxFiles || 1}
                      onChange={(e) =>
                        setEditFieldForm((current) => ({
                          ...current,
                          maxFiles: Math.max(1, Number(e.target.value) || 1),
                        }))
                      }
                    />
                  </div>
                )}

                {editFieldForm.fieldType === "select" && (
                  <div>
                    <label>Select Options</label>
                    <input
                      type="text"
                      value={editFieldForm.options}
                      placeholder="Mom, Dad, Sister, Brother"
                      onChange={(e) =>
                        setEditFieldForm((current) => ({
                          ...current,
                          options: e.target.value,
                        }))
                      }
                    />
                  </div>
                )}

                <div>
                  <label>
                    <input
                      type="checkbox"
                      checked={editFieldForm.required}
                      onChange={(e) =>
                        setEditFieldForm((current) => ({
                          ...current,
                          required: e.target.checked,
                        }))
                      }
                    />
                    {" "}Required field
                  </label>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    marginTop: "20px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowEditFieldForm(false)}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (!editFieldForm.fieldKey.trim()) {
                        setError("Field key is required.");
                        return;
                      }

                      if (!editFieldForm.label.trim()) {
                        setError("Field label is required.");
                        return;
                      }

                      const options =
                        editFieldForm.fieldType === "select"
                          ? editFieldForm.options
                            .split(",")
                            .map((option) => option.trim())
                            .filter(Boolean)
                          : null;

                      try {
                        await callApi("update_field", {
                          id: editFieldForm.id,
                          field_key: editFieldForm.fieldKey.trim(),
                          label: editFieldForm.label.trim(),
                          field_type: editFieldForm.fieldType,
                          placeholder: editFieldForm.placeholder.trim(),
                          helper_text:
                            editFieldForm.helperText.trim(),
                          required: editFieldForm.required,
                          options,
                          max_files: [
                            "file",
                            "image",
                            "images",
                          ].includes(editFieldForm.fieldType)
                            ? Number(editFieldForm.maxFiles) || 1
                            : null,
                        });

                        setShowEditFieldForm(false);

                        setMessage("Field updated successfully.");

                        await loadForm(selectedVersion);
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Failed to update field."
                        );
                      }
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
          {showEditSectionForm && (
            <div
              className="fb-form-modal-overlay"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 10002,
                background: "rgba(0,0,0,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
                overflowY: "auto",
              }}
            >
              <div
                className="fb-form-modal"
                style={{
                  width: "100%",
                  maxWidth: "520px",
                  background: "#fff",
                  borderRadius: "18px",
                  padding: "24px",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
                }}
              >
                <h3>Edit Section</h3>

                <div>
                  <label>Section Title</label>

                  <input
                    type="text"
                    value={editSectionForm.title}
                    placeholder="Personal Details"
                    onChange={(e) =>
                      setEditSectionForm((current) => ({
                        ...current,
                        title: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label>Section Description</label>

                  <textarea
                    rows={4}
                    value={editSectionForm.description}
                    placeholder="Enter a description for this section"
                    onChange={(e) =>
                      setEditSectionForm((current) => ({
                        ...current,
                        description: e.target.value,
                      }))
                    }
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    marginTop: "20px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditSectionForm(false);
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (!editSectionForm.title.trim()) {
                        setError("Section title is required.");
                        return;
                      }

                      try {
                        await callApi("update_section", {
                          id: editSectionForm.id,
                          title: editSectionForm.title.trim(),
                          description:
                            editSectionForm.description.trim(),
                        });

                        setShowEditSectionForm(false);

                        setMessage(
                          "Section updated successfully."
                        );

                        await loadForm(selectedVersion);
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Failed to update section."
                        );
                      }
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
          {showSectionForm && (
            <div
              className="fb-form-modal-overlay"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 10003,
                background: "rgba(0,0,0,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
                overflowY: "auto",
              }}
            >
              <div
                className="fb-form-modal"
                style={{
                  width: "100%",
                  maxWidth: "520px",
                  background: "#fff",
                  borderRadius: "18px",
                  padding: "24px",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
                }}
              >
                <h3>Add Section</h3>

                <div>
                  <label>Section Title</label>

                  <input
                    type="text"
                    value={sectionForm.title}
                    placeholder="Personal Details"
                    onChange={(e) =>
                      setSectionForm((current) => ({
                        ...current,
                        title: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label>Section Description</label>

                  <textarea
                    rows={4}
                    value={sectionForm.description}
                    placeholder="Enter a description for this section"
                    onChange={(e) =>
                      setSectionForm((current) => ({
                        ...current,
                        description: e.target.value,
                      }))
                    }
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    marginTop: "20px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowSectionForm(false);
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (!sectionForm.title.trim()) {
                        setError("Section title is required.");
                        return;
                      }

                      try {
                        await callApi("create_section", {
                          template_version_id: selectedVersion,
                          title: sectionForm.title.trim(),
                          description:
                            sectionForm.description.trim(),
                          sort_order: sections.length,
                          is_active: true,
                        });

                        setShowSectionForm(false);

                        setMessage(
                          "Section created successfully."
                        );

                        await loadForm(selectedVersion);
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Failed to create section."
                        );
                      }
                    }}
                  >
                    Create Section
                  </button>
                </div>
              </div>
            </div>
          )}
          {showDeleteSectionForm && deleteSectionTarget && (
            <div className="fb-modal-overlay">
              <div className="fb-modal">
                <h3>Delete Section?</h3>

                <p>
                  Are you sure you want to delete{" "}
                  <strong>{deleteSectionTarget.title}</strong>?
                </p>

                <p>
                  This will also remove the fields inside this section.
                </p>

                <div className="fb-modal-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteSectionForm(false);
                      setDeleteSectionTarget(null);
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setError("");
                        setMessage("");

                        await callApi("delete_section", {
                          id: deleteSectionTarget.id,
                        });

                        setMessage("Section deleted successfully.");

                        setShowDeleteSectionForm(false);
                        setDeleteSectionTarget(null);

                        await loadForm(selectedVersion);
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Failed to delete section."
                        );
                      }
                    }}
                  >
                    Delete Section
                  </button>
                </div>
              </div>
            </div>
          )}
          {showDeleteFieldForm && deleteFieldTarget && (
            <div className="fb-modal-overlay">
              <div className="fb-modal">
                <h3>Delete Field?</h3>

                <p>
                  Are you sure you want to delete{" "}
                  <strong>{deleteFieldTarget.label}</strong>?
                </p>

                <div className="fb-modal-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteFieldForm(false);
                      setDeleteFieldTarget(null);
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setError("");
                        setMessage("");

                        await callApi("delete_field", {
                          id: deleteFieldTarget.id,
                        });

                        setMessage("Field deleted successfully.");

                        setShowDeleteFieldForm(false);
                        setDeleteFieldTarget(null);

                        await loadForm(selectedVersion);
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Failed to delete field."
                        );
                      }
                    }}
                  >
                    Delete Field
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default FormBuilder;