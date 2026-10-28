"use client";

import { createContext, useContext } from "react";

import { categories, categorySlug } from "../lib/categories";

// The genre list reaches client components through here instead of through an
// import, so it can be whatever the database currently says (see
// app/lib/genres-data.js) while still having a value on the very first render.
//
// The default is the built-in list rather than `[]`: a component rendered
// outside the provider (a test, a story, a page added later) keeps working,
// and the server-rendered markup always has a complete nav in it.

const FALLBACK = categories
  .filter((name) => name !== "All")
  .map((name) => ({ name, slug: categorySlug(name) }));

const GenreContext = createContext(FALLBACK);

export function GenreProvider({ genres, children }) {
  const value = Array.isArray(genres) && genres.length > 0 ? genres : FALLBACK;
  return <GenreContext.Provider value={value}>{children}</GenreContext.Provider>;
}

/** `[{ name, slug }]`, never empty. */
export function useGenres() {
  return useContext(GenreContext);
}

export { FALLBACK as FALLBACK_GENRES };
