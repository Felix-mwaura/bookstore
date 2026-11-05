# Homepage redesign — 5 November 2026

The brief asked for a premium editorial homepage following a Dribbble reference
(Books for More, Neyhive Studio). This records what was built, what was
deliberately not built, and what could not be checked here.

## Reference and adaptation

The reference's structure was followed; its palette was not. Book Haven keeps
cream paper, navy ink and sienna, Playfair Display over Inter — a rebrand was
not in scope, and the reference's own colours (#FFFDFC, #172B55, #F15B35)
map onto our existing tokens closely enough that the composition carries.

What came across:

- an asymmetrical hero: a wide text column against a narrower arched
  photograph, with a circular badge sitting on the seam and a hand-drawn
  dashed arrow pointing from the words into the picture;
- a horizontal shelf of new arrivals with real scroll controls;
- a colourful promotional band ("Find stories worth sharing.");
- a tinted search band with a big field and genre chips;
- the reference's soft radii and generous whitespace.

What did not:

- **Photography.** The reference uses a portrait of a person and shop-front
  photos, both of which would have to be bought or invented. The hero instead
  uses the shop's own artwork (`public/genres/fiction-1200.webp`, which was
  already in the repository) and names a real book in the corner card.
- **"Bestsellers".** The shop does not measure sales, so a bestseller row
  would be a claim it cannot support. The row is called *Picked by the shop*
  and is fed by the admin's existing `is_featured` flag.
- **A footer newsletter form.** `Newsletter` already refuses to collect
  addresses until the owner publishes a contact address
  (`STORE_CONTACT.reachable`). Adding a second form in the footer would have
  re-opened a collection path that is deliberately closed.
- **Social links.** The shop has no accounts, and inventing URLs is not an
  option.
- **Trust badges the shop cannot keep.** No "delivery across Kenya" (coverage
  is unset), no "secure payments" seal, no review count. The strip names
  delivery, real stock, order references, and M-Pesa only when the server says
  Daraja is configured.

## Files

| File | Role |
|---|---|
| `app/components/HomeHero.js` | new — the asymmetric hero |
| `app/components/CategoryStrip.js` | new — live genres, artwork with a plain fallback |
| `app/components/ProductRow.js` | new — horizontal shelf with labelled arrows |
| `app/components/HomeBands.js` | new — promo band and discovery search |
| `app/components/HomeClient.js` | rewritten to compose the above |
| `app/lib/book-shape.js` | exposes `is_featured` (the admin's flag) |
| `scripts/home-smoke.mjs` | new — 39 checks on structure and honesty |
| `scripts/craft-smoke.mjs` | heading-order check now spans the homepage's components |
| `scripts/product-card-smoke.mjs` | homepage row is checked where the card is rendered |

Every section reads live data: new arrivals by newest id, picks by
`is_featured`, offers by a real `original_price > price`, genres from
`useGenres()`, counts from the whole-shelf query, and the figures in the stats
band from `getCatalogueStats()`.

## Verified

- `next build --webpack` — pass.
- `npm test` — 816 checks, 0 failures (was 776).
- `ui-audit` — 784 passed, 0 failed, 60 pages.
- `eslint` — 0 errors, 5 pre-existing warnings.
- Rendered `/`: one `h1`; hero, trust strip, three shelves (10 / 3 / 5 titles),
  genre strip, promo, stats, discovery, newsletter gate and contact all
  present; 18 product cards; discounts computed (27% from 800 / 1,100; 21%
  from 1,550 / 1,950); no "free delivery" text.

## Not verified — no browser in this environment

- Appearance at any width. The responsive rules were written deliberately
  (the genre strip and shelves scroll below `sm`/`lg`, the hero stacks under
  `lg`), but nobody has looked at the result.
- Hover, focus and reduced-motion behaviour in a real browser.
- The Dribbble image itself could not be fetched here; the reference was read
  from a screenshot, and the layout is an interpretation of it.
- Lighthouse, contrast ratios in situ, and Core Web Vitals.
