import { useRef, useState } from "react";

function ImageUpload({
  label = "Upload image",
  multiple = false,
  maxFiles = 8,
  onChange,
}) {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);

  function handleFiles(event) {
    const selected = Array.from(event.target.files || []);

    const limited = multiple
      ? selected.slice(0, maxFiles)
      : selected.slice(0, 1);

    setFiles(limited);

    if (onChange) {
      onChange(multiple ? limited : limited[0] || null);
    }
  }

  function removeFile(index) {
    const updated = files.filter(
      (_, fileIndex) => fileIndex !== index
    );

    setFiles(updated);

    if (onChange) {
      onChange(multiple ? updated : updated[0] || null);
    }
  }

  return (
    <div className="image-upload">
      <label>{label}</label>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={handleFiles}
      />

      {files.length > 0 && (
        <div className="image-upload-list">
          {files.map((file, index) => (
            <div
              className="image-upload-item"
              key={`${file.name}-${index}`}
            >
              <span>{file.name}</span>

              <button
                type="button"
                onClick={() => removeFile(index)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ImageUpload;