export async function optimizeImage(file) {
  if (!file.type.startsWith("image/")) return file;

  const MAX_SIZE = 1400;
  const QUALITY = 0.82;

  const bitmap = await createImageBitmap(file);

  let width = bitmap.width;
  let height = bitmap.height;

  if (width > MAX_SIZE || height > MAX_SIZE) {
    const scale = Math.min(MAX_SIZE / width, MAX_SIZE / height);

    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", {
    alpha: false,
  });

  ctx.drawImage(bitmap, 0, 0, width, height);

  bitmap.close();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result
          ? resolve(result)
          : reject(new Error("Image compression failed")),
      "image/webp",
      QUALITY
    );
  });

  return new File(
    [blob],
    file.name.replace(/\.[^/.]+$/, "") + ".webp",
    {
      type: "image/webp",
      lastModified: Date.now(),
    }
  );
}

export async function optimizeTemplateImage(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please select an image file.");
  }

  const MAX_SIZE = 1400;
  const QUALITY = 0.82;

  const bitmap = await createImageBitmap(file);

  let width = bitmap.width;
  let height = bitmap.height;

  if (width > MAX_SIZE || height > MAX_SIZE) {
    const scale = Math.min(MAX_SIZE / width, MAX_SIZE / height);

    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  ctx.drawImage(bitmap, 0, 0, width, height);

  bitmap.close();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Image compression failed"));
      },
      "image/webp",
      QUALITY
    );
  });

  return new File(
    [blob],
    file.name.replace(/\.[^/.]+$/, "") + ".webp",
    {
      type: "image/webp",
      lastModified: Date.now(),
    }
  );
}