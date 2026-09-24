import "../styles/dynamic-field.css";

function DynamicField({
  field,
  value,
  onChange,
}) {
  if (!field) return null;

  const {
    field_key,
    label,
    placeholder,
    helper_text,
    field_type,
    required,
    options,
  } = field;

  const commonProps = {
    id: field_key,
    name: field_key,
    value: value ?? "",
    onChange: (event) => onChange(field_key, event.target.value),
    required: Boolean(required),
    placeholder: placeholder || "",
  };

    return (
    <div className="dynamic-field">
      {field_type === "checkbox" ? (
        <>
          <label className="dynamic-checkbox-label">
            <input
              id={field_key}
              name={field_key}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(event) =>
                onChange(field_key, event.target.checked)
              }
              required={Boolean(required)}
            />

            <span>
              {label}
              {required && (
                <span aria-hidden="true"> *</span>
              )}
            </span>
          </label>

          {helper_text && (
            <small className="field-helper">
              {helper_text}
            </small>
          )}
        </>
      ) : (
        <>
          {label && (
            <label htmlFor={field_key}>
              {label}
              {required && (
                <span aria-hidden="true"> *</span>
              )}
            </label>
          )}

          {field_type === "textarea" ? (
            <textarea
              {...commonProps}
              rows={5}
            />
          ) : field_type === "select" ? (
            <select {...commonProps}>
              <option value="">Select...</option>

              {(Array.isArray(options)
                ? options
                : []
              ).map((option) => {
                const optionValue =
                  typeof option === "object"
                    ? option.value
                    : option;

                const optionText =
                  typeof option === "object"
                    ? option.label
                    : option;

                return (
                  <option
                    key={String(optionValue)}
                    value={optionValue}
                  >
                    {optionText}
                  </option>
                );
              })}
            </select>
          ) : field_type === "file" ? (
  <input
    id={field_key}
    name={field_key}
    type="file"
    required={Boolean(required)}
    onChange={(event) =>
      onChange(
        field_key,
        event.target.files?.[0] || null
      )
    }
  />
) : (
  <input
    {...commonProps}
    type={field_type || "text"}
  />
)}

          {helper_text && (
            <small className="field-helper">
              {helper_text}
            </small>
          )}
        </>
      )}
    </div>
  );
}

export default DynamicField;