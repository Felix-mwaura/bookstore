// Turning `?next=` into a value that can only ever stay on this site.
//
// The login page used to accept anything that started with a single slash:
//
//     raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")
//
// A browser strips tab, newline and carriage-return characters *before* it
// parses a URL, so all three of the strings below pass that check and then
// resolve to https://evil.com/:
//
//     "/\t/evil.com"   "/\n/evil.com"   "/\r/evil.com"
//
// `router.replace()` hands the string to the History API, and the browser
// normalises the control characters away. That is an open redirect that can
// be used to make a phishing page look like it came from a real sign-in.
//
// The rule here is allow-list, not deny-list: resolve the candidate against a
// dummy origin and accept it only if the result is still that dummy origin and
// the path begins with exactly one slash. Anything that would leave the origin
// — a scheme, `//host`, a backslash (which some browsers read as `/`), an
// encoded slash pair, or embedded control characters — is rejected outright.

const DUMMY_ORIGIN = "https://bookhaven.invalid";
const MAX_LENGTH = 300;

/** True when the string contains a control character or a backslash. */
export function hasUnsafeCharacters(value) {
  // C0 controls and DEL, plus the Unicode line/paragraph separators that some
  // parsers treat as newlines.
  return /[\u0000-\u001f\u007f\u2028\u2029\\]/.test(value);
}

/**
 * @param {unknown} raw the value of `?next=`
 * @returns {string|null} a same-origin path (pathname + search + hash), or null
 */
export function safeNextPath(raw) {
  if (typeof raw !== "string") return null;
  if (!raw || raw.length > MAX_LENGTH) return null;
  if (!raw.startsWith("/")) return null;
  if (hasUnsafeCharacters(raw)) return null;

  let url;
  try {
    url = new URL(raw, DUMMY_ORIGIN);
  } catch {
    return null;
  }

  if (url.origin !== DUMMY_ORIGIN) return null;

  // `new URL("//evil.com", origin)` changes the origin (already rejected
  // above); this also catches the normalised forms that keep the origin but
  // lose the leading slash, e.g. "/..//evil.com".
  if (!url.pathname.startsWith("/") || url.pathname.startsWith("//")) return null;

  const target = `${url.pathname}${url.search}${url.hash}`;

  // Encoded forms are rejected too. Nothing downstream should decode this
  // value, but if a future caller does, "%2F%2Fevil.com" must not become a
  // protocol-relative URL and "%5C" must not become a backslash.
  let decoded;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (decoded.startsWith("//") || hasUnsafeCharacters(decoded)) return null;

  // Backstop: recompute from the final string. If resolving it again moves the
  // origin, the value is not safe no matter how it was built.
  try {
    if (new URL(target, DUMMY_ORIGIN).origin !== DUMMY_ORIGIN) return null;
  } catch {
    return null;
  }

  return target;
}
