import Link from "next/link";
import { ChevronLeftIcon } from "./Icons";

/** Scrolling page with a back link to the map, leaving room for the bottom nav. */
export function PageShell({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-28">
      <Link href="/" className="flex min-h-11 items-center gap-1.5 self-start text-[15px] text-quiet">
        <ChevronLeftIcon size={20} /> Mapa
      </Link>
      <div className="flex flex-col gap-2.5">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">{title}</h1>
        {intro && <p className="text-[15px] leading-relaxed text-soft">{intro}</p>}
      </div>
      {children}
    </main>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 ${className}`}>{children}</div>;
}

export function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-quiet-line bg-quiet-bg p-4">
      <h2 className="text-[15px] font-semibold text-[#b8dcff]">{title}</h2>
      <p className="text-sm leading-relaxed text-[#d5dce4]">{children}</p>
    </div>
  );
}
