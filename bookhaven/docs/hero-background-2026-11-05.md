# The hero is a photograph now

2026-11-05 · branch `arena/18cade20-bookstore`

The homepage hero was a split: words on cream, an arched photograph of a
reading room on the right. It is now one full-bleed photograph with the words
over it, using the bookshelf image supplied for this change
(`public/hero/bookshelf-stack.jpg`).

## What changed

- The arch, the dashed arrow and the two-column grid are gone. They were built
  around a photograph that sat *beside* the text; with the photograph behind
  it they would only point at nothing.
- The section is one column, at least 30rem tall (38rem on a desktop), with the
  headline, the promise, both actions and the trust line on the left third.
- The 20% delivery badge and the "one real book" card moved into the empty right
  half on `lg` screens. Below that width they are hidden rather than allowed to
  float across the words: the delivery figure is already a sentence in the
  paragraph above, so nothing is lost on a phone.
- The photograph carries `alt=""`. It is background; a screen reader should
  hear the headline, not a description of a stock image.

## The scrim, and why 75%

White type over a photograph has no fixed contrast — it depends which pixel
happens to sit behind it. This picture runs from near-black bookcases to a
stack of pale covers, so the scrim is set for the *worst* case rather than the
average one.

A flat `bg-navy/75` wash over the palest cover in the image composites to about
`#4E586E`:

| Text | Contrast on that pixel | AA (4.5:1) |
| --- | --- | --- |
| pure white (headline, buttons) | ~7.1:1 | pass |
| `text-white/85` (promise, trust line) | ~5.7:1 | pass |

Three quarters of the picture is washed out; the quarter that remains is what
gives the hero its depth. A gradient would look smoother and make the maths
impossible, so it is one flat value.

## Two things worth knowing

**The supplied file is 735×490.** Next serves it at up to that width, so on a
wide screen the browser is scaling it up and it will read soft. Under a 75%
wash that is barely visible, but it is a real limit of the source, not of the
CSS. A 2000px version of the same frame would fix it; nothing else will.

**`quality` is not free.** The first version asked for `quality={60}` to keep
the file small. Next 16 serves only the qualities listed in `next.config`, and
anything else answers **400** — the hero would have deployed with no photograph
at all. The prop is gone, the default is used, and `home-smoke.mjs` now fails
if a hard-coded quality comes back.

## Verified

| Check | Result |
| --- | --- |
| `next build --webpack` | exit 0 |
| `npm test` | 886 ok · 0 fail |
| `ui-audit` | 784 passed · 0 failed · 60 pages |
| `eslint app scripts` | 0 errors, 5 pre-existing warnings |
| `/_next/image?url=%2Fhero%2Fbookshelf-stack.jpg` | 200 at 640/1080/1920 |
| Rendered hero | scrim present · `alt=""` · badge and book card present · no arch classes left |

## Not verified

Everything visual. There is no browser in this environment: the crop
(`object-[52%_42%]`) is chosen from the picture's composition, not from seeing
it fill a 1440×700 viewport, and whether the photo reads through a 75% wash is
a judgement only a screen can settle.
