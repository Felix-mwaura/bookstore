"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import SectionHeading from "./SectionHeading";
import { genreArtwork, genreBlurb } from "../lib/genres";

// How far a finger (or mouse) must travel before a press becomes a swipe
// rather than a tap on a genre.
const DRAG_THRESHOLD = 56;

// Below this a movement is a wobble, not a gesture: thumbs roll a few pixels
// on every tap, and treating that as a swipe is how a "click" on a genre ends
// up doing nothing at all.
const DRAG_SLOP = 12;

// Cards beyond this distance from the active one are not rendered at all.
const VISIBLE_DEPTH = 2;

const wrap = (index, length) => ((index % length) + length) % length;

/**
 * Shortest signed distance from the active card to `index`, going around the
 * loop — so the card "one place before" the first is the last one, not -7.
 */
function loopOffset(index, active, length) {
  const raw = index - active;
  const half = length / 2;
  if (raw > half) return raw - length;
  if (raw < -half) return raw + length;
  return raw;
}

/**
 * The genre deck.
 *
 * Cards are laid out by their signed distance from the active one: 0 in the
 * middle and upright, ±1 tucked behind at an angle, ±2 further back and only
 * shown where there is width for them. Because the distance is computed on a
 * loop, "previous" from the first genre is the last one — the deck cycles in
 * both directions without the underlying list ever changing order.
 *
 * Interaction rules, in order of how much they matter:
 *   • a tap or click on a card is always a navigation, never a swipe;
 *   • a horizontal drag moves the deck with the finger and advances on
 *     release; a vertical drag is left to the browser so the page still
 *     scrolls normally (touch-action: pan-y on the stage);
 *   • the arrows and the dots are ordinary buttons, and the whole region
 *     answers Left/Right arrow keys.
 */
