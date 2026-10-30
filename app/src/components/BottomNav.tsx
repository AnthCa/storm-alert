"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellIcon, InfoIcon, MapIcon } from "./Icons";

const ITEMS = [
  { href: "/", label: "Mapa", Icon: MapIcon },
  { href: "/avisos", label: "Avisos", Icon: BellIcon },
  { href: "/como-funciona", label: "Cómo funciona", Icon: InfoIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)]"
      aria-label="Principal"
    >
      {ITEMS.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-18 flex-col items-center justify-center gap-1 text-xs ${active ? "text-quiet" : "text-muted"}`}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
