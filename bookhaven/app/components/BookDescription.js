"use client";

import { useState } from "react";

/**
 * Long descriptions are clamped to five lines with an explicit control.
 * The full text is always in the DOM, so search engines and screen readers
 * see all of it.
 */
export default function BookDescription({ text }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;

  const long = text.length > 320;

  return (
    <div className="mt-8">
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted">About this book</h2>
      <p
        id="book-description"
        className={`mt-2 text-[15px] leading-relaxed text-ink ${!expanded && long ? "line-clamp-[5]" : ""}`}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls="book-description"
          className="mt-2 text-sm font-semibold text-sienna underline underline-offset-2 hover:text-sienna-hover"
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}