export function GenreCarousel({ genres = [], counts = {} }) {
  // `genres` are { name, slug } pairs from the storefront's genre list (see
  // GenreProvider). The slug comes from the database, not from re-deriving it
  // here, so a genre whose name contains "&" links to the address the
  // catalogue actually serves.
  const length = genres.length;
  const [active, setActive] = useState(0);
  const [dragging, setDragging] = useState(false);
  // A card whose image 404s falls back to the plain panel rather than showing
  // a broken-image glyph on a navy rectangle.
  const [brokenArt, setBrokenArt] = useState({});

  // Derived, not stored: the list can change under a mounted deck (a genre
  // added or removed in the admin, then a soft navigation), and an index that
  // points past the end would leave no card at distance 0 — an empty stage
  // rather than a deck.
  const activeIndex = length === 0 ? 0 : Math.min(active, length - 1);

  const deckRef = useRef(null);
  const drag = useRef({ active: false, startX: 0, startY: 0, dx: 0, moved: false });
  // True from the moment a press turns into a swipe until the click that
  // follows it has been swallowed. Cleared at the start of the next press, so
  // it can never outlive the gesture it belongs to — the old version cleared
  // it on a zero-delay timer, which fires before some browsers dispatch the
  // click, letting a completed swipe navigate anyway.
  const suppressClick = useRef(false);

  const step = useCallback(
    (delta) => setActive((current) => wrap(current + delta, Math.max(length, 1))),
    [length]
  );

  // ── pointer / touch ────────────────────────────────────
  const onPointerDown = (event) => {
    // Every new gesture starts honest: whatever the last one suppressed is
    // over by definition.
    suppressClick.current = false;
    if (length < 2) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // The arrows and the dots are ordinary buttons inside this region. A
    // press on one of them is never the start of a swipe, so it must not be
    // armed as one — otherwise a finger that drifts sideways on its way to a
    // dot had its tap cancelled by drag logic.
    if (event.target?.closest?.(".genre-controls")) return;
    drag.current = { active: true, startX: event.clientX, startY: event.clientY, dx: 0, moved: false };
  };

  const onPointerMove = (event) => {
    const state = drag.current;
    if (!state.active) return;

    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;

    if (!state.moved) {
      // Ignore presses that are mostly vertical: that gesture belongs to the
      // page scroller, not to the deck.
      if (Math.abs(dx) < DRAG_SLOP || Math.abs(dx) <= Math.abs(dy)) return;
      state.moved = true;
      suppressClick.current = true;
      setDragging(true);
    }

    state.dx = dx;
    // Written straight to the node: a React state update per pointermove
    // would re-render the deck on every frame of the swipe.
    deckRef.current?.style.setProperty("--drag", `${dx}px`);
  };

  const endDrag = (event, { cancelled = false } = {}) => {
    const state = drag.current;
    if (!state.active) return;
    state.active = false;

    deckRef.current?.style.setProperty("--drag", "0px");
    if (state.moved) setDragging(false);

    if (cancelled) {
      suppressClick.current = false;
      return;
    }

    if (state.moved && Math.abs(state.dx) > DRAG_THRESHOLD) {
      step(state.dx < 0 ? 1 : -1);
    }
    // The click that follows a swipe on a card must not navigate. It is
    // swallowed by onClickCapture below, which is also what clears it.
    if (event?.pointerType === "mouse") state.dx = 0;
  };

  const onClickCapture = (event) => {
    if (!suppressClick.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick.current = false;
  };

  const onKeyDown = (event) => {
    if (length < 2) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    }
  };

  if (length === 0) return null;

  const cards = genres
    .map((genre, index) => ({ ...genre, index, distance: loopOffset(index, activeIndex, length) }))
    .filter((card) => Math.abs(card.distance) <= VISIBLE_DEPTH)
    // Painted back to front so the active card is on top even in browsers
    // that ignore z-index on transformed elements.
    .sort((a, b) => Math.abs(b.distance) - Math.abs(a.distance));

  return (
    <section id="genres" aria-labelledby="genres-title" className="border-b border-line bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <SectionHeading
          eyebrow="Browse"
          title="Explore Books in Your Favorite Genre"
          description="Swipe the shelf, or tap a genre to see everything on it."
          action={{ href: "/books", label: "All books" }}
          id="genres-title"
          className="mb-6 sm:mb-8"
        />

        <div
          className="genre-region"
          role="group"
          aria-roledescription="carousel"
          aria-label="Book genres"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={(event) => endDrag(event, { cancelled: true })}
          onPointerLeave={(event) => {
            // A mouse that leaves mid-swipe should not leave the deck offset.
            if (drag.current.active && event.pointerType === "mouse") endDrag(event);
          }}
          onClickCapture={onClickCapture}
          onDragStart={(event) => event.preventDefault()}
          onKeyDown={onKeyDown}
        >
          <div
            ref={deckRef}
            className="genre-stage"
            data-dragging={dragging ? "true" : "false"}
            style={{ "--gc-count": length }}
          >
            {cards.map(({ name, slug, image_url: uploaded, distance }) => {
              const count = counts[name] || 0;
              // The admin's own image wins; otherwise the artwork bundled for
              // this slug, if this shop has any; otherwise the plain panel.
              const art = uploaded ? { src: uploaded } : genreArtwork(slug);
              const showArt = art && !brokenArt[slug];
              const depth = Math.abs(distance);
              const scale = depth === 0 ? 1 : depth === 1 ? 0.84 : 0.68;
              const opacity = depth === 0 ? 1 : depth === 1 ? 0.96 : 0.72;

              return (
                <Link
                  key={slug}
                  href={`/category/${slug}`}
                  className="genre-card"
                  data-depth={depth}
                  aria-label={count > 0 ? `${name}, ${count} ${count === 1 ? "book" : "books"}` : name}
                  aria-current={depth === 0 ? "true" : undefined}
                  tabIndex={depth <= 1 ? 0 : -1}
                  draggable={false}
                  style={{
                    // Only the distance is data; how far apart that puts the
                    // cards is a CSS decision (--gc-step).
                    "--d": distance,
                    "--s": scale,
                    "--r": `${distance * 5}deg`,
                    "--o": opacity,
                    "--z": 30 - depth * 10,
                  }}
                >
                  {showArt ? (
                    <Image
                      src={art.src}
                      alt=""
                      fill
                      onError={() => setBrokenArt((current) => ({ ...current, [slug]: true }))}
                      // The card's own width, so the browser asks the
                      // optimiser for the smallest rendition that is still
                      // sharp — 256px on a phone, 640px on a desktop.
                      sizes="(min-width: 1024px) 380px, (min-width: 640px) 330px, 250px"
                      className="object-cover"
                      draggable={false}
                    />
                  ) : (
                    <span className="genre-card-plain" aria-hidden="true">
                      <span className="font-playfair text-5xl italic">{name.charAt(0)}</span>
                    </span>
                  )}

                  <span className="genre-card-scrim" aria-hidden="true" />

                  <span className="genre-card-body">
                    <span className="genre-card-name">{name}</span>
                    {count > 0 && (
                      <span className="genre-card-count">
                        {count} {count === 1 ? "book" : "books"}
                      </span>
                    )}
                    <span className="genre-card-blurb">{genreBlurb(name)}</span>
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="genre-controls">
            <button type="button" onClick={() => step(-1)} aria-label="Previous genre" className="genre-arrow">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <ol className="genre-dots" aria-label="Choose a genre">
              {genres.map((genre, index) => (
                <li key={genre.slug}>
                  <button
                    type="button"
                    onClick={() => setActive(index)}
                    aria-label={`Show ${genre.name}`}
                    aria-current={index === activeIndex ? "true" : undefined}
                    className="genre-dot"
                  >
                    <span className="genre-dot-mark" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>

            <button type="button" onClick={() => step(1)} aria-label="Next genre" className="genre-arrow">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <p className="sr-only" aria-live="polite">
            {`${genres[activeIndex]?.name || ""} selected`}
          </p>
        </div>
      </div>
    </section>
  );
}

export default GenreCarousel;
