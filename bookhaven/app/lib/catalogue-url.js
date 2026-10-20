// URL helpers for the catalogue. Pure functions so server components and
// client controls build exactly the same links.

export function catalogueParams({ q = "", category = "", sort = "", price = "", availability = "", page = "" } = {}) {
  return { q, category, sort, price, availability, page };
}

/** Build a catalogue URL, dropping empty/default parameters. */
export function buildCatalogueHref(basePath, current = {}, patch = {}) {
  const merged = { ...current, ...patch };
  const params = new URLSearchParams();

  if (merged.q) params.set("q", String(merged.q).trim());
  if (merged.category) params.set("category", merged.category);
  if (merged.sort && merged.sort !== "newest") params.set("sort", merged.sort);
  if (merged.price) params.set("price", merged.price);
  if (merged.availability) params.set("availability", merged.availability);
  if (merged.page && Number(merged.page) > 1) params.set("page", String(merged.page));

  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export function hasActiveFilters(params = {}) {
  return Boolean(params.q || params.category || params.price || params.availability);
}

export function activeFilterCount(params = {}) {
  return [params.q, params.category, params.price, params.availability].filter(Boolean).length;
}
