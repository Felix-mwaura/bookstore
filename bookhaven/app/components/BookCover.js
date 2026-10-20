"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * BookCover — the uploaded cover when there is one, otherwise a generated
 * CSS cover built from the book's own colours.
 *
 * The wrapper always owns the 2:3 aspect ratio, so a grid never reflows when
 * an image finishes loading or fails: the space is reserved up front.
 */
export function BookCover({ book, className = "", style = {}, sizes = "(min-width: 1024px) 220px, (min-width: 640px) 30vw, 45vw", priority = false }) {
  const [imgFailed, setImgFailed] = useState(false);
  const { bg, accent, pattern } = book.cover ?? { bg: "#1B2A4A", accent: "#B5532F", pattern: "dots" };

  if (book.cover_url && !imgFailed) {
    return (
      <div className={`relative overflow-hidden select-none bg-subtle aspect-[2/3] ${className}`} style={style}>
        <Image
          src={book.cover_url}
          alt={`Cover of ${book.title} by ${book.author}`}
          fill
          sizes={sizes}
          priority={priority}
          onError={() => setImgFailed(true)}
          className="object-cover"
        />
        <div
          className="absolute left-0 top-0 bottom-0 w-3 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to right, rgba(0,0,0,0.35), rgba(0,0,0,0.08) 60%, transparent)" }}
          aria-hidden="true"
        />
      </div>
    );
  }

  const patternSvg = {
    dots: `radial-gradient(circle, ${accent}22 1.5px, transparent 1.5px)`,
    lines: `repeating-linear-gradient(45deg, ${accent}18 0px, ${accent}18 1px, transparent 1px, transparent 12px)`,
    diagonal: `repeating-linear-gradient(-45deg, ${accent}15 0px, ${accent}15 1px, transparent 1px, transparent 14px)`,
    grid: `linear-gradient(${accent}18 1px, transparent 1px), linear-gradient(90deg, ${accent}18 1px, transparent 1px)`,
    circles: `radial-gradient(ellipse at 30% 20%, ${accent}30 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, ${accent}20 0%, transparent 50%)`,
  };
  const patternSize = { dots: "12px 12px", lines: "16px 16px", diagonal: "18px 18px", grid: "18px 18px", circles: "100% 100%" };

  // Typographic cover: text is real, so it stays selectable and legible.
  return (
    <div
      className={`relative overflow-hidden select-none aspect-[2/3] ${className}`}
      style={{ backgroundColor: bg, backgroundImage: patternSvg[pattern], backgroundSize: patternSize[pattern], ...style }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-3 z-10"
        style={{ background: "linear-gradient(to right, rgba(0,0,0,0.35), rgba(0,0,0,0.08) 60%, transparent)" }}
        aria-hidden="true"
      />
      <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: accent }} aria-hidden="true" />
      <div className="relative z-20 h-full flex flex-col justify-between p-3 sm:p-4">
        <span
          className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-sm self-start"
          style={{ backgroundColor: `${accent}30`, color: accent }}
        >
          {book.category}
        </span>
        <div>
          <p
            className="font-bold leading-tight mb-1 text-white line-clamp-4"
            style={{ fontFamily: "var(--font-playfair)", fontSize: "clamp(0.65rem, 2.6vw, 0.95rem)" }}
          >
            {book.title}
          </p>
          <p className="text-[8px] sm:text-[9px] font-medium tracking-wide" style={{ color: `${accent}cc` }}>
            {book.author}
          </p>
        </div>
      </div>
    </div>
  );
}

export default BookCover;
