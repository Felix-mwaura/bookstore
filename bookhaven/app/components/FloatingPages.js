"use client";

import { useEffect, useRef } from "react";
import s from "./floating-pages.module.css";

// The decoration has no input or focus targets. Pause its looping movement
// while it is offscreen or the tab is hidden, without touching the form.
function useRestWhenHidden(sceneRef) {
  useEffect(() => {
    const node = sceneRef.current;
    if (!node) return;
    let onScreen = true;
    const sync = () => {
      if (document.hidden || !onScreen) node.dataset.motion = "paused";
      else delete node.dataset.motion;
    };
    const observer = "IntersectionObserver" in window
      ? new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); })
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

function Page({ className }) {
  return (
    <svg className={className} viewBox="0 0 100 125" focusable="false">
      <path d="M13 9h58l18 18v90H13z" fill="#F7F2E8" stroke="#CBBDA6" strokeWidth="2" />
      <path d="M71 9v18h18" fill="#E8DDCB" stroke="#CBBDA6" strokeWidth="2" />
      <path d="M25 46h49M25 57h43M25 68h48M25 79h32" stroke="#CBBDA6" strokeWidth="2" strokeLinecap="round" />
      <path d="M34 9h15v36l-7.5-6-7.5 6z" fill="#B5532F" />
    </svg>
  );
}

function Bookmark({ className }) {
  return (
    <svg className={className} viewBox="0 0 70 120" focusable="false">
      <path d="M8 6h54v106L35 94 8 112z" fill="#1B2A4A" />
      <path d="M15 15h40v76L35 78 15 91z" fill="none" stroke="#F7F2E8" strokeOpacity=".6" strokeWidth="2" />
      <path d="M22 25h26M22 32h26" stroke="#F7F2E8" strokeOpacity=".6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function FloatingPages({ children }) {
  const sceneRef = useRef(null);
  useRestWhenHidden(sceneRef);

  return (
    <div className={s.scene}>
      <div ref={sceneRef} className={s.decoration} aria-hidden="true">
        <Bookmark className={`${s.item} ${s.topLeft}`} />
        <Page className={`${s.item} ${s.topRight}`} />
        <Page className={`${s.item} ${s.bottomLeft}`} />
        <Bookmark className={`${s.item} ${s.bottomRight}`} />
      </div>
      <div className={s.cardSlot}>{children}</div>
    </div>
  );
}
