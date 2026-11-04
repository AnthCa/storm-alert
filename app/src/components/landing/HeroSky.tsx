// Decorative sky behind the landing's first screen: drifting clouds, a satellite scan
// sweeping down and lightning flashing now and then. Pure CSS, hidden from screen readers.

const FLASHES = [
  [12, 22, 0.4], [18, 64, 2.1], [27, 38, 3.7], [34, 80, 1.2], [46, 15, 4.6], [52, 55, 0.9],
  [61, 30, 2.8], [68, 72, 5.3], [74, 48, 1.7], [83, 20, 3.2], [88, 66, 4.1], [93, 40, 0.2],
  [8, 84, 5.8], [40, 90, 2.5], [58, 8, 3.9], [79, 88, 1.1],
] as const;

const CLOUDS = [
  { left: "-8%", top: "8%", size: 520, tint: "214,222,231", alpha: 0.1, dur: 70, delay: 0 },
  { left: "45%", top: "-12%", size: 640, tint: "214,222,231", alpha: 0.08, dur: 90, delay: -30 },
  { left: "60%", top: "40%", size: 420, tint: "245,170,60", alpha: 0.12, dur: 60, delay: -10 },
  { left: "10%", top: "55%", size: 480, tint: "214,222,231", alpha: 0.07, dur: 80, delay: -50 },
];

export function HeroSky() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="sky-glow absolute inset-0" />
      {CLOUDS.map((c, i) => (
        <div
          key={i}
          className="sky-cloud absolute rounded-full"
          style={{
            left: c.left,
            top: c.top,
            width: c.size,
            height: c.size * 0.6,
            background: `radial-gradient(closest-side, rgba(${c.tint},${c.alpha}), rgba(${c.tint},0))`,
            animationDuration: `${c.dur}s`,
            animationDelay: `${c.delay}s`,
          }}
        />
      ))}
      {FLASHES.map(([x, y, delay], i) => (
        <span
          key={i}
          className="sky-flash absolute size-1.5 rounded-full bg-[#fff6c2]"
          style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s` }}
        />
      ))}
      <div className="sky-scan absolute inset-x-0 h-40" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-bg" />
    </div>
  );
}
