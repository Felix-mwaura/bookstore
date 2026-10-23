// Decorative bookstore scene for the sign-up / sign-in page.
//
// Four kittens — Mochi, Biscuit, Shadow and Ash — wander, nap and swish
// their tails around a shelf, a plant and a rug. Everything here is inert:
// the whole layer is `aria-hidden` and `pointer-events: none`, it is drawn
// behind the form, and every movement is a CSS transform in
// ./kitten-scene.module.css so nothing triggers layout. With
// `prefers-reduced-motion: reduce` the animation stops and the kittens sit
// still in pleasant positions.
//
// No images, no animation library, no canvas: just SVG and CSS, so there is
// nothing to download and no hydration mismatch to worry about: there is no
// state, no effect and no randomness here, so the server and the browser
// render byte-identical markup.

import s from "./kitten-scene.module.css";

const FUR = {
  cream: { body: "#F5E7CE", shade: "#E6D0AC", ear: "#E3A29B", eye: "#3A3226", nose: "#C98A7F", whisker: "#C9B695" },
  orange: { body: "#EDA968", shade: "#D8863F", ear: "#F0C6A6", eye: "#3A3226", nose: "#B4643F", whisker: "#C98F55" },
  tuxedo: { body: "#2E3038", shade: "#1E2026", ear: "#C98F8C", eye: "#F7F2E8", nose: "#C98F8C", whisker: "#7C7F88", bib: "#F7F2E8" },
  grey: { body: "#B7BBC4", shade: "#9CA1AC", ear: "#E3A29B", eye: "#3A3226", nose: "#8C7A78", whisker: "#8F939C" },
};

function Ribbon() {
  return (
    <>
      <path d="M76 51 q12 4 26 0" stroke="#1B2A4A" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M95 53 l7 -4 l0 8 z" fill="#1B2A4A" />
      <circle cx="95" cy="53" r="2.4" fill="#B5532F" />
    </>
  );
}

function WalkingKitten({ variant = "cream", ribbon = false }) {
  const c = FUR[variant];
  return (
    <svg
      viewBox="0 0 120 86"
      width="112"
      height="80"
      role="presentation"
      focusable="false"
    >
      <path
        className={s.tail}
        d="M32 58 C16 56 12 38 22 30"
        fill="none"
        stroke={c.shade}
        strokeWidth="9"
        strokeLinecap="round"
      />
      <rect x="36" y="62" width="13" height="16" rx="6.5" fill={c.shade} />
      <rect x="58" y="64" width="13" height="16" rx="6.5" fill={c.shade} />
      <ellipse cx="55" cy="58" rx="31" ry="19" fill={c.body} />
      {c.bib ? <ellipse cx="60" cy="65" rx="19" ry="11" fill={c.bib} /> : null}
      <rect x="72" y="62" width="13" height="18" rx="6.5" fill={c.body} />
      <circle cx="88" cy="38" r="17" fill={c.body} />
      <path d="M74 24 L72 8 L86 20 Z" fill={c.body} />
      <path d="M102 24 L104 8 L90 20 Z" fill={c.body} />
      <path d="M77 22 L76 13 L83 20 Z" fill={c.ear} />
      <path d="M99 22 L100 13 L93 20 Z" fill={c.ear} />
      <circle cx="83" cy="37" r="2.6" fill={c.eye} />
      <circle cx="94" cy="37" r="2.6" fill={c.eye} />
      <path d="M87 43 h4 l-2 2.6 z" fill={c.nose} />
      <path
        d="M78 42 l-6 -1 M78 45 l-6 2 M100 42 l6 -1 M100 45 l6 2"
        stroke={c.whisker}
        strokeWidth="1"
        strokeLinecap="round"
      />
      {ribbon ? <Ribbon /> : null}
    </svg>
  );
}

