# Premium pass — 31 October 2026

A design-system pass over the storefront, against the two skill repositories
that shaped the earlier craft work (`pbakaus/impeccable`,
`dickwu/apple-design-skill`) and the brief in
`premium_website_transformation_prompt.txt`. Not a rebuild: same app, same
routes, same data access, same cart, checkout, auth and admin logic. What
changed is the frame every page is built in.

## What the audit found

| Symptom | Cause |
| --- | --- |
| Thirteen type sizes in use — 9, 10, 11, 12.5, 13, 14, 15, 16, 17, 18px — several of them inside one card | Sizes chosen per component, never a scale |
| Four different page headers (`text-2xl`, `3xl`, `4xl`, each with its own rule, breadcrumb and spacing) | Each page invented its own opening |
| The desktop header offered no way to browse the shop; the only navigation was the footer | A mobile-first decision that never got a desktop answer |
| `btn-primary text-sm`, `btn-primary px-4 py-2.5` — the utilities had no effect | The button classes were unlayered CSS, so they outranked every Tailwind utility; a whole vocabulary of overrides was silently dead |
| Cards, drawers and panels agreed on radius but not on shadow, padding or hover | No shared surface definition |
| Paragraph copy at `max-w-2xl` inside a full-width band, headings floating without measure | No frame, so each band picked its own width |

## The foundations

**A type scale, in tokens** (`app/globals.css`, `@theme`). Seven steps, fluid
where it matters:

| Token | Size | Used for |
| --- | --- | --- |
| `text-display` | `clamp(2.5rem, 1.45rem + 4vw, 4.5rem)` | the homepage statement, and nothing else |
| `text-title` | `clamp(1.9rem, 1.5rem + 1.6vw, 3rem)` | a page's own `h1` |
| `text-heading` | `clamp(1.3rem, 1.15rem + 0.7vw, 1.75rem)` | a section `h2` |
| `text-lead` | `clamp(1.0625rem, 1rem + 0.3vw, 1.1875rem)` | the one sentence under a title |
| body | 1rem | prose |
| `text-small` | 0.875rem | metadata, secondary copy |
| `text-micro` | 0.6875rem | uppercase labels — the HIG floor of 11px |

`clamp()` replaces most breakpoints: the display is 2.5rem at 320px and 4.5rem
on a wide screen, continuously, with no step the eye can catch.

**A frame.** `.shell` (max 84rem, 20/32/40px gutters) and `.shell-doc` (58rem,
for the four policy documents). `.band` (3.25 / 4.5 / 6rem of vertical air)
and `.band-tight`. Eleven bands that previously hand-rolled
`mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14` now share two classes, so the
rhythm of the page is a decision rather than an artefact.

**Surfaces.** `.surface` — one border, one radius (16px), one tinted shadow.
The elevation tokens were re-cut: shadows are tinted with the ink rather than
black, and carry a negative spread so a card reads as paper lifting off the
page instead of a grey box stamped behind it. Radii went 8/12 → 10/16/20.

**Component CSS moved into `@layer components`.** This is the quiet but
important one. Unlayered CSS outranks every Tailwind utility, so
`className="btn-primary px-4 text-sm"` had been applying the button's own
padding and size and ignoring the overrides. The primitives (buttons, fields,
frame, surface) now sit in the components layer, where utilities can adjust
them the way the markup always assumed they could.

## The components

**Header.** A real desktop navigation row (`All books · New arrivals ·
Fiction · Finance · Self-help · Delivery & help`) with an underline that marks
the current page; the bar is taller (64/80px) and opaque — the 95%-opacity
`backdrop-blur` it replaces was paying for a compositor layer to hide almost
nothing. Search is a pill: a muted category select, then the field, then a
circular ink button. Every icon control is a 44px circle. The header gains its
shadow only after the page has scrolled (`data-stuck`), so at rest it is a rule
on paper rather than a floating bar.

**Footer.** Five columns, on a deeper navy than the page: a two-column brand
statement, then Shop / Your account / Help / Contact, with the utility row
under a hairline. Column headings moved from `text-sm`/white to
`text-micro`/cream-60, which is a real contrast fix as well as a hierarchy
one — cream at 45% on navy is 4.2:1, under AA for the size it was being used
at.

**PageHeader** (new, `app/components/PageHeader.js`). Breadcrumb, title at
`text-title`, one lead sentence, optional meta line and actions, over a
hairline. Used by `/books`, `/category/*`, `/account` and all four policy
pages, which is what makes those pages feel like one product rather than five
documents.

