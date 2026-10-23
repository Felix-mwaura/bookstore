# Review system — five-minute browser check

The rating and review system was verified against the live database on 2026-10-23:
policies, column grants, the trigger, the aggregate view, sorting, filtering and
pagination all behaved (`docs/reviews-2026-10-23.md` §6).

**One thing was never exercised: a person clicking the buttons.** This sandbox
cannot open a TLS connection to `*.supabase.co`, so the write path was driven
through the same database roles and JWT claims that PostgREST sets, not through
`ReviewForm.js` itself. That file is covered by lint, the build and review, but
not by a click.

This checklist closes that gap. It takes about five minutes, it needs no tools,
and it is the last unknown in the feature.

---

## Before you start

- Use a real email address you can open, or an address you do not mind
  registering (the account can be deleted afterwards — see step 7).
- Use a phone or a desktop browser; either is fine. Use both if you want the
  mobile layout checked.
- Open <https://bookstore-puce-sigma.vercel.app> and find any book with no
  reviews yet. From the live test, **The Psychology of Money** is back to zero
  reviews, so it is a good candidate.

## The check

| # | Do this | Expect | If it fails |
| --- | --- | --- | --- |
| 1 | Sign up (or sign in) with an account that has a first and last name | You land back on the site, signed in | Note the exact error text |
| 2 | Open a book page, scroll to **Customer Reviews** | "No reviews yet" and a **Write a review** button, not "Sign in to write a review" | If it says sign in, the session is not reaching the page — note which browser |
| 3 | Click the stars with the **mouse**, then again with the **keyboard** (Tab to the group, arrow keys) | The star you hover/select turns sienna; arrow keys move the selection; the label reads "N out of 5 stars" | Stars not responding to arrows is a real bug — say which key did nothing |
| 4 | Type a headline and at least 10 characters, click **Post review** | A success message, the form closes, and the page refreshes to show your review with your name and initial | Copy any red error text exactly |
| 5 | Look at the top of the page and at the product card on `/books` | The book now shows your rating (e.g. `4.0 (1)`) in both places | If the page shows it but the card does not, that is a caching bug |
| 6 | Click **Edit**, change the rating, save; reload the page | The new rating is shown, and the review carries a small "edited" note | |
| 7 | Delete the review, then delete the account if you made one just for this | The page returns to "No reviews yet" | See "Cleaning up" below |

## What good looks like

- Your review appears **without a page reload** after posting (the form calls
  `router.refresh()`), and the count in the section heading matches the number
  of reviews listed.
- The average is the mean of the published ratings, to one decimal on the page
  and two in the database. A single 4★ review shows `4.0 (1)`, not `4.5`.
- The "Verified purchase" badge does **not** appear for a review on a book you
  have not had delivered. It should appear only after an order containing that
  book is marked Delivered.
- If you post twice for the same book, the database refuses the second one with
  a friendly message — the button should not silently do nothing.

## Cleaning up

Deleting the review on the site removes it and the rating recalculation happens
immediately. Deleting the **account** is a database operation and needs an
administrator (there is no self-service delete yet — see the note at the end of
`docs/store-refinement-2026-10-23.md`). Send the email address used and it will
be removed.

## If something fails

Record, in this order:

1. the step number,
2. what you clicked,
3. what you expected,
4. what happened,
5. the browser and whether it was phone or desktop.

That is enough to reproduce it. Screenshots help but are not required.
