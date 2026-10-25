-- Index for the per-phone M-Pesa rate limit.
--
-- app/api/mpesa/stk/route.js now counts pushes by (phone, created_at) inside a
-- ten-minute window. Without an index that is a sequential scan of every
-- payment the shop has ever taken, on every push — small today, painful later.
--
-- Partial on phone IS NOT NULL because every row written before the phone was
-- persisted has no number; those rows can never match the query.

create index if not exists mpesa_payments_phone_created_idx
  on public.mpesa_payments (phone, created_at desc)
  where phone is not null;

-- Rollback:
--   drop index if exists public.mpesa_payments_phone_created_idx;
