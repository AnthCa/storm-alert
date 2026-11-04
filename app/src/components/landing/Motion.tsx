"use client";

import { useEffect, useRef, useState } from "react";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Calls `onShow` once, when the element first scrolls into view. */
function useInView<T extends Element>(onShow: () => void, threshold = 0.2) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onShow();
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // The callback only flips state once; re-observing would replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

/**
 * Fades and lifts its content in when it scrolls into view. Hidden only once the page
 * knows JavaScript runs (`html.js`, set in the layout), so content never stays invisible.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const [shown, setShown] = useState(false);
  const ref = useInView<HTMLDivElement>(() => setShown(true), 0.15);
  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement & HTMLLIElement>}
      className={`reveal ${shown ? "is-shown" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

/** A number that counts up from zero the first time it is seen. */
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState<number | null>(null);
  const ref = useInView<HTMLSpanElement>(() => {
    if (reducedMotion()) return setShown(value);
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 1400);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, 0.5);
  return (
    <span ref={ref} className="tabular-nums">
      {shown ?? value}
      {suffix}
    </span>
  );
}

/**
 * The story's vertical line fills as the reader scrolls through it, and a small satellite
 * rides its tip, the way the satellite followed the storm.
 */
export function ScrollTrack({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      const anchor = window.innerHeight * 0.55;
      setProgress(Math.min(1, Math.max(0, (anchor - box.top) / box.height)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div ref={ref} className="relative">
      <div className="absolute top-2 bottom-2 left-[7px] w-0.5 bg-line" aria-hidden="true" />
      <div
        className="absolute top-2 left-[7px] w-0.5 origin-top bg-gradient-to-b from-severe via-convective to-quiet"
        style={{ height: `calc((100% - 1rem) * ${progress})` }}
        aria-hidden="true"
      />
      <div
        className="satellite absolute left-[8px] -translate-x-1/2 -translate-y-1/2"
        style={{ top: `calc(0.5rem + (100% - 1rem) * ${progress})` }}
        aria-hidden="true"
      >
        <svg width="34" height="34" viewBox="0 0 34 34">
          <circle cx="17" cy="17" r="16" fill="#0e1116" stroke="#24486b" />
          <rect x="13" y="13" width="8" height="8" rx="1.5" fill="#d6dee7" />
          <rect x="4" y="14" width="7" height="6" rx="1" fill="#38d6e8" opacity="0.85" />
          <rect x="23" y="14" width="7" height="6" rx="1" fill="#38d6e8" opacity="0.85" />
          <path d="M11 17h2M21 17h2" stroke="#d6dee7" strokeWidth="1.5" />
          <circle cx="17" cy="25" r="1.6" fill="#ffe14d" />
        </svg>
      </div>
      {children}
    </div>
  );
}
