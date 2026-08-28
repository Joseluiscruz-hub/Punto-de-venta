const LOCAL_CATALOG_IMAGE_PATTERN = /^\/?AB-.+\.png([?#].*)?$/i;

function withBasePath(src: string) {
  const trimmed = src.trim();
  if (
    !trimmed ||
    /^(https?:)?\/\//i.test(trimmed) ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  if (!trimmed.startsWith('/')) return trimmed;
  const base = String(import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return `${base}${trimmed}`;
}

export function optimizedCatalogImageSrc(src: string) {
  const trimmed = src.trim();
  const converted = LOCAL_CATALOG_IMAGE_PATTERN.test(trimmed)
    ? trimmed.replace(/\.png(?=([?#].*)?$)/i, '.webp')
    : trimmed;
  return withBasePath(converted);
}