**ProductCard.** The cover sits on a `subtle` paper stage instead of white on
white; titles moved to the serif at 15/16px, which is what makes a grid of
books read as a bookshop; the price is 17/18px with tabular numerals; the
category label and author use `text-micro` and `text-small`; the add control
is 40px on phones and 44 on desktop. Radius and shadow come from the shared
surface tokens.

**Form fields.** `.field` (46px tall, 10px radius, hairline, opaque two-pixel
sienna focus ring), `.field-inline` for toolbars, `.field-error` for a failed
validation. Checkout, login and the catalogue sort now share them — the same
input used to be 40px in the header and 44px in checkout, with three different
focus treatments. Fields are 15px on desktop and 16px below 640px, because iOS
Safari zooms the viewport in on a focused field under 16px and never zooms back
out.

**Buttons.** One height (46px), one radius, one weight, a pressed state of 1px
of travel, and a disabled state. `btn-quiet` exists for a third action that
should not compete with the other two.

## The pages

- **Home** — the hero leads with the display serif; the search is the pill; a
  single sienna action ("Shop all books") with a quiet "Browse by genre" beside
  it, because one action colour per view means the second button had to stop
  being a button. Every band is `.shell .band`.
- **`/books`, `/category/*`** — `PageHeader`, a wider 15rem sidebar, 32/48px
  column gaps, and a grid that breathes: `gap-x-4 → 6`, `gap-y-8` between rows.
- **Book detail** — the title takes `text-title`, the buy panel becomes the
  page's one elevated surface with a 3xl/4xl tabular price, and the related
  row uses the wider grid.
- **Policy pages** — `.shell-doc`, a 42rem prose measure and serif section
  headings.
- **Account** — `PageHeader`, tabular figures in the summary tiles.
- **Checkout** — the same frame heights, `text-title` heading, `.surface`
  panels, and the amber basket notice moved onto the warning tokens instead of
  a one-off `amber-50`. The payment step's agreement was a `<div onClick>`, which
  meant a keyboard or screen-reader user could not consent to cash on delivery at
  all; it is a real checkbox now, with the label as the touch target.
- **404, error boundary, access denied** — the three pages nobody designs but
  everybody eventually sees. Same shell, `text-title`, and the same buttons as
  the rest of the shop; the access-denied page loses its red-50/purple-600/
  monospace styling, which read as a different product.
- **Dashboard (admin)** — the palette and radii, not the layout. Every
  `stone/red/amber/green/purple` utility and the three raw hexes written as
  arbitrary values (`#1B2A4A`, `#E3DCCB`, `#B5532F`) now resolve to the same
  tokens the storefront uses, so the two halves of the product stop looking
  like two products. Two consequences worth naming: a hover that had collapsed
  to the same colour as its resting state (`bg-red-600 hover:bg-red-700` both
  became `bg-error`) got a real `--color-error-hover`/`--color-warning-hover`,
  and the emoji standing in for warning icons became the one stroke icon the
  rest of the site draws. Tables, density and every piece of admin logic are
  untouched.

## What was deliberately not changed

- The palette. Cream paper, navy ink, one sienna action: that is the identity,
  and "sophisticated colour" here meant using three colours precisely, not
  adding a fourth.
- The motion scale, the reveal rules, the genre deck, the Motion-based exits.
- Any logic: cart, checkout, M-Pesa, reviews, auth, admin, the database layer.
- The admin's layout, table density and component structure — only its palette,
  radii and icon style moved.

## Verification

| Check | Result |
| --- | --- |
| `next build` (offline, fixture env) | 0 errors |
| `eslint app scripts` | 0 errors, 7 warnings (all pre-existing) |
| `npm test` | exit 0 — 657 assertions, including `craft-smoke` |
| Routes | `/`, `/books`, `/category/fiction`, `/books/[slug]`, `/help`, `/about`, `/privacy`, `/terms`, `/login`, `/checkout` all 200 |
| Rendered HTML | one `h1` per page, every one in Playfair; every image with alt; every input labelled; no nameless buttons; the only duplicate ids in the streamed HTML are Next's own hidden fallback copies of the header |
| Compiled CSS | contains the scale, the frame, the field ring, the halo, the themed browser surfaces, the iOS 16px field rule and the new reduced-motion rule |
| Craft suite | computes contrast from tokens, asserts the frame/scale/field primitives and the bans (kickers, emoji icons, dead keyframes, palette hexes) |

**Not verified:** anything visual. There is no browser in this environment —
no screenshots at any breakpoint, no hover or focus states seen, no real
upload through the admin, no synthesised touch. The layout decisions above are
argued from the code and the contrast maths, not from looking at the page.
