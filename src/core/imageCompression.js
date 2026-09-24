const MAX_IMAGE_BYTES = 100 * 1024;
const TARGET_QUALITY = 0.82;
const MIN_QUALITY = 0.45;
const MAX_DIMENSION = 2400;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Unable to read ${file.name}.`));
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to convert image."));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

export async function compressImage(file) {
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    throw new Error(`${file?.name || "Selected file"} is not a supported image.`);
  }

  const image = await loadImage(file);
  const initialScale = Math.min(
    1,
    MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight)
  );

  let width = Math.max(1, Math.round(image.naturalWidth * initialScale));
  let height = Math.max(1, Math.round(image.naturalHeight * initialScale));
  let quality = TARGET_QUALITY;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("Your browser cannot convert this image.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, quality);
    if (blob.size <= MAX_IMAGE_BYTES) {
      const extension = file.name.replace(/\.[^/.]+$/, "") || "image";
      return new File([blob], `${extension}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    }

    if (quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - 0.08);
    } else {
      width = Math.max(320, Math.round(width * 0.82));
      height = Math.max(320, Math.round(height * 0.82));
    }
  }

  throw new Error(`${file.name} could not be converted below 100 KB.`);
}
