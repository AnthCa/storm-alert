/**
 * Official sources. Storm Alert does not copy their notices yet (no stable public API was
 * found; see the launch plan, phase 3), so it links to them instead.
 */
export const OFFICIAL_SOURCES = {
  dmc: {
    name: "Dirección Meteorológica de Chile",
    short: "DMC",
    role: "Emite los avisos, alertas y alarmas meteorológicas.",
    url: "https://www.meteochile.gob.cl/PortalDMC-web/index.xhtml",
  },
  senapred: {
    name: "Servicio Nacional de Prevención y Respuesta ante Desastres",
    short: "SENAPRED",
    role: "Declara las alertas de protección civil e indica qué hacer.",
    url: "https://senapred.cl/alertas/",
  },
} as const;
