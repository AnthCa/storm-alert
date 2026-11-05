// The landing's instrument: the real 26 October storm, drawn from the replay's satellite
// data at build time. Cloud-top pixels become a blurred infrared field and each detected
// flash a dot, over the real towns and the alert area around Requínoa. The static drawing
// is server-rendered; RadarHome adds the house a visitor places and the app's answer there.

import demo from "../../../public/demo/requinoa-2026-10-26.json";
import { cloudColor } from "@/lib/cloud-image";
import { TOWNS } from "@/lib/geo";
import { normalizeStatus, type Status } from "@/lib/status";
import { RadarHome, type PanelPlace } from "./RadarHome";
import { HALF_KM, panelPercent, project, verdictAt } from "./radar-geo";

const status = normalizeStatus(demo as unknown as Status);

/** Ground footprint of one satellite pixel, as the app draws it. */
const PIXEL_KM = 3;
const PIXEL_R = (PIXEL_KM / HALF_KM) * 50 * 0.75;
/** Flashes that blink; the rest stay as still dots so few elements animate. */
const BLINKING = 36;

const inside = ([x, y]: [number, number], margin = 0) =>
  x >= -margin && x <= 100 + margin && y >= -margin && y <= 100 + margin;

// Warm first, so the coldest core is painted on top.
const CLOUD = status.cold_pixels
  .map(([lat, lon, t]) => ({ at: project(lat, lon), t }))
  .filter(({ at }) => inside(at, 4))
  .sort((a, b) => b.t - a.t)
  .map(({ at, t }) => {
    const [r, g, b] = cloudColor(t);
    return { at, fill: `rgb(${r} ${g} ${b})` };
  });

const FLASHES = status.recent_flashes.map(([lat, lon]) => project(lat, lon)).filter((at) => inside(at));
const EVERY = Math.ceil(FLASHES.length / BLINKING);
const STILL = FLASHES.filter((_, i) => i % EVERY !== 0);
const BLINK = FLASHES.filter((_, i) => i % EVERY === 0).map((at, i) => ({ at, delay: ((i * 0.83) % 6).toFixed(2) }));

const LABELLED = ["Rancagua", "Requínoa", "Rengo", "Doñihue", "Coltauco", "San Vicente", "Graneros"];
const TOWN_PLACES: PanelPlace[] = TOWNS.filter(([name]) => LABELLED.includes(name)).map(([name, lat, lon]) => ({
  name,
  lat,
  lon,
}));
const LABELS = TOWN_PLACES.map(({ name, lat, lon }) => ({ name, at: project(lat, lon) }));
/** Towns offered as buttons: one inside the storm, one at its edge, two clear of it. */
const PICKS = ["Rancagua", "Requínoa", "Rengo", "San Vicente"].map((name) => TOWN_PLACES.find((p) => p.name === name)!);
const START = PICKS[0];

const TIME = new Intl.DateTimeFormat("es-CL", {
  timeZone: "America/Santiago",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})
  .format(new Date(status.latest_scan_utc))
  .replace(/[-/]/g, "·")
  .replace(",", "");
const COLDEST = `−${Math.abs(Math.round(status.coldest_top_c ?? 0))}`;
const FLASHES_5 = status.flashes_per_5min.at(-1)?.count ?? 0;
const ALERT_RING = panelPercent(status.radius_km);

const mono = "font-mono text-[10px] sm:text-[11px]";

export function RadarPanel() {
  return (
    <RadarHome
      places={PICKS}
      start={START}
      initial={verdictAt(status, START.lat, START.lon)}
      legend={
        <div className={`${mono} flex items-center gap-2.5 text-muted`}>
          <span>−38°</span>
          <span
            aria-hidden="true"
            className="h-1.5 grow rounded-full bg-[linear-gradient(to_right,#f5aa3c,#f46950,#cd2820,#961446,#d246d2)]"
          />
          <span>−62°</span>
          <span aria-hidden="true" className="size-1.5 rounded-full bg-[#fff6c2] shadow-[0_0_6px_2px_rgb(255_225_77/0.6)]" />
          <span>RAYO</span>
        </div>
      }
    >
      <div
        role="img"
        aria-label={`Datos reales del satélite: la tormenta del 26 de octubre sobre Requínoa, con la cima de la nube a ${COLDEST} grados y ${FLASHES_5} rayos en 5 minutos`}
        className="absolute inset-0"
      >
        <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 size-full">
          <defs>
            <filter id="mn-ir" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="1.3" />
            </filter>
          </defs>
          <g filter="url(#mn-ir)" opacity="0.92">
            {CLOUD.map(({ at: [x, y], fill }, i) => (
              <circle key={i} cx={x} cy={y} r={PIXEL_R} fill={fill} />
            ))}
          </g>
          <circle
            cx="50"
            cy="50"
            r={ALERT_RING}
            fill="none"
            stroke="#8be9f5"
            strokeOpacity="0.28"
            strokeWidth="0.25"
            strokeDasharray="1 1"
          />
          <g fill="#fff6c2">
            {STILL.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="0.32" opacity="0.75" />
            ))}
          </g>
          {LABELS.map(({ name, at: [x, y] }) => (
            <circle key={name} cx={x} cy={y} r="0.7" fill="#0d1219" stroke="#cfe6ff" strokeWidth="0.3" />
          ))}
        </svg>
        {BLINK.map(({ at: [x, y], delay }) => (
          <span
            key={`${x}-${y}`}
            aria-hidden="true"
            className="mn-blip absolute size-1.5 -translate-1/2 rounded-full bg-[#fff6c2] shadow-[0_0_10px_3px_rgb(255_225_77/0.55)]"
            style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s` }}
          />
        ))}
        {LABELS.map(({ name, at: [x, y] }) => (
          <span
            key={name}
            aria-hidden="true"
            className="absolute translate-x-[6px] -translate-y-1/2 text-[10px] text-[#cfe6ff] [text-shadow:0_0_3px_#0b0e13,0_0_3px_#0b0e13] sm:text-xs"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {name}
          </span>
        ))}
        <span aria-hidden="true" className={`${mono} absolute top-[7.5%] left-1/2 hidden -translate-x-1/2 text-[#6f8fa0] sm:block`}>
          Área de alerta · {status.radius_km} km
        </span>
        <div className={`${mono} absolute top-3.5 left-4 flex flex-col gap-0.5 text-[#8be9f5]`}>
          <span>GOES-19 · 10,3 µm</span>
          <span className="text-[#6f8fa0]">{TIME}</span>
        </div>
        <div className={`${mono} absolute top-3.5 right-4 flex flex-col items-end gap-0.5`}>
          <span className="text-convective">CIMA {COLDEST} °C</span>
          <span className="text-bolt">{FLASHES_5} RAYOS / 5 MIN</span>
        </div>
        <div
          aria-hidden="true"
          className="mn-scan absolute inset-0 bg-[linear-gradient(to_bottom,transparent_80%,rgb(56_214_232/0.1)_99%,transparent)]"
        />
      </div>
    </RadarHome>
  );
}
