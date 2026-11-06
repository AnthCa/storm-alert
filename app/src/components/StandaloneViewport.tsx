"use client";

import { useEffect } from "react";

/**
 * iOS 26 home-screen apps can start with a viewport shorter than the screen, which lifts
 * the tab bar until the page is dragged once. Scrolling by a pixel and back makes Safari
 * measure the viewport again, as the drag does. Only in the installed app on iOS.
 */
export function StandaloneViewport() {
  useEffect(() => {
    const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone) return;
    const remeasure = () =>
      requestAnimationFrame(() => {
        window.scrollTo(0, 1);
        window.scrollTo(0, 0);
      });
    remeasure();
    const onVisible = () => document.visibilityState === "visible" && remeasure();
    window.addEventListener("pageshow", remeasure);
    window.addEventListener("orientationchange", remeasure);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pageshow", remeasure);
      window.removeEventListener("orientationchange", remeasure);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
