export const uid = () => crypto.randomUUID();

export const slug = (s) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const finalPrice = (t) => {
  const p = Number(t?.price) || 0;
  const d = Math.min(
    100,
    Math.max(0, Number(t?.discount_percentage) || 0)
  );

  return Math.round((p - (p * d) / 100) * 100) / 100;
};