// Single source of truth for the *public* Supabase configuration.
//
// The URL and anon key are public by design (they ship to every browser),
// so falling back to the known project values keeps the deployed app
// working even if the NEXT_PUBLIC_* variables have not been set yet.
// Server-only secrets (SUPABASE_SERVICE_ROLE_KEY, M-Pesa credentials) are
// NEVER read here — they live only in process.env on the server.

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://luniopceavtkljywukyi.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1bmlvcGNlYXZ0a2xqeXd1a3lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNzk1NTUsImV4cCI6MjA5NDc1NTU1NX0.zmZcxS2uxyon8Est9l3feYLuYy02hgcIpCNKAqKWtCE";
