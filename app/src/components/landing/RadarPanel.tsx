// The landing's instrument: the 26 October storm at 17:10 drawn as an infrared heat map
// under a radar sweep, with distance rings around a home. Decorative; its meaning is
// given in text by the aria-label and by the page around it.

const BLIPS = [
  [56, 58, 0.2], [60, 62, 1.1], [52, 64, 2.3], [63, 57, 3.0], [58, 70, 3.8],
  [49, 60, 4.6], [66, 66, 5.2], [61, 52, 1.7], [54, 55, 2.9], [67, 61, 4.1],
] as const;

const CONTOURS = [
  "M-5 20 C 20 14, 35 26, 55 18 S 90 8, 105 16",
  "M-5 34 C 18 28, 40 40, 60 30 S 92 24, 105 30",
  "M-5 50 C 22 44, 38 58, 62 46 S 90 40, 105 46",
  "M-5 66 C 20 60, 42 72, 64 62 S 92 58, 105 62",
  "M-5 82 C 24 76, 44 88, 66 78 S 94 74, 105 78",
];

const mono = "font-mono text-[10px] sm:text-[11px]";

export function RadarPanel() {
  return (
    <div
      role="img"
      aria-label="Instrumento: la tormenta del 26 de octubre a las 17:10, con nube a −47 grados y 99 rayos en 5 minutos, a menos de 25 kilómetros de una casa"
      className="relative aspect-square w-full max-w-[560px] overflow-hidden rounded-[28px] border border-[#1c2733] bg-[#0d1219] shadow-[0_50px_100px_-40px_rgb(0_0_0/0.9)]"
    >
      <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 size-full">
        {CONTOURS.map((d) => (
          <path key={d} d={d} fill="none" stroke="#18222d" strokeWidth="0.4" />
        ))}
        <path d="M74 0 C 70 20, 82 40, 76 60 S 84 90, 80 100" fill="none" stroke="#202c39" strokeWidth="0.6" />
        <path d="M46 0 L 45 30 L 41 52 L 35 74 L 29 100" fill="none" stroke="#2a3542" strokeWidth="0.5" />
      </svg>
      <div
        aria-hidden="true"
        className="mn-pulse absolute top-[42%] left-[34%] h-[44%] w-[52%] bg-[radial-gradient(closest-side,rgb(214_222_231/0.28),transparent)]"
      />
      <div
        aria-hidden="true"
        className="mn-pulse absolute top-[52%] left-[44%] h-[26%] w-[30%] rounded-full bg-[radial-gradient(closest-side,rgb(210_70_210/0.95),rgb(150_20_70/0.85)_28%,rgb(205_40_32/0.75)_50%,rgb(244_105_80/0.55)_70%,transparent)] blur-[2px]"
      />
      {["92%", "60%", "26%"].map((size, i) => (
        <div
          key={size}
          aria-hidden="true"
          className={`absolute top-1/2 left-1/2 -translate-1/2 rounded-full border ${i === 0 ? "border-dashed border-[#8be9f5]/25" : "border-[#8be9f5]/20"}`}
          style={{ width: size, height: size }}
        />
      ))}
      <div
        aria-hidden="true"
        className="mn-sweep absolute inset-[4%] rounded-full bg-[conic-gradient(from_0deg,rgb(56_214_232/0.32),rgb(56_214_232/0.06)_40deg,transparent_70deg)]"
      />
      {BLIPS.map(([x, y, delay]) => (
        <span
          key={`${x}-${y}`}
          aria-hidden="true"
          className="mn-blip absolute size-1.5 rounded-full bg-[#fff6c2] shadow-[0_0_12px_4px_rgb(255_225_77/0.6)]"
          style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s` }}
        />
      ))}
      <div aria-hidden="true" className="absolute top-1/2 left-1/2 -translate-1/2">
        <span className="mn-ring absolute -top-4 -left-4 size-8 rounded-full border-2 border-[#38d6e8]" />
        <span className="block size-3.5 rounded-full border-[3px] border-white bg-accent" />
      </div>
      <span className="absolute top-[calc(50%+14px)] left-1/2 -translate-x-1/2 text-xs font-semibold text-white [text-shadow:0_0_4px_#0b0e13]">
        Tu casa
      </span>
      <span aria-hidden="true" className="absolute top-[33%] left-[31%] size-2.5 rounded-full border-[2.5px] border-quiet" />
      <span className="absolute top-[36%] left-[23%] text-xs text-[#cfe6ff] [text-shadow:0_0_4px_#0b0e13]">Colegio</span>
      <span className={`${mono} absolute top-[4.5%] left-1/2 -translate-x-1/2 text-[#6f8fa0]`}>50 km</span>
      <span className={`${mono} absolute top-[20.5%] left-1/2 -translate-x-1/2 text-[#6f8fa0]`}>25 km</span>
      <div className={`${mono} absolute top-3.5 left-4 flex flex-col gap-0.5 text-[#8be9f5]`}>
        <span>GOES-19 · 10,3 µm</span>
        <span className="text-[#6f8fa0]">26·10·2026 17:10</span>
      </div>
      <div className={`${mono} absolute top-3.5 right-4 flex flex-col items-end gap-0.5`}>
        <span className="text-convective">TOPE −47 °C</span>
        <span className="text-bolt">99 RAYOS / 5 MIN</span>
      </div>
      <div className={`${mono} absolute right-4 bottom-3.5 left-4 flex items-center gap-2.5 text-muted`}>
        <span>−38°</span>
        <span
          aria-hidden="true"
          className="h-1.5 grow rounded-full bg-[linear-gradient(to_right,#f5aa3c,#f46950,#cd2820,#961446,#d246d2)]"
        />
        <span>−62°</span>
        <span aria-hidden="true" className="size-1.5 rounded-full bg-[#fff6c2] shadow-[0_0_6px_2px_rgb(255_225_77/0.6)]" />
        <span>RAYO</span>
      </div>
      <div
        aria-hidden="true"
        className="mn-scan absolute inset-0 bg-[linear-gradient(to_bottom,transparent_80%,rgb(56_214_232/0.1)_99%,transparent)]"
      />
    </div>
  );
}
