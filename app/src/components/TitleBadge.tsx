"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { minutesOld, STALE_AFTER_MIN } from "@/lib/status";
import { useStatus } from "./StatusProvider";

const PREFIX = { severe: "⚠ Actividad intensa · ", deep_convection: "☁ Nubes de tormenta · " } as const;

/** Puts the live level in the tab title, so a background tab shows it without opening it. */
export function TitleBadge() {
  const { status, demo } = useStatus();
  const pathname = usePathname();
  useEffect(() => {
    const base = document.title.replace(/^(⚠ Actividad intensa|☁ Nubes de tormenta) · /, "");
    const level = status?.level;
    // Old data must not keep claiming activity in the tab.
    const fresh = status !== null && minutesOld(status, new Date()) <= STALE_AFTER_MIN;
    const prefix = !demo && fresh && (level === "severe" || level === "deep_convection") ? PREFIX[level] : "";
    document.title = prefix + base;
  }, [status, demo, pathname]);
  return null;
}
