// Turns untrusted input into a redirect target that cannot leave this site.
//
// WHY THIS FILE EXISTS
//   /login?next=… is attacker-controlled: it is the classic place to hide an
//   open redirect ("sign in, then land on evil.com"). The previous check
//   compared the RAW string against a few prefixes:
//
//       raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")
//
//   That is not how a browser reads a URL. The WHATWG URL parser strips tab,
//   newline and carriage-return characters BEFORE parsing, so
//
//       "/\t/evil.com"  ->  "//evil.com"  ->  https://evil.com/
//
//   passes every one of those prefix tests and still navigates off-site. The
//   same is true of a backslash ("/\evil.com"), which browsers treat as "/".
//
// THE RULE
//   1. Reject anything that is not a string, is empty, or is absurdly long.
//   2. Reject control characters (U+0000–U+001F, U+007F) and backslashes
//      outright — the parser removes or rewrites both, so a string that
//      contains them cannot be judged by its literal characters.
//   3. Require a leading "/" (a relative path, never a scheme or host).
//   4. Parse with new URL() against a dummy origin and require the resulting
//      origin to still be that dummy origin. This is the only reliable test:
//      it uses the same algorithm the browser will use.
//   5. Return pathname + search only. Any hash or credentials are dropped.
//
//   Note on encoded slashes: "/%2F%2Fevil.com" is a path, not a host, and is
//   accepted by the URL parser as same-origin. We still reject a decoded form
//   that would begin with "//" or contain a backslash, so a later decode step
//   cannot turn an accepted value into a protocol-relative URL.

const PLACEHOLDER_ORIGIN = "https://bookhaven.invalid";
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;
const BACKSLASH = /\\/;
const MAX_LENGTH = 300;

/**
 * @param {unknown} raw  the `next` query value
 * @returns {string|null} a same-origin path ("/checkout?step=2"), or null
 */
export function safeNextPath(raw, { maxLength = MAX_LENGTH } = {}) {
  if (typeof raw !== "string") return null;

  const value = raw.trim();
  if (!value || value.length > maxLength) return null;

  // Step 2: characters the URL parser would silently remove or rewrite.
  if (CONTROL_CHARS.test(value) || BACKSLASH.test(value)) return null;
  if (!value.startsWith("/")) return null;

  let url;
  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return null;
  }

  // Step 4: the parsed origin must be the dummy origin, unchanged.
  if (url.origin !== PLACEHOLDER_ORIGIN) return null;
  if (!url.pathname.startsWith("/")) return null;

  // Step 5: a second decoding must not reveal an off-site path.
  try {
    const decoded = decodeURIComponent(url.pathname);
    if (decoded.startsWith("//") || BACKSLASH.test(decoded)) return null;
  } catch {
    // Malformed percent-encoding: refuse rather than guess.
    return null;
  }

  return `${url.pathname}${url.search}`;
}
