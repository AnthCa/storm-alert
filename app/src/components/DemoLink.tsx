"use client";

import { useRouter } from "next/navigation";
import { PlayIcon } from "./Icons";
import { useStatus } from "./StatusProvider";

export function DemoLink() {
  const { setDemo } = useStatus();
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        setDemo(true);
        router.push("/?demo=requinoa");
      }}
      className="flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-accent font-semibold text-white"
    >
      <PlayIcon size={18} /> Ver el tornado en el mapa
    </button>
  );
}
