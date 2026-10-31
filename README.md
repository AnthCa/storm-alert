# Miranubes (formerly Storm Alert O'Higgins)

Severe-storm early warning for the O'Higgins region of Chile, built on free
GOES-19 satellite data. Central Chile has no weather radar, and on
26 October 2026 a tornado hit Requínoa without any warning. This project shows
that the satellite signal was there about **50 minutes before**.

**App:** https://miranubes.vercel.app
(replay of the tornado: https://miranubes.vercel.app/?demo=requinoa)

| Part | What it is |
|---|---|
| [`research/requinoa-2026`](research/requinoa-2026) | Python study of the tornado: a GFS model experiment (negative), a GOES-19 cloud-top and lightning experiment (positive) and an October validation. It also holds the real-time pipeline, which runs every 10 minutes on GitHub Actions and publishes `status.json`. |
| [`app`](app) | Next.js PWA in Spanish: live map, "your location", alert detail and how it works. Deployed on Vercel. |

```
Supabase pg_cron, every 10 min ──► workflow_dispatch
GOES-19 (NOAA, AWS) ──► GitHub Actions ──► status.json (GitHub Pages) ──► app (Vercel)
                        Python: cloud tops + lightning jumps
```

It detects severe storms, not tornadoes specifically, and it does not replace
official alerts from SENAPRED or the Dirección Meteorológica de Chile.
