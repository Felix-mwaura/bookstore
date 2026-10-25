// Safe serialisation for <script type="application/ld+json">.
//
// WHY THIS FILE EXISTS
//   JSON.stringify() is not HTML-safe. A book description of
//
//       </script><script>steal()</script>
//
// is perfectly valid JSON, and it is written into the page with
// dangerouslySetInnerHTML — so the browser closes the JSON-LD block at that
// "</script>", and everything after it is real HTML. Book rows are written by
// an admin, but "only an admin can write it" is not a reason to ship an
// injection sink: an imported CSV, a compromised admin session or a future
// bulk-import path reaches the same code.
//
// THE FIX
//   Replace the five characters that matter AFTER stringification:
//     "<", ">"  cannot start a tag
//     "&"       cannot start a character reference that re-encodes a tag
//     U+2028/9  are line terminators inside JS string literals (harmless in
//               JSON.parse, but escaped anyway for old parsers)
//   The escapes are JSON/JS string escapes, so JSON.parse() returns the
//   original value; only the HTML representation changes.

const ESCAPES = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

/**
 * JSON for embedding inside a <script> element.
 *
 * @param {unknown} value  anything JSON.stringify accepts
 * @returns {string} a string containing no "<", ">", "&" or raw separators
 */
export function serialiseJsonLd(value) {
  const json = JSON.stringify(value);
  if (typeof json !== "string") return "null";
  return json.replace(/[<>&\u2028\u2029]/g, (char) => ESCAPES[char]);
}
