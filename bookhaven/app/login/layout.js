// The page itself is a client component, so its noindex/title live here.
export const metadata = {
  title: "Sign in",
  description: "Sign in to Book Haven to track orders, save books and check out faster.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/login" },
};

export default function LoginLayout({ children }) {
  return children;
}
