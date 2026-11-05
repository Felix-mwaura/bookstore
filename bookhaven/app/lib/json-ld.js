// Serialising structured data for a <script type="application/ld+json"> tag.
//
// JSON.stringify alone is not safe here. The HTML parser ends a script element
// at the first literal "</script", wherever it appears — including inside a
// JSON string. A book title of
//
//     </script><script>alert(document.cookie)</script>
//
// therefore closes the JSON-LD block and opens a real script block. React's
// dangerouslySetInnerHTML does not escape anything for us: it is documented as
// the caller's job.
//
// Escaping happens inside JSON string syntax (\u003c is a valid JSON escape
// for "<"), so the parsed object is byte-for-byte identical to the input while
// the document contains no "<" that the HTML parser could act on. The same
// treatment covers ">", "&" and the U+2028/U+2029 line separators that some
// older engines treat as newlines.

const ESCAPES = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

/** JSON with every character that can end or confuse the script element escaped. */
export function serializeJsonLd(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (char) => ESCAPES[char]);
}

/** Props for `<script {...jsonLdProps(obj)} />`. */
export function jsonLdProps(value) {
  return {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: serializeJsonLd(value) },
  };
}
