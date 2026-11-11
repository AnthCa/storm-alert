import { localTime, type Status } from "./status";

export const APP_URL = "https://miranubes.vercel.app";

/** General status only: the viewer's location never goes into a shared message. */
export function shareMessage(status: Status): string {
  const at = localTime(status.data_until_utc);
  const area = `${status.radius_km} km alrededor de ${status.zone_name}`;
  const body =
    status.level === "severe"
      ? `tormenta eléctrica intensificándose cerca de ${status.zone_name} (${at}). Revisa los avisos oficiales.`
      : status.level === "deep_convection"
        ? `nubes de tormenta en el área monitoreada, ${area} (${at}).`
        : status.level === "quiet"
          ? `sin tormentas en el área monitoreada, ${area} (${at}).`
          : "observación satelital de tormentas en O'Higgins.";
  return `Miranubes (experimental, no oficial): ${body}`;
}
