# Miranubes: app

Mobile-first PWA (Next.js 16, Tailwind 4, MapLibre) that shows severe storms in
O'Higgins, Chile, in near real time. The UI is in Spanish.

Live: https://miranubes.vercel.app

It reads `status.json`, which the Python pipeline in
[`research/requinoa-2026`](../research/requinoa-2026) publishes to GitHub Pages
every 10 minutes from GOES-19 cloud tops and lightning. The app has no backend
of its own yet.

| Screen | Route |
|---|---|
| Live map, data state, monitored area and "your location" | `/` |
| Observation detail: lightning and cloud-top history | `/observacion` |
| Official sources (DMC, SENAPRED) and how they differ from observations | `/oficiales` |
| Notification preferences (push delivery is not built yet) | `/notificaciones` |
| How it works, with the Requínoa tornado case | `/como-funciona` |
| Privacy policy | `/privacidad` |

Miranubes shows **experimental observations**, never official alerts. Missing
or late data is shown as such (`degraded`, `stale`, `offline`), never as "no
storms", and nothing local is computed outside the monitored 50 km circle.

`/?demo=requinoa` replays 26 Oct 2026 at 17:30 local time, when the tornado
touched down (`public/demo/requinoa-2026-10-26.json`).

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # geo logic (vitest)
npm run lint
npm run build
```

`NEXT_PUBLIC_STATUS_URL` overrides the live data URL.