function SleepingKitten({ variant = "tuxedo" }) {
  const c = FUR[variant];
  return (
    <svg viewBox="0 0 130 80" width="126" height="78" role="presentation" focusable="false">
      <ellipse cx="62" cy="70" rx="40" ry="6" fill="#D9C9A9" opacity="0.45" />
      <ellipse cx="60" cy="58" rx="37" ry="16" fill={c.body} />
      {c.bib ? <ellipse cx="62" cy="63" rx="22" ry="9" fill={c.bib} /> : null}
      <circle cx="95" cy="54" r="15" fill={c.body} />
      <path d="M83 43 L81 31 L93 41 Z" fill={c.body} />
      <path d="M106 43 L108 31 L96 41 Z" fill={c.body} />
      <path d="M86 41 L85 34 L91 40 Z" fill={c.ear} />
      <path d="M103 41 L104 34 L98 40 Z" fill={c.ear} />
      <path d="M88 55 q4 3 8 0" stroke={c.eye} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M99 55 q4 3 8 0" stroke={c.eye} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M95 60 h3.6 l-1.8 2.2 z" fill={c.nose} />
      <path d="M40 68 q-16 -4 -12 -18" stroke={c.shade} strokeWidth="8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function SittingKitten({ variant = "grey" }) {
  const c = FUR[variant];
  return (
    <svg viewBox="0 0 100 100" width="96" height="96" role="presentation" focusable="false">
      <ellipse cx="50" cy="94" rx="33" ry="5" fill="#D9C9A9" opacity="0.45" />
      <path d="M20 94 C18 62 34 46 50 46 C66 46 82 62 80 94 Z" fill={c.body} />
      {c.bib ? <path d="M38 94 C38 72 44 62 50 62 C56 62 62 72 62 94 Z" fill={c.bib} /> : null}
      <circle cx="50" cy="36" r="17" fill={c.body} />
      <path d="M36 22 L34 6 L48 18 Z" fill={c.body} />
      <path d="M64 22 L66 6 L52 18 Z" fill={c.body} />
      <path d="M39 20 L38 11 L45 18 Z" fill={c.ear} />
      <path d="M61 20 L62 11 L55 18 Z" fill={c.ear} />
      <circle cx="45" cy="35" r="2.6" fill={c.eye} />
      <circle cx="56" cy="35" r="2.6" fill={c.eye} />
      <path d="M48.5 41 h4 l-2 2.4 z" fill={c.nose} />
      <path
        d="M42 39 l-5 -1 M42 42 l-5 2 M58 39 l5 -1 M58 42 l5 2"
        stroke={c.whisker}
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        className={s.tail}
        d="M78 92 q16 -8 8 -26"
        stroke={c.shade}
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Butterfly() {
  return (
    <svg viewBox="0 0 24 20" width="22" height="18" role="presentation" focusable="false">
      <g className={s.butterfly}>
        <path d="M12 10 C6 2 0 5 3 10 C0 15 6 18 12 10 Z" fill="#E0A458" opacity="0.9" />
        <path d="M12 10 C18 2 24 5 21 10 C24 15 18 18 12 10 Z" fill="#E8B66F" opacity="0.9" />
        <path d="M12 7 v7" stroke="#8C5A22" strokeWidth="1.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** The room: floor, rug, shelf, plant, books and a mug. */
function Room() {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 800 260"
      preserveAspectRatio="xMidYMax meet"
      role="presentation"
      focusable="false"
      aria-hidden="true"
    >
      <rect x="0" y="206" width="800" height="54" fill="#F0E4CD" />
      <ellipse cx="400" cy="234" rx="240" ry="24" fill="#E6D5B4" />

      {/* shelf, right edge */}
      <g opacity="0.9">
        <rect x="690" y="86" width="8" height="128" rx="3" fill="#C9B48C" />
        <rect x="700" y="86" width="100" height="7" rx="3" fill="#C9B48C" />
        <rect x="700" y="150" width="100" height="7" rx="3" fill="#C9B48C" />
        <rect x="706" y="118" width="13" height="32" rx="2" fill="#1B2A4A" />
        <rect x="721" y="124" width="11" height="26" rx="2" fill="#B5532F" />
        <rect x="734" y="112" width="14" height="38" rx="2" fill="#7C8A6B" />
        <rect x="750" y="126" width="10" height="24" rx="2" fill="#C9A227" />
        <rect x="707" y="182" width="15" height="36" rx="2" fill="#B5532F" />
        <rect x="724" y="188" width="11" height="30" rx="2" fill="#1B2A4A" />
        <rect x="737" y="176" width="13" height="42" rx="2" fill="#8A6B4F" />
      </g>

      {/* plant, left edge */}
      <g opacity="0.95">
        <path d="M40 206 h44 l-6 34 h-32 z" fill="#B5532F" opacity="0.85" />
        <path d="M62 206 C46 186 44 166 60 150 C70 168 70 188 62 206 Z" fill="#7C8A6B" />
        <path d="M62 206 C78 190 84 172 74 156 C62 172 58 190 62 206 Z" fill="#6B7A5B" />
        <path d="M62 206 C48 196 36 190 26 192 C38 202 50 208 62 206 Z" fill="#8C9A7B" />
      </g>

      {/* stack of books, centre-left */}
      <g>
        <rect x="150" y="188" width="74" height="12" rx="3" fill="#1B2A4A" />
        <rect x="157" y="177" width="66" height="11" rx="3" fill="#B5532F" />
        <rect x="163" y="167" width="54" height="10" rx="3" fill="#C9A227" />
      </g>

      {/* mug */}
      <g>
        <rect x="268" y="190" width="26" height="22" rx="5" fill="#F7F2E8" stroke="#D9C9A9" strokeWidth="2" />
        <path d="M294 196 q8 0 8 6 q0 6 -8 6" fill="none" stroke="#D9C9A9" strokeWidth="2.5" />
      </g>
    </svg>
  );
}

export default function KittenScene() {
  return (
    <div className={s.scene} aria-hidden="true">
      <Room />

      {/* Mochi — cream kitten with the navy ribbon, wandering left to right */}
      <div
        className={s.walker}
        style={{ "--dur": "54s", "--delay": "-8s", "--bottom": "20px" }}
      >
        <div className={s.bob}>
          <WalkingKitten variant="cream" ribbon />
        </div>
      </div>

      {/* Biscuit — orange, heading the other way, following a butterfly */}
      <div
        className={`${s.walker} ${s.walkerLeft}`}
        style={{ "--dur": "68s", "--delay": "-30s", "--bottom": "8px" }}
      >
        <div className={s.bob}>
          <WalkingKitten variant="orange" />
        </div>
      </div>

      {/* Shadow — asleep on the books. Hidden on phones. */}
      <div className="absolute bottom-[10px] left-[16%] hidden sm:block">
        <div className={s.breathe} style={{ "--tail-delay": "-2s" }}>
          <SleepingKitten variant="tuxedo" />
        </div>
      </div>

      {/* Ash — sitting by the stack, tail swishing */}
      <div className="absolute bottom-[6px] right-[26%] hidden lg:block">
        <div className={s.playful} style={{ "--tail-delay": "-4s" }}>
          <SittingKitten variant="grey" />
        </div>
      </div>

      {/* Biscuit's butterfly, drifting above the rug */}
      <div className="absolute bottom-[92px] right-[38%] hidden sm:block">
        <Butterfly />
      </div>
    </div>
  );
}
