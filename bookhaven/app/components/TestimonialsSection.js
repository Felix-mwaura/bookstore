"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import SectionHeading from "./SectionHeading";
import { supabase } from "../lib/supabase";
import {
  TESTIMONIAL_MAX_CHARS,
  TESTIMONIAL_MIN_CHARS,
  TESTIMONIAL_NAME_MAX,
  validateTestimonial,
} from "../lib/testimonial-limits";

// Reader testimonials, in the same fanned deck as the genre section.
//
// Two rules shape this section:
//   • Nothing on a card is invented. Every quote is a row a reader wrote and
//     the shop published. With none published yet the deck is simply absent —
//     the section shows the invitation instead of a stranger's words.
//   • A recommended book is a real catalogue title, picked from a list the
//     server passed down, and the route re-reads the title from the database
//     so the card cannot claim someone recommended a book that does not exist.
//
// The deck shares .genre-region / .genre-stage / .genre-card with the genre
// carousel — the same geometry, the same arrows and dots. It deliberately has
// no drag handling: a quote is read, not flicked, and the arrows plus the dots
// already give a mouse, a finger and a keyboard a way through.

const VISIBLE_DEPTH = 2;

const wrap = (index, length) => ((index % length) + length) % length;

function loopOffset(index, active, length) {
  const raw = index - active;
  const half = length / 2;
  if (raw > half) return raw - length;
  if (raw < -half) return raw + length;
  return raw;
}

/** The book a reader recommended, or nothing at all. Never a placeholder. */
function RecommendedBook({ testimonial, bookSlug }) {
  if (!testimonial.book_title) return null;

  const slug = bookSlug || null;
  const label = (
    <>
      <span className="testimonial-card-book-label">Recommends</span>
      <span className="testimonial-card-book-title">{testimonial.book_title}</span>
    </>
  );

  return slug ? (
    <Link href={`/books/${slug}`} className="testimonial-card-book">
      {label}
    </Link>
  ) : (
    <span className="testimonial-card-book">{label}</span>
  );
}

