-- The new wishlists.book_id foreign key needs its own index.
--
-- STATUS: APPLIED 2026-10-27 as version 20261027173820.
--
-- `wishlists_user_id_book_id_key` is unique on (user_id, book_id), so book_id
-- is its second column and cannot serve a lookup by book_id. Without this,
-- deleting a book scans the whole wishlist table to find the rows to cascade
-- — and the cascade is the reason the key exists.
--
-- The table is empty today (0 rows), so this costs nothing to build.
create index if not exists idx_wishlists_book_id
  on public.wishlists (book_id);

-- Rollback: drop index if exists public.idx_wishlists_book_id;
