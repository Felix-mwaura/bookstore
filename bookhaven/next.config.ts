import type { NextConfig } from "next";

// Book covers are uploaded to Supabase Storage by the admin. Only that
// project's public storage host is allowed through the image optimiser, and
// it follows NEXT_PUBLIC_SUPABASE_URL if the project ever moves.
const supabaseHost = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://luniopceavtkljywukyi.supabase.co"
).hostname;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
