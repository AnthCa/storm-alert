"use client";

import { useState } from "react";
import { APP_URL, shareMessage } from "@/lib/share";
import type { Status } from "@/lib/status";
import { ShareIcon } from "./Icons";

export function ShareStatus({ status }: { status: Status }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const text = shareMessage(status);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Miranubes", text, url: APP_URL });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${APP_URL}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // The viewer closed the share sheet or the clipboard is blocked: nothing to do.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line text-sm font-semibold text-fg"
    >
      <ShareIcon size={18} /> {copied ? "Copiado" : "Compartir estado"}
    </button>
  );
}
