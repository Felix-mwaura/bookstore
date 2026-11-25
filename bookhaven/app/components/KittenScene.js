"use client";

import { useEffect, useRef } from "react";

import s from "./kitten-scene.module.css";

const FUR = {
  cream: { body: "#F5E7CE", shade: "#CDBB9D", ear: "#C77D60", eye: "#1B2A4A", nose: "#B5532F", whisker: "#927E68" },
  orange: { body: "#C77D54", shade: "#9B4E32", ear: "#E9B795", eye: "#1B2A4A", nose: "#743B2A", whisker: "#F5E7CE" },
  tuxedo: { body: "#34445F", shade: "#1B2A4A", ear: "#C77D60", eye: "#F7F2E8", nose: "#E9B795", whisker: "#F5E7CE", bib: "#F7F2E8" },
};

/**
 * Pause every loop in the scene while it cannot be seen.
 *
 * `animation-play-state` is inherited by nothing, so the rule in the module
 * stylesheet targets the children. Paused rather than stopped: resuming puts
 * the kittens back mid-stride instead of snapping them to the start of a
 * 54-second walk.
 */
function useRestWhenHidden(sceneRef) {
  useEffect(() => {
    const node = sceneRef.current;
    if (!node) return;

    let onScreen = true;

    const sync = () => {
      const pause = document.hidden || !onScreen;
      if (pause) node.dataset.motion = "paused";
      else delete node.dataset.motion;
    };

    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(([entry]) => {
            onScreen = entry.isIntersecting;
            sync();
          })
        : null;
    observer?.observe(node);

    document.addEventListener("visibilitychange", sync);
    sync();

    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", sync);
      delete node.dataset.motion;
    };
  }, [sceneRef]);
}

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
      <ellipse cx="55" cy="58" rx="31" ry="19" fill={c.shade} />
      <ellipse cx="55" cy="54" rx="30" ry="17" fill={c.body} />
      <path d="M33 51 C38 42 53 39 65 42" fill="none" stroke="#F7F2E8" strokeWidth="4" strokeLinecap="round" opacity="0.25" />
      {c.bib ? <ellipse cx="60" cy="65" rx="19" ry="11" fill={c.bib} /> : null}
      <rect x="72" y="62" width="13" height="18" rx="6.5" fill={c.body} />
      <circle cx="88" cy="39" r="17" fill={c.shade} />
      <ellipse cx="88" cy="36" rx="17" ry="16" fill={c.body} />
      <ellipse cx="88" cy="43" rx="8" ry="5" fill="#F7F2E8" opacity="0.55" />
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
      <ellipse cx="60" cy="59" rx="37" ry="16" fill={c.shade} />
      <ellipse cx="60" cy="55" rx="36" ry="15" fill={c.body} />
      <path d="M34 53 C39 43 56 41 69 44" fill="none" stroke="#F7F2E8" strokeWidth="4" strokeLinecap="round" opacity="0.24" />
      {c.bib ? <ellipse cx="62" cy="63" rx="22" ry="9" fill={c.bib} /> : null}
      <circle cx="95" cy="55" r="15" fill={c.shade} />
      <ellipse cx="95" cy="52" rx="15" ry="14" fill={c.body} />
      <ellipse cx="97" cy="60" rx="7" ry="4" fill="#F7F2E8" opacity="0.38" />
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

function SittingKitten({ variant = "orange" }) {
  const c = FUR[variant];
  return (
    <svg viewBox="0 0 100 100" width="96" height="96" role="presentation" focusable="false">
      <ellipse cx="50" cy="94" rx="33" ry="5" fill="#D9C9A9" opacity="0.45" />
      <path d="M20 94 C18 62 34 46 50 46 C66 46 82 62 80 94 Z" fill={c.shade} />
      <path d="M25 91 C24 63 36 48 50 48 C64 48 76 63 75 91 Z" fill={c.body} />
      <path d="M34 68 C36 56 41 52 45 51" stroke="#F7F2E8" strokeWidth="4" strokeLinecap="round" opacity="0.28" fill="none" />
      {c.bib ? <path d="M38 94 C38 72 44 62 50 62 C56 62 62 72 62 94 Z" fill={c.bib} /> : null}
      <circle cx="50" cy="38" r="17" fill={c.shade} />
      <ellipse cx="50" cy="35" rx="17" ry="16" fill={c.body} />
      <ellipse cx="50" cy="42" rx="8" ry="5" fill="#F7F2E8" opacity="0.5" />
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

// This scene occupies its own space at the bottom of the form card, never
// over the controls. Each kitten stays in a bounded lane on narrow screens.
export default function KittenScene({ placement = "bottom" }) {
  const sceneRef = useRef(null);
  useRestWhenHidden(sceneRef);

  if (placement === "top") {
    return (
      <div ref={sceneRef} className={`${s.scene} ${s.topScene}`} aria-hidden="true">
        <div className={s.sleeping}>
          <div className={s.breathe}><SleepingKitten variant="cream" /></div>
        </div>
      </div>
    );
  }

  return (
    <div ref={sceneRef} className={s.scene} aria-hidden="true">
      <div className={s.sleeping}>
        <div className={s.breathe}><SleepingKitten variant="tuxedo" /></div>
      </div>
      <div className={s.sitting}>
        <div className={s.playful}><SittingKitten variant="orange" /></div>
      </div>
      <div className={s.track}>
        <div className={s.walker}>
          <div className={s.bob}><WalkingKitten variant="cream" ribbon /></div>
        </div>
      </div>
    </div>
  );
}
