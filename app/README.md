# Storm Alert O'Higgins: app

Mobile-first PWA (Next.js 16, Tailwind 4, MapLibre) that shows severe storms in
O'Higgins, Chile, in near real time. The UI is in Spanish.

It reads `status.json`, which the Python pipeline in
[`research/requinoa-2026`](../research/requinoa-2026) publishes to GitHub Pages
every 10 minutes from GOES-19 cloud tops and lightning. The app has no backend
of its own yet.

| Screen | Route |
|---|---|
| Live map, regional status and "your location" | `/` |
| Alert detail: lightning and cloud-top history, what to do | `/alerta` |
| Notification preferences (push delivery is not built yet) | `/avisos` |
| How it works, with the Requínoa tornado case | `/como-funciona` |

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
