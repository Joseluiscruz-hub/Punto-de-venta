const LOCAL_CATALOG_IMAGE_PATTERN = /^\/?AB-.+\.png([?#].*)?$/i;

export function optimizedCatalogImageSrc(src: string) {
  const trimmed = src.trim();
  if (!LOCAL_CATALOG_IMAGE_PATTERN.test(trimmed)) return trimmed;

  return trimmed.replace(/\.png(?=([?#].*)?$)/i, '.webp');
}
