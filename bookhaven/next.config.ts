import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Book covers are uploaded to Supabase Storage by the admin. Only that
    // project's public storage host is allowed through the image optimiser.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "luniopceavtkljywukyi.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