function TestimonialDeck({ testimonials, slugById }) {
  const length = testimonials.length;
  const [active, setActive] = useState(0);
  const activeIndex = length === 0 ? 0 : Math.min(active, length - 1);

  const step = useCallback(
    (delta) => setActive((current) => wrap(current + delta, Math.max(length, 1))),
    [length]
  );

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

  const cards = testimonials
    .map((testimonial, index) => ({
      testimonial,
      distance: loopOffset(index, activeIndex, length),
    }))
    .filter(({ distance }) => Math.abs(distance) <= VISIBLE_DEPTH)
    .sort((a, b) => Math.abs(b.distance) - Math.abs(a.distance));

  return (
    <div
      className="genre-region mt-8"
      role="group"
      aria-roledescription="carousel"
      aria-label="Reader testimonials"
      onKeyDown={onKeyDown}
    >
      <div className="genre-stage" style={{ "--gc-count": length }}>
        {cards.map(({ testimonial, distance }) => {
          const depth = Math.abs(distance);
          const scale = depth === 0 ? 1 : depth === 1 ? 0.84 : 0.68;
          const opacity = depth === 0 ? 1 : depth === 1 ? 0.96 : 0.72;

          return (
            <figure
              key={testimonial.id}
              className="genre-card testimonial-card"
              data-depth={depth}
              aria-current={depth === 0 ? "true" : undefined}
              style={{
                "--d": distance,
                "--s": scale,
                "--r": `${distance * 4}deg`,
                "--o": opacity,
                "--z": 30 - depth * 10,
              }}
            >
              {/* Visible at every depth: a neighbour is a dark spine with a
                  quotation mark, not an empty slab. */}
              <span className="testimonial-card-mark" aria-hidden="true">
                &ldquo;
              </span>

              <span className="genre-card-body testimonial-card-body">
                <blockquote className="testimonial-card-quote">{testimonial.body}</blockquote>
                <figcaption className="testimonial-card-author">
                  <span className="genre-card-name testimonial-card-name">{testimonial.author_name}</span>
                  <RecommendedBook
                    testimonial={testimonial}
                    bookSlug={testimonial.book_id ? slugById[testimonial.book_id] : null}
                  />
                </figcaption>
              </span>
            </figure>
          );
        })}
      </div>

      {length > 1 && (
        <div className="genre-controls">
          <button type="button" onClick={() => step(-1)} aria-label="Previous testimonial" className="genre-arrow">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <ol className="genre-dots" aria-label="Choose a testimonial">
            {testimonials.map((testimonial, index) => (
              <li key={testimonial.id}>
                <button
                  type="button"
                  onClick={() => setActive(index)}
                  aria-label={`Show testimonial ${index + 1} of ${length}`}
                  aria-current={index === activeIndex ? "true" : undefined}
                  className="genre-dot"
                >
                  <span className="genre-dot-mark" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>

          <button type="button" onClick={() => step(1)} aria-label="Next testimonial" className="genre-arrow">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {`Testimonial ${activeIndex + 1} of ${length}`}
      </p>
    </div>
  );
}

/* ── leaving one ──────────────────────────────────────────── */

const EMPTY = { authorName: "", body: "", bookId: "", company: "" };

function TestimonialForm({ books, onClose, onPending }) {
  const [fields, setFields] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionState, setSessionState] = useState("checking"); // checking | out | in
  const firstFieldRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setSessionState(session ? "in" : "out");
      // Pre-fill only a name the reader already gave the shop.
      const name = session?.user?.user_metadata?.full_name;
      if (typeof name === "string" && name.trim()) {
        setFields((current) => ({ ...current, authorName: current.authorName || name.trim() }));
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setSessionState(session ? "in" : "out");
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  const length = fields.body.trim().length;
  const checked = validateTestimonial({
    authorName: fields.authorName,
    body: fields.body,
  });
  const canSubmit = checked.ok && length <= TESTIMONIAL_MAX_CHARS && !busy;

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError("");
    setBusy(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Your session has ended. Please sign in again.");
        setSessionState("out");
        return;
      }

      const response = await fetch("/api/testimonials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          authorName: fields.authorName,
          body: fields.body,
          bookId: fields.bookId || null,
          company: fields.company,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload?.error || "We could not save that. Please try again.");
        return;
      }

      setFields(EMPTY);
      onPending?.();
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (sessionState === "checking") {
    return <p className="mt-6 text-sm text-muted">Checking your account…</p>;
  }

  if (sessionState === "out") {
    return (
      <div className="mt-6 rounded-card border border-line bg-white p-5">
        <p className="text-sm font-semibold text-navy">Sign in to leave a testimonial</p>
        <p className="mt-1 text-sm text-muted">
          Testimonials carry a name, so they come from an account rather than an anonymous box.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/login?next=%2F%23testimonials" className="btn-primary inline-flex text-sm">
            Sign in
          </Link>
          <button type="button" onClick={onClose} className="min-h-11 rounded-control border border-line px-4 text-sm font-semibold text-navy transition hover:border-navy">
            Not now
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 rounded-card border border-line bg-white p-5 sm:p-6" noValidate>
      <p className="text-sm font-semibold text-navy">Leave a testimonial</p>
      <p className="mt-1 text-sm text-muted">
        A sentence or two about the shop, and a book you would hand to another reader. The shop reads
        every one before it appears here.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label htmlFor="testimonial-name" className="block text-sm font-semibold text-ink">
            Name to show
          </label>
          <input
            id="testimonial-name"
            ref={firstFieldRef}
            type="text"
            value={fields.authorName}
            onChange={(event) => setFields({ ...fields, authorName: event.target.value })}
            maxLength={TESTIMONIAL_NAME_MAX}
            autoComplete="name"
            className="mt-1.5 h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink focus:border-navy focus:outline-none"
          />
        </div>

        <div className="sm:col-span-1">
          <label htmlFor="testimonial-book" className="block text-sm font-semibold text-ink">
            A book you would recommend <span className="font-normal text-muted">(optional)</span>
          </label>
          <select
            id="testimonial-book"
            value={fields.bookId}
            onChange={(event) => setFields({ ...fields, bookId: event.target.value })}
            className="mt-1.5 h-11 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink focus:border-navy focus:outline-none"
          >
            <option value="">No book</option>
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="testimonial-body" className="block text-sm font-semibold text-ink">
            Your testimonial
          </label>
          <textarea
            id="testimonial-body"
            value={fields.body}
            onChange={(event) => setFields({ ...fields, body: event.target.value })}
            rows={4}
            maxLength={TESTIMONIAL_MAX_CHARS}
            aria-describedby="testimonial-counter"
            className="mt-1.5 w-full rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-navy focus:outline-none"
          />
          <p id="testimonial-counter" className="mt-1 text-xs text-muted">
            {length < TESTIMONIAL_MIN_CHARS
              ? `${TESTIMONIAL_MIN_CHARS - length} more characters to go`
              : `${length} of ${TESTIMONIAL_MAX_CHARS} characters`}
          </p>
        </div>
      </div>

      {/* Only a bot fills this in. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="testimonial-company">Company</label>
        <input
          id="testimonial-company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={fields.company}
          onChange={(event) => setFields({ ...fields, company: event.target.value })}
        />
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-error">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" disabled={!canSubmit} className="btn-primary inline-flex text-sm disabled:opacity-60">
          {busy ? "Sending…" : "Send it to the shop"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-control border border-line px-4 text-sm font-semibold text-navy transition hover:border-navy"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ── the section ──────────────────────────────────────────── */

export function TestimonialsSection({ testimonials = [], books = [] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const slugById = books.reduce((acc, book) => {
    if (book?.id != null && book?.slug) acc[book.id] = book.slug;
    return acc;
  }, {});

  return (
    <section id="testimonials" aria-labelledby="testimonials-title" className="border-b border-line bg-cream">
      <div className="shell band">
        <SectionHeading
          title="What readers say"
          description={
            testimonials.length > 0
              ? "Notes from customers, and the book each one would pass on. Every quote here was written by a reader and read by the shop first."
              : "When readers write in, their notes and the books they recommend will appear here. The shop reads every one first."
          }
          id="testimonials-title"
        />

        {testimonials.length > 0 ? (
          <TestimonialDeck testimonials={testimonials} slugById={slugById} />
        ) : (
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted">
            No testimonials are published yet. If you have bought from the shop, yours would be the first.
          </p>
        )}

        <div className="mt-7 flex justify-center">
          <button
            type="button"
            onClick={() => {
              setPending(false);
              setFormOpen((open) => !open);
            }}
            aria-expanded={formOpen}
            aria-controls="testimonial-form-region"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-5 text-sm font-semibold text-navy transition-colors hover:border-navy"
          >
            {formOpen ? "Close the form" : "Leave a testimonial"}
          </button>
        </div>

        <div id="testimonial-form-region">
          {pending && !formOpen && (
            <p role="status" className="mt-5 rounded-card border border-line bg-white p-5 text-sm text-ink">
              Thank you — your testimonial is with the shop for a read before it goes up.
            </p>
          )}

          {formOpen && (
            <TestimonialForm
              books={books}
              onClose={() => setFormOpen(false)}
              onPending={() => {
                setPending(true);
                setFormOpen(false);
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}

export default TestimonialsSection;
