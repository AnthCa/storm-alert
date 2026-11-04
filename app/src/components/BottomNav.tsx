"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellIcon, InfoIcon, MapIcon, ShieldIcon } from "./Icons";
import { LogoMark, Wordmark } from "./Logo";

const ITEMS = [
  { href: "/", label: "Mapa", Icon: MapIcon },
  { href: "/oficiales", label: "Oficiales", Icon: ShieldIcon },
  { href: "/notificaciones", label: "Notificaciones", Icon: BellIcon },
  { href: "/como-funciona", label: "Info", Icon: InfoIcon },
] as const;

/** Bottom tabs on phones; on wide screens, a top bar with the name and the same links. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] lg:top-0 lg:bottom-auto lg:flex lg:h-16 lg:items-center lg:gap-1 lg:border-t-0 lg:border-b lg:px-6 lg:pb-0"
      aria-label="Principal"
    >
      <Link href="/" className="mr-auto hidden items-center gap-2 lg:flex" aria-label="Miranubes, ir al mapa">
        <LogoMark size={20} compact />
        <Wordmark className="text-[20px]" />
        <span className="rounded-md border border-line px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-soft">
          EXPERIMENTAL
        </span>
      </Link>
      {ITEMS.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-18 flex-col items-center justify-center gap-1 text-xs lg:h-10 lg:flex-row lg:gap-2 lg:rounded-lg lg:px-3 lg:text-sm ${active ? "text-quiet lg:bg-surface lg:text-fg" : "text-muted lg:hover:text-fg"}`}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
