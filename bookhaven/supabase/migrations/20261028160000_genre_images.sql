-- ─────────────────────────────────────────────────────────────
-- A genre can carry its own card art.
--
-- The homepage deck used to derive every card from a bundled map in
-- app/lib/genres.js (/genres/<slug>-1200.webp), so a genre the admin added
-- showed a plain navy panel and nothing could be changed without a deploy.
-- This column holds the public URL of an image the admin uploaded; NULL means
-- "use the built-in art for this slug, and the plain panel if there is none".
--
-- The value is validated in the route, not here: it must be a public URL in
-- this project's `book-covers` bucket under `genres/`, because the storefront
-- renders it with next/image and the optimiser only accepts this project's
-- storage host. A constraint hard-coding that host would break the moment the
-- project moved, so the rule lives next to the code that reads the variable.
--
-- Idempotent: safe to run more than once.
-- ─────────────────────────────────────────────────────────────

alter table public.genres
  add column if not exists image_url text;

comment on column public.genres.image_url is
  'Public URL of the genre card art in the book-covers bucket (genres/ prefix). NULL = built-in art, then the plain panel.';
