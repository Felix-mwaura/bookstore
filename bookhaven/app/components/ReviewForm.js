"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { supabase } from "../lib/supabase";
import { StarPicker } from "./StarRating";
import {
  REVIEW_MAX_CHARS,
  REVIEW_MIN_CHARS,
  REVIEW_TITLE_MAX,
} from "../lib/review-limits";

// Writing, editing and deleting a review.
//
// The browser talks to Supabase directly, as the signed-in customer, under
// RLS — exactly like the basket and checkout do. There is no review API
// route, because there would be nothing for it to add: the database already
// decides who may write what (auth.uid() = user_id), which columns may be
// written (grants), and what a valid review looks like (CHECK constraints).
//
// Nothing here is optimistically rendered. A review appears in the list when
// the server re-renders it, after the write has actually returned.

const EMPTY = { rating: 0, title: "", review_text: "" };

/** Say the useful thing, not "new row violates row-level security policy". */
function friendlyWriteError(error) {
  const code = error?.code || "";
  const message = error?.message || "";

  if (code === "23505" || /duplicate key|book_reviews_one_per_customer/.test(message)) {
    return "You have already reviewed this book. Edit your existing review instead.";
  }
  if (code === "42501" || /permission denied/i.test(message)) {
    return "Your account is not allowed to change that. Refresh the page and try again.";
  }
  if (code === "23514" || /check constraint/i.test(message)) {
    if (/text_length/.test(message)) {
      return `Your review needs to be between ${REVIEW_MIN_CHARS} and ${REVIEW_MAX_CHARS} characters.`;
    }
    if (/title_length/.test(message)) return `Keep the headline under ${REVIEW_TITLE_MAX} characters.`;
    if (/rating_range/.test(message)) return "Choose a rating between 1 and 5 stars.";
    return "That review does not meet our submission rules.";
  }
  if (code === "PGRST116" || /no rows/i.test(message)) {
    return "That review no longer exists — it may have been removed.";
  }
  if (/fetch|network|Failed to fetch/i.test(message)) {
    return "We could not reach the server. Check your connection and try again.";
  }
  return "Your review could not be saved. Please try again.";
}

