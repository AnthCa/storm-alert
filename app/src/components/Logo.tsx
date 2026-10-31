import { useId } from "react";

/**
 * The Miranubes mark: a storm cloud with its cold core, and the viewer as a dot with
 * distance rings, as on the map. `compact` drops the outer ring for small sizes.
 */
export function LogoMark({ size = 28, compact = false }: { size?: number; compact?: boolean }) {
  const core = useId();
  return (
    <svg width={size * 1.5} height={size} viewBox="0 0 120 80" aria-hidden="true">
      <defs>
        <radialGradient id={core} gradientUnits="userSpaceOnUse" cx="56" cy="40" r="38">
          <stop offset="0" stopColor="#C2261B" />
          <stop offset="0.45" stopColor="#F0644F" />
          <stop offset="1" stopColor="#F2A53A" />
        </radialGradient>
      </defs>
      <g fill={`url(#${core})`}>
        <circle cx="40" cy="46" r="17" />
        <circle cx="61" cy="35" r="22" />
        <circle cx="83" cy="47" r="14" />
        <rect x="24" y="46" width="72" height="17" rx="8.5" />
      </g>
      {!compact && <circle cx="99" cy="64" r="16" fill="none" stroke="#38D6E8" strokeWidth="2.4" opacity="0.45" />}
      <circle cx="99" cy="64" r="10" fill="none" stroke="#38D6E8" strokeWidth="3" opacity="0.8" />
      <circle cx="99" cy="64" r="5" fill="#38D6E8" />
    </svg>
  );
}

/** "mira" + "nubes" in the signal colour, as in the brand lockup. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-brand font-bold tracking-tight ${className}`}>
      mira<span className="text-signal">nubes</span>
    </span>
  );
}
