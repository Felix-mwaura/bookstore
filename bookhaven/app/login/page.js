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
  // redirect. The check is an allow-list (resolve against a dummy origin and
  // require the origin to survive) rather than a list of known-bad shapes:
  // browsers strip tab/newline/CR before parsing, so `"/\t/evil.com"` used to
  // pass the old prefix test and then navigate to https://evil.com/.
  const raw = typeof params.next === "string" ? params.next : "";
  const nextPath = safeNextPath(raw);

  return <AuthPage mode={mode} tab={tab} nextPath={nextPath} />;
}
