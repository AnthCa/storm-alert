"""Web Push pilot: notify invited testers about storms near their place.

Runs after each realtime cycle (see .github/workflows/storm-map.yml) when the
repository variable PUSH_ENABLED is "true". Reads the status.json just written,
the active subscriptions from Supabase (infra/supabase/push_pilot.sql) and sends
at most one notification per tester per run, by priority:

1. severe:    the alert area turned severe (once per episode), for testers whose
              radius reaches the alert circle.
2. lightning: a flash within LIGHTNING_KM in the last 10 minutes (every 30 min at most).
3. storm:     cold tops within the tester's radius (every 60 min at most).

Everything is an experimental observation, never an official warning, and the
messages say so. Nothing is sent when the data is stale or unavailable.
"""

import json
import math
import os
import sys
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from requinoa_2026.grid import distance_km
from requinoa_2026.realtime import OUT_DIR

LIGHTNING_KM = 15
LIGHTNING_RECENT_MIN = 10
# A few cold pixels, not one: single pixels flicker in and out at the -38 C threshold.
STORM_MIN_PIXELS = 3
COOLDOWN = {"severe": None, "lightning": timedelta(minutes=30), "storm": timedelta(minutes=60)}
STALE_AFTER = timedelta(minutes=25)
APP_URL = "https://miranubes.vercel.app/"
CHILE = ZoneInfo("America/Santiago")
DIRECTIONS = ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"]


@dataclass
class Notification:
    kind: str
    title: str
    body: str


def direction(lat1: float, lon1: float, lat2: float, lon2: float) -> str:
    """Compass direction, in Spanish, from point 1 towards point 2."""
    p1, p2, dl = math.radians(lat1), math.radians(lat2), math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    bearing = (math.degrees(math.atan2(y, x)) + 360) % 360
    return DIRECTIONS[round(bearing / 45) % 8]


def _nearest(lat: float, lon: float, points: list) -> tuple[float, list] | None:
    if not points:
        return None
    best = min(points, key=lambda p: float(distance_km(lat, lon, p[0], p[1])))
    return float(distance_km(lat, lon, best[0], best[1])), best


def _due(last: dict, kind: str, now: datetime) -> bool:
    sent = last.get(kind)
    if sent is None:
        return True
    return now - datetime.fromisoformat(sent) >= COOLDOWN[kind]


def choose(sub: dict, status: dict, now: datetime) -> Notification | None:
    """The one notification this tester should get now, if any."""
    data_until = datetime.fromisoformat(status["data_until_utc"])
    if status["health"]["state"] == "unavailable" or now - data_until > STALE_AFTER:
        return None
    lat, lon, radius = float(sub["lat"]), float(sub["lon"]), sub["radius_km"]
    last = sub.get("last_notified") or {}
    note = "Observación experimental, no es un aviso oficial."

    center_lat, center_lon = status["center"]
    reaches_alert_area = float(distance_km(lat, lon, center_lat, center_lon)) <= status["radius_km"] + radius
    episode = status.get("episode_start_utc")
    if status["level"] == "severe" and reaches_alert_area and episode and last.get("severe_episode") != episode:
        return Notification(
            "severe",
            "Actividad convectiva intensa",
            f"Se observa una tormenta que se intensifica cerca de Requínoa. Revisa los avisos oficiales. {note}",
        )

    recent = [f for f in status.get("flash_cells_30min", []) if f[2] <= LIGHTNING_RECENT_MIN]
    flash = _nearest(lat, lon, recent)
    if flash and flash[0] <= LIGHTNING_KM and _due(last, "lightning", now):
        km, (f_lat, f_lon, age) = flash
        at = (data_until - timedelta(minutes=age)).astimezone(CHILE).strftime("%H:%M")
        return Notification(
            "lightning",
            f"Rayo a {round(km)} km al {direction(lat, lon, f_lat, f_lon)}",
            f"Cayó a las {at}. Busca refugio bajo techo y espera 30 minutos sin rayos. {note}",
        )

    cold = status.get("cold_pixels", [])
    within = [p for p in cold if float(distance_km(lat, lon, p[0], p[1])) <= radius]
    if len(within) >= STORM_MIN_PIXELS and _due(last, "storm", now):
        km, (s_lat, s_lon, _) = _nearest(lat, lon, within)
        coldest = min(p[2] for p in within)
        return Notification(
            "storm",
            f"Nubes de tormenta a {round(km)} km al {direction(lat, lon, s_lat, s_lon)}",
            f"Dentro de tus {radius} km, con topes de hasta {round(coldest)} °C. {note}",
        )
    return None


def mark(last: dict, notification: Notification, status: dict, now: datetime) -> dict:
    updated = {**last, notification.kind: now.isoformat()}
    if notification.kind == "severe":
        updated["severe_episode"] = status.get("episode_start_utc")
    return updated


def _rpc(name: str, payload: dict):
    url = f"{os.environ['SUPABASE_URL'].rstrip('/')}/rest/v1/rpc/{name}"
    key = os.environ["SUPABASE_ANON_KEY"]
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        body = response.read()
    return json.loads(body) if body else None


def main() -> None:
    from py_vapid import Vapid
    from pywebpush import WebPushException, webpush

    if os.environ.get("PUSH_ENABLED") != "true":
        print("push: disabled (PUSH_ENABLED is not true)")
        return
    token = os.environ["PUSH_SENDER_TOKEN"]
    vapid = Vapid.from_raw(os.environ["VAPID_PRIVATE_KEY"].strip().encode())
    status = json.loads((OUT_DIR / "status.json").read_text())
    now = datetime.now(timezone.utc)

    subs = _rpc("sender_list", {"token": token}) or []
    sent = 0
    for sub in subs:
        notification = choose(sub, status, now)
        if notification is None:
            continue
        payload = {"title": notification.title, "body": notification.body, "tag": notification.kind, "url": APP_URL}
        try:
            webpush(
                subscription_info={"endpoint": sub["endpoint"], "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}},
                data=json.dumps(payload, ensure_ascii=False),
                vapid_private_key=vapid,
                vapid_claims={"sub": APP_URL.rstrip("/")},
                ttl=900,
                headers={"Urgency": "high"},
            )
        except WebPushException as error:
            code = error.response.status_code if error.response is not None else None
            if code in (404, 410):
                _rpc("sender_deactivate", {"token": token, "sub_id": sub["id"]})
            print(f"push: subscription {sub['id']} failed ({code})", file=sys.stderr)
            continue
        _rpc("sender_mark", {"token": token, "sub_id": sub["id"], "notified": mark(sub.get("last_notified") or {}, notification, status, now)})
        sent += 1
    print(f"push: {sent} sent to {len(subs)} subscriptions")


if __name__ == "__main__":
    main()
