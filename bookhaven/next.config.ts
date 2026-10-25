import type { NextConfig } from "next";
import { assertProductionBuildEnv } from "./app/lib/env.js";

// Refuse to build a production bundle without the public configuration.
// Without this the build would silently fall back to the project this site
// was first deployed against. Runs at build time only (NEXT_PHASE), so a
// running deployment is never affected. See app/lib/env.js.
assertProductionBuildEnv();

// Book covers are uploaded to Supabase Storage by the admin. Only that
// project's public storage host is allowed through the image optimiser, and
// it follows NEXT_PUBLIC_SUPABASE_URL if the project ever moves.
const supabaseHost = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://luniopceavtkljywukyi.supabase.co"
).hostname;

// A conservative set of response headers.
//
// The Content-Security-Policy is NOT here: it needs a per-response nonce, so
// it is built in proxy.js (app/lib/csp.js). Two CSP headers would both be
// enforced and their intersection is what the browser applies, which is a
// silent way to break the app. One policy, one place.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
