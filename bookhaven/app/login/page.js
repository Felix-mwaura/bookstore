import AuthPage from "./AuthClient";
import { safeNextPath } from "../lib/safe-redirect";

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
  // redirect. The decision is made by safeNextPath(), which PARSES the value
  // with the same URL algorithm a browser uses — prefix matching is not enough,
  // because "/<tab>/evil.com" is read as "//evil.com" by the parser and would
  // otherwise navigate to another site. Backslashes, control characters,
  // protocol-relative URLs and encoded "//" are all rejected there.
  const nextPath = safeNextPath(typeof params.next === "string" ? params.next : "");

  return <AuthPage mode={mode} tab={tab} nextPath={nextPath} />;
}