export default function ReviewForm({ bookId, bookSlug, bookTitle, initialReview = null }) {
  const router = useRouter();
  const [review, setReview] = useState(initialReview);
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState(
    initialReview
      ? { rating: initialReview.rating, title: initialReview.title || "", review_text: initialReview.review_text }
      : EMPTY
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sessionState, setSessionState] = useState("checking"); // checking | out | in
  const firstFieldRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setSessionState(session ? "in" : "out");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setSessionState(session ? "in" : "out");
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // The server component does not know who is reading (it renders for
  // everyone, signed in or not), so the "your review" state arrives with the
  // first client render.
  useEffect(() => {
    if (sessionState !== "in") return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      const { data } = await supabase.rpc("my_book_review", { p_book_id: bookId });
      const mine = (data && data[0]) || null;
      if (cancelled) return;
      setReview(mine);
      if (mine) {
        setFields({ rating: mine.rating, title: mine.title || "", review_text: mine.review_text });
      }
    })();
    return () => { cancelled = true; };
  }, [sessionState, bookId]);

  const ratingChosen = fields.rating >= 1 && fields.rating <= 5;
  const bodyLength = fields.review_text.trim().length;
  const canSubmit =
    ratingChosen &&
    bodyLength >= REVIEW_MIN_CHARS &&
    bodyLength <= REVIEW_MAX_CHARS &&
    fields.title.length <= REVIEW_TITLE_MAX &&
    !busy;

  const startEditing = () => {
    setError("");
    setNotice("");
    setOpen(true);
    setFields(
      review
        ? { rating: review.rating, title: review.title || "", review_text: review.review_text }
        : EMPTY
    );
    // Focus lands on the star group on the next paint.
    window.setTimeout(() => firstFieldRef.current?.focus(), 0);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!ratingChosen) { setError("Choose a rating from 1 to 5 stars."); return; }
    if (bodyLength < REVIEW_MIN_CHARS) {
      setError(`Write at least ${REVIEW_MIN_CHARS} characters so your review is useful.`);
      return;
    }
    if (bodyLength > REVIEW_MAX_CHARS) {
      setError(`That is ${bodyLength - REVIEW_MAX_CHARS} characters too long.`);
      return;
    }

    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Your session has expired. Sign in again to post your review.");
        setSessionState("out");
        return;
      }

      // Ownership is never sent: user_id is written by the client only on
      // INSERT and is checked against auth.uid() by the policy. On UPDATE the
      // row is addressed by its id, and RLS decides whether it is ours.
      const payload = {
        rating: fields.rating,
        title: fields.title.trim() || null,
        review_text: fields.review_text.trim(),
      };

      const result = review
        ? await supabase
            .from("book_reviews")
            .update(payload)
            .eq("id", review.id)
            .select("id, rating, title, review_text, is_published, created_at, updated_at")
            .maybeSingle()
        : await supabase
            .from("book_reviews")
            .insert({ ...payload, book_id: bookId, user_id: session.user.id })
            .select("id, rating, title, review_text, is_published, created_at, updated_at")
            .maybeSingle();

      if (result.error) { setError(friendlyWriteError(result.error)); return; }

      if (!result.data) {
        // UPDATE matched no row: the review is not ours, or it is gone.
        setError(
          "That review could not be updated — it may have been removed. Refresh the page to see the current state."
        );
        return;
      }

      setReview(result.data);
      setOpen(false);
      setNotice(
        result.data.is_published
          ? "Thanks — your review is live."
          : "Thanks — your review was saved. A moderator has hidden it from the shop for now."
      );
      // Re-render the server component so the list, count and average all
      // come from the database rather than from this component's guess.
      router.refresh();
    } catch (err) {
      setError(friendlyWriteError(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data, error: deleteError } = await supabase
        .from("book_reviews")
        .delete()
        .eq("id", review.id)
        .select("id");

      if (deleteError) { setError(friendlyWriteError(deleteError)); return; }
      if (!data || data.length === 0) {
        setError("That review could not be removed — it may already be gone.");
        return;
      }

      setReview(null);
      setFields(EMPTY);
      setConfirmDelete(false);
      setOpen(false);
      setNotice("Your review has been removed.");
      router.refresh();
    } catch (err) {
      setError(friendlyWriteError(err));
    } finally {
      setBusy(false);
    }
  };

  /* ── signed out ─────────────────────────────────────────────────────── */
  if (sessionState === "out") {
    return (
      <div className="rounded-card border border-line bg-subtle/60 p-5">
        <p className="text-sm font-semibold text-navy">Read this book already?</p>
        <p className="mt-1 text-sm text-muted">
          Sign in to rate it and tell other readers what you thought.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(`/books/${bookSlug}#reviews`)}`}
          className="btn-primary mt-4 inline-flex text-sm"
        >
          Sign in to write a review
        </Link>
      </div>
    );
  }

  /* ── the review already exists and the form is closed ───────────────── */
  if (review && !open) {
    return (
      <div className="rounded-card border border-navy/20 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-sienna">Your review</p>
            <div className="mt-1.5 flex items-center gap-2">
              <StarPickerReadOnly value={review.rating} />
              <span className="text-xs font-semibold text-ink">{review.rating} / 5</span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={startEditing}
              className="min-h-11 rounded-control border border-line px-4 text-sm font-semibold text-navy transition hover:border-navy"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => { setError(""); setNotice(""); setConfirmDelete(true); }}
              className="min-h-11 rounded-control border border-line px-4 text-sm font-semibold text-error transition hover:border-error"
            >
              Delete
            </button>
          </div>
        </div>

        {review.title && <p className="mt-3 font-semibold text-navy">{review.title}</p>}
        <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink">{review.review_text}</p>

        {!review.is_published && (
          <p className="mt-3 rounded-control bg-subtle px-3 py-2 text-xs text-muted">
            A moderator has hidden this review from the shop. You can still edit it.
          </p>
        )}

        {(notice || error) && (
          <p role={error ? "alert" : "status"} className={`mt-3 text-sm ${error ? "text-error" : "text-success"}`}>
            {error || notice}
          </p>
        )}

        {confirmDelete && (
          <div className="mt-4 rounded-control border border-error/30 bg-error/5 p-4" role="alertdialog" aria-label="Confirm deleting your review">
            <p className="text-sm font-semibold text-navy">Delete your review of {bookTitle}?</p>
            <p className="mt-1 text-sm text-muted">This cannot be undone. The star rating is removed from the book too.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="min-h-11 rounded-control bg-error px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
              >
                {busy ? "Deleting…" : "Yes, delete it"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={busy}
                className="min-h-11 rounded-control border border-line px-4 text-sm font-semibold text-navy transition hover:border-navy"
              >
                Keep it
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── closed, no review yet ──────────────────────────────────────────── */
  if (!open) {
    return (
      <div className="rounded-card border border-line bg-subtle/60 p-5">
        <p className="text-sm font-semibold text-navy">Read this book already?</p>
        <p className="mt-1 text-sm text-muted">
          Rate it out of five and tell other readers what you thought.
        </p>
        <button type="button" onClick={startEditing} className="btn-primary mt-4 inline-flex text-sm">
          Write a review
        </button>
        {notice && <p role="status" className="mt-3 text-sm text-success">{notice}</p>}
      </div>
    );
  }

  /* ── the form ───────────────────────────────────────────────────────── */
  return (
    <form onSubmit={submit} className="rounded-card border border-navy/20 bg-white p-5" noValidate>
      <h3 className="text-lg font-bold text-navy">{review ? "Edit your review" : "Write a review"}</h3>
      <p className="mt-0.5 text-sm text-muted">
        {review ? "Your changes replace what is shown now." : `You are reviewing ${bookTitle}.`}
      </p>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-navy">
          Your rating <span className="text-sienna" aria-hidden="true">*</span>
        </legend>
        <div className="mt-1.5 flex flex-wrap items-center gap-3" ref={firstFieldRef} tabIndex={-1}>
          <StarPicker
            value={fields.rating}
            onChange={(rating) => setFields((f) => ({ ...f, rating }))}
            disabled={busy}
            describedBy="review-rating-help"
          />
          <span aria-live="polite" className="text-sm font-semibold text-ink">
            {fields.rating ? `${fields.rating} of 5` : ""}
          </span>
        </div>
        <p id="review-rating-help" className="mt-1 text-xs text-muted">
          1 = Poor, 5 = Excellent. Required.
        </p>
      </fieldset>

      <div className="mt-4">
        <label htmlFor="review-title" className="block text-sm font-semibold text-navy">
          Headline <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="review-title"
          type="text"
          value={fields.title}
          onChange={(e) => setFields((f) => ({ ...f, title: e.target.value }))}
          maxLength={REVIEW_TITLE_MAX}
          disabled={busy}
          placeholder="Sum up your review in a few words"
          className="mt-1.5 min-h-11 w-full rounded-control border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-navy"
        />
        <p className="mt-1 text-right text-[11px] text-muted">
          {fields.title.length}/{REVIEW_TITLE_MAX}
        </p>
      </div>

      <div className="mt-2">
        <label htmlFor="review-body" className="block text-sm font-semibold text-navy">
          Your review <span className="text-sienna" aria-hidden="true">*</span>
        </label>
        <textarea
          id="review-body"
          rows={5}
          value={fields.review_text}
          onChange={(e) => setFields((f) => ({ ...f, review_text: e.target.value }))}
          disabled={busy}
          placeholder="What did you think? Was it useful, surprising, hard to put down?"
          aria-describedby="review-body-help"
          className="mt-1.5 w-full resize-y rounded-control border border-line bg-white px-3 py-2.5 text-sm leading-relaxed text-ink outline-none transition focus:border-navy"
        />
        <div id="review-body-help" className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="text-muted">Between {REVIEW_MIN_CHARS} and {REVIEW_MAX_CHARS} characters.</span>
          <span className={bodyLength > REVIEW_MAX_CHARS ? "font-semibold text-error" : "text-muted"}>
            {bodyLength}/{REVIEW_MAX_CHARS}
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-control border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!canSubmit} className="btn-primary min-h-11 text-sm disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? "Saving…" : review ? "Save changes" : "Post review"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(""); }}
          disabled={busy}
          className="min-h-11 rounded-control border border-line px-4 text-sm font-semibold text-navy transition hover:border-navy"
        >
          Cancel
        </button>
        {!ratingChosen && <span className="text-xs text-muted">Choose a star rating to continue.</span>}
      </div>
    </form>
  );
}

/* A tiny read-only star row for the "your review" summary. Kept local so the
   client bundle does not pull the shared display component in twice. */
function StarPickerReadOnly({ value }) {
  return (
    <span className="inline-flex gap-0.5 text-warning" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} className="h-4 w-4" viewBox="0 0 24 24" fill={n <= value ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.4} aria-hidden="true">
          <path strokeLinejoin="round" d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.05 1.1-6.5-4.7-4.6 6.5-.95L12 2.6z" />
        </svg>
      ))}
    </span>
  );
}
