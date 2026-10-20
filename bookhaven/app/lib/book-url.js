// Book URL maths only — no Supabase import, so client components can use it
// without pulling the database client into their bundle.

export function slugifyTitle(title) {
  return (
    String(title || "book")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "book"
  );
}

export function bookSlug(book) {
  return `${slugifyTitle(book.title)}-${book.id}`;
}

export function bookPath(book) {
  return `/books/${bookSlug(book)}`;
}

/** Extract the database id from a slug, or from a bare id for old links. */
export function parseBookSlug(slug) {
  const match = String(slug || "").match(/(\d+)$/);
  return match ? Number(match[1]) : null;
}
