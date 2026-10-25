# Add to cart on desktop — root cause and fix

Date: 2026-10-25 · Branch `arena/fde1c412-bookstore` (PR #54)

**Symptom.** On a phone, tapping "Add" on a product card works. On a desktop
browser the same button does nothing: no toast, no badge change, nothing in
the basket.

**Cause.** Not the cart. A CSS hit-testing trap in the card's hover tilt.

---

## 1. The root cause

`app/globals.css` had:

```css
.card-3d {
  transition: …;
  transform-style: preserve-3d;        /* ← the problem */
}

@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  .card-3d:hover,
  .card-3d:focus-within {
    transform: perspective(1100px) translateY(-3px) rotateX(1deg);
  }
}
```

On a device with a real pointer, hovering a card rotates it on X **inside a
`preserve-3d` subtree**. In Chromium the hit test for that rotated 3D subtree
does not resolve to the transformed children — every click inside the card is
delivered to the nearest flattened ancestor, which is the card's footer row
(`div.mt-auto`). The `<button type="button">` never receives the event, so
`onClick` never runs. That ancestor is not a link either, so the click does not
navigate — it simply does nothing.

Two properties have to be true at once, and they are exactly the desktop/mobile
split:

| | `(hover: hover)` + `(pointer: fine)` | `rotateX` on `.card-3d` | Result |
| --- | --- | --- | --- |
| Desktop / laptop with a mouse | matches | yes, on hover | **click lost** |
| Phone / tablet | does not match | never applied | tap works |

Nothing in the JS was involved: the handler, the context, the reducer and
`localStorage` were all correct the whole time. The same trap also swallowed
clicks on the card's own title link, so a hovered card was dead end to end.

### Why it was not caught before

Headless Chromium — the engine behind every automated check in this repo,
including the previous cross-device verification — reports
`(hover: none)` and `(pointer: coarse)`. It therefore never matched that media
block and **never rendered the desktop hover state**. The old "desktop click"
results were really the mobile CSS branch at desktop widths. Any future
pointer-dependent behaviour needs the check described in §4 below.

## 2. The fix

One declaration, in `app/globals.css`:

```css
.card-3d {
  /* …flat, with a comment explaining why it must stay flat */
  transform-style: flat;
}
```

Flattening costs nothing visually: the cover's depth comes from `.scene`'s own
`perspective: 900px`, not from the card, so the lift, the 1° card tilt and the
cover's 12°/5° rotation all still render. A pixel comparison of the hovered
card before and after (201 × 485 crop) differs only in the cover's sub-pixel
projection; the two screenshots are visually identical.

Nothing else changed: no cart logic, no stock or price arithmetic, no checkout,
payment or schema changes, no new dependency, no new persistence.

## 3. Isolation — what actually breaks the click

Each variant was applied to the live card on a production build, then a real
mouse (move → settle → click) was used at the button's centre. Hit-test points
confirmed with a document-level click listener.

| # | Card state | Click reaches the button |
| --- | --- | --- |
| A | `perspective(1100px) translateY(-3px) rotateX(1deg)`, `preserve-3d` (**shipped before**) | ❌ no — the click lands on `div.mt-auto` |
| B | same transform, `transform-style: flat` (**the fix**) | ✅ yes |
| C | `perspective + translateY`, no `rotateX`, `preserve-3d` | ✅ yes |
| D | `rotateX(1deg)`, no perspective, `preserve-3d` | ❌ no |
| E | A + `translateZ(1px)` on the button | ❌ no |
| F | only the cover transformed, card untouched | ✅ yes |

So `rotateX` **and** `preserve-3d` are both required to lose the click;
removing either one fixes it. Flattening the card is the change that leaves the
design intact.

Before the fix, 7 click points across the button (centre, four corners, the
bottom edge, the left edge) failed at 1280 / 1440 / 1920 px — 0 of 21 landed.
After the fix those same 21 points all add the item.

## 4. Regression guard

`scripts/smoke.mjs` now fetches `/books`, follows the stylesheet it links and
fails if the `.card-3d` rule declares `transform-style: preserve-3d`. This is a
text assertion, deliberately: the only browser that could catch it by clicking
is a headed one with a mouse, which CI does not have. Verified both ways —
green on the fixed build, red (with the offending declaration printed) when the
declaration was temporarily put back.

Method note for future pointer-dependent work: inject the media-gated rules
without the gate, then drive the page with `page.mouse` (move, settle ≥ 600 ms
for the 260 ms transition, re-measure, click). `document.elementFromPoint` is
**not** trustworthy inside a `preserve-3d` subtree — it disagreed with the real
click in exactly the broken case — so assert on the cart, not on the element
stack.

## 5. Tests run, and the real results

All of this ran against `next build && next start` of this branch, driven by
headless Chromium 131 with real input events (`page.mouse`, `touchscreen.tap`),
with the desktop hover rules active for the desktop cases.

**A — desktop 1440: full basket flow (16/16)**

| Check | Result |
| --- | --- |
| Homepage card adds the item | ✅ |
| Header badge updates immediately (`Basket, 1 item`) | ✅ |
| No accidental navigation | ✅ |
| Success toast (`role="status"`) rendered | ✅ |
| A second, different book adds a second line / badge `2 items` | ✅ |
| Drawer opens with both titles, both covers, prices | ✅ |
| Quantity +, quantity − | ✅ qty 1 → 2 → 1 |
| Remove drops the line | ✅ |
| Cart survives a reload (`bh_cart` in localStorage) | ✅ |
| Checkout reads the same basket (2 items) | ✅ |
| Checkout stops at the sign-in gate; no order placed | ✅ |
| Console clean | ✅ |

**B — mouse and keyboard, laptop and wide desktop (21/21)**
1280 / 1440 / 1920 px: mouse click ✅, `Enter` ✅, `Space` ✅, no navigation
from keyboard activation ✅, focus ring visible (2 px solid) ✅, and the card's
title link still opens the book page ✅ (the link only navigates when the link
is what was clicked).

**C — mobile regression at 390 px (7/7).** Phone reports `hover:none /
pointer:coarse`, so no tilt: card tap adds ✅, badge updates ✅, no navigation
✅, drawer lists the item ✅, book page shows the sticky `lg:hidden` bar ✅,
sticky bar tap adds ✅, inline "Add to basket" adds ✅.

**D — state and edge cases (8/8).** Same book twice merges into one line with
quantity 2 and badge `2 items` ✅. Low stock (Deep Work, 3 in stock): clicks
stop at 3, toast says *"Only 3 of “Deep Work” in stock"* — no fake success ✅.
Unavailable product (`stock_quantity: 0`): the control renders disabled, reads
"Sold out", `cursor: not-allowed`, clicking adds nothing and shows no toast ✅.
Console clean throughout ✅.

**Surfaces.** Homepage card, `/books` card, `/category/*` card, book-page inline
button, book-page sticky bar (mobile), wishlist drawer — all six add from the
same `addToCart` action; no duplicated cart path was introduced or found.

**E — build and existing tests.** `npx eslint .` → 0 errors, 7 pre-existing
warnings. `next build` → compiled successfully, 30/30 static pages. `scripts/smoke.mjs`
→ **25 checks passed, 9 skipped** (skips are the admin APIs with no service-role
key in this environment). Unit smokes: `cart-smoke`, `delivery-smoke`,
`price-smoke`, `wishlist-sync-test` (24/24), `agent-smoke`, `store-wiring` — all
pass, unchanged.

## 6. Remaining gaps

- **Not verified in a headed browser on physical hardware.** This sandbox has
  no display server and only headless Chromium, which cannot report
  `hover: hover`. The desktop state was reproduced by injecting the same rules
  without their media gate; the hit test that fails is Blink's, and it is the
  same code path in a headed window — but the last 30 seconds of confirmation
  are a human clicking the deployed card. Worth doing once after deploy.
- **Production was not re-driven in a browser** (the sandbox cannot reach the
  deployment's host from Chromium). Verify with the deployed build after merge.
- **Safari and Firefox were not tested.** `transform-style: flat` is the initial
  value in both, so the change can only help there; the hover tilt itself is
  plain CSS.
- **Other 3D effects audited, not changed:** `.book-3d` (book page cover, no
  interactive children), `.book-badge-3d` (decorative admin mark), and
  `.hero-cover-3d` (rules for the old hero, no longer referenced). `.hover-3d`
  and `.tilt-card` rotate without `preserve-3d`, so they hit-test normally. If
  a link or button is ever placed *inside* `.book-3d`, it will need the same
  flattening treatment.
- **iOS Safari, Android Chrome and a real mouse were not exercised** — see the
  first two points.
