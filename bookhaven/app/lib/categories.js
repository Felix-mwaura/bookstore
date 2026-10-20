// The shelf taxonomy. Kept free of React so both server and client code
// (including the search dropdown) can use it without a circular import.

export const categories = [
  "All",
  "Self-Help",
  "Finance",
  "Productivity",
  "Psychology",
  "History",
  "Philosophy",
  "Fiction",
  "Biography",
];

export const categoryIcons = {
  All: "🏠",
  "Self-Help": "🌱",
  Finance: "💰",
  Productivity: "⚡",
  Psychology: "🧠",
  History: "🏛️",
  Philosophy: "💭",
  Fiction: "✨",
  Biography: "👤",
};

/** "Self-Help" → "self-help" */
export function categorySlug(name) {
  return String(name).toLowerCase().replace(/\s+/g, "-");
}

/** "self-help" → "Self-Help", or null when nothing matches. */
export function categoryFromSlug(slug) {
  return categories.find((c) => c !== "All" && categorySlug(c) === slug) || null;
}
