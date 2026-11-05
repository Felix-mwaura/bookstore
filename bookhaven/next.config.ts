import type { NextConfig } from "next";

// Book covers are uploaded to Supabase Storage by the admin. Only that
// project's public storage host is allowed through the image optimiser, and
// it follows NEXT_PUBLIC_SUPABASE_URL if the project ever moves.
// No hard-coded host: if the variable is missing the optimiser simply has no
// remote pattern, rather than silently trusting one particular project.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : null;

// A conservative set of response headers.
//
// The CSP deliberately does not restrict script-src: Next.js ships inline
// bootstrap scripts, and a strict policy without a working nonce would break
// the app. These directives still block framing, plugin content, base-tag
// hijacking and form posts to other origins — the attacks that matter here.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Empty when the project URL is not configured, so a fresh clone cannot
    // optimise images from a host it was never told about.
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https" as const,
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  async headers() {
    // Pages nobody should find in a search result: a checkout with someone's
    // basket in it, an account page, the order lookup, the admin dashboard and
    // the sign-in form. robots.txt already asks crawlers to stay out, but a
    // disallowed URL can still be listed (and a URL leaked from a browser bar
    // does not consult robots.txt at all). X-Robots-Tag works without the
    // crawler being allowed to fetch the page, so the two rules agree instead
    // of contradicting each other.
    const privatePaths = ["/admin/:path*", "/account/:path*", "/checkout/:path*", "/orders/:path*", "/login"];
    return [
      { source: "/:path*", headers: securityHeaders },
      ...privatePaths.map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
    ];
  },
};

export default nextConfig;
