import AuthPage from "./AuthClient";

export const metadata = {
  title: "Sign in · Book Haven",
  description: "Sign in to Book Haven to track orders, save favourites and check out faster.",
};

// Reading the query string on the server means the page renders its real
// content on the first response instead of a "Loading…" placeholder, so
// there is nothing to shift once the JavaScript arrives.
export default async function LoginPage({ searchParams }) {
  const params = (await searchParams) ?? {};

  const mode = params.mode === "reset" ? "reset" : "signin";
  const tab = params.tab === "register" ? "register" : "signin";

  // Only same-origin paths are accepted, so /login cannot be used as an open
  // redirect. `//evil.com` and `/%2F%2Fevil.com` are rejected too: the value
  // has to start with a single slash and not with a backslash or a scheme.
  const raw = typeof params.next === "string" ? params.next : "";
  const nextPath =
    raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw.slice(0, 300) : null;

  return <AuthPage mode={mode} tab={tab} nextPath={nextPath} />;
}
