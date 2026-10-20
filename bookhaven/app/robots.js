import { SITE_URL } from "./lib/site";

// Only public, indexable pages belong here. /admin, /account, /checkout,
// /login and /orders/* are deliberately excluded (they are also disallowed in
// robots.txt) so they never surface in search results.
export default async function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/account", "/checkout", "/orders/", "/login", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
