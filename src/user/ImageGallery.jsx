function ImageGallery({
  images = [],
  onRemove,
}) {
  if (!images.length) {
    return null;
  }

  return (
    <div className="image-gallery">
      {images.map((image, index) => {
        const src =
          typeof image === "string"
            ? image
            : image?.previewUrl || image?.url;

        if (!src) return null;

        return (
          <div
            className="image-gallery-item"
            key={`${src}-${index}`}
          >
            <img
              src={src}
              alt={`Memory ${index + 1}`}
            />

            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(index)}
              >
                Remove
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ImageGallery;