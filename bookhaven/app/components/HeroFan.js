"use client";

import Link from "next/link";

import { BookCover } from "./BookCover";
import { bookPath } from "../lib/book-url";

/**
 * The hero's fan of featured covers.
 *
 * Three books only, held open like a hand fan: the middle one upright,
 * slightly larger and in front, the two either side tilted away from it. The
 * tilt, the overlap and the cover size are all CSS variables (see the "hero
 * fan" block in globals.css), so the same markup gets smaller and flatter as
 * the screen narrows — a phone never gets a fan big enough to run off the
 * side, and every cover keeps its 2:3 shape because BookCover owns it.
 *
 * The whole fan is a group of three links, not one link: each cover opens its
 * own book, which is what someone tapping it expects.
 */
export function HeroFan({ books }) {
  // Three is what fits in a fan without the outer covers crowding the text
  // column, and it is what the brief asks for.
  const covers = books.slice(0, 3);
  if (covers.length === 0) return null;

  // With fewer than three titles in the catalogue the fan would be lopsided,
  // so it degrades to a plain row instead of pretending to be a full fan.
  const layout =
    covers.length === 3 ? ["fan-leaf--l", "fan-leaf--c", "fan-leaf--r"] : covers.length === 2 ? ["fan-leaf--l", "fan-leaf--r"] : ["fan-leaf--c"];

  return (
    <div className="fan" role="group" aria-label="Featured books">
      {covers.map((book, index) => (
        <Link
          key={book.id}
          href={bookPath(book)}
          className={`fan-leaf ${layout[index]} block overflow-hidden rounded-r-md book-shadow`}
          aria-label={`${book.title} by ${book.author}`}
        >
          <BookCover
            book={book}
            className="w-full"
            // The middle cover is the hero image: it is above the fold on
            // every screen, so it loads first. The outer two are one tap away.
            priority={index === 1}
            sizes="(min-width: 1280px) 190px, (min-width: 1024px) 170px, (min-width: 640px) 145px, 105px"
          />
        </Link>
      ))}
    </div>
  );
}

export default HeroFan;
