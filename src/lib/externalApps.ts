/**
 * Externe Fach-Apps auf dem Ceram-ROX-Server (Extruder-App, Staucher-App).
 * Die Buttons sind nur ein bequemer Einstieg: Die Apps prüfen Anmeldung und
 * Rechte selbst. Rein lesend – es wird nichts geschrieben oder migriert.
 */

export interface ExternalAppConfig {
  /** Exakter Leistungsname (measurement_services.service_name), der den Button aktiviert. */
  serviceName: string;
  /** Beschriftung des Buttons. */
  label: string;
  /** Startseite der App ohne Chargenbezug. */
  startUrl: string;
  /** Link mit Versuchsnummer (Charge). */
  chargeUrl: (nr: string) => string;
}

export const EXTERNAL_APPS: readonly ExternalAppConfig[] = [
  {
    serviceName: "Extrusion",
    label: "In Extruder-App öffnen",
    startUrl: "http://172.30.100.162:8080/",
    chargeUrl: (nr: string) => `http://172.30.100.162:8080/charge-oeffnen?nr=${encodeURIComponent(nr)}`,
  },
  {
    serviceName: "Staucher",
    label: "In Staucher-App öffnen",
    startUrl: "http://172.30.100.162:8081/",
    chargeUrl: (nr: string) => `http://172.30.100.162:8081/?charge=${encodeURIComponent(nr)}`,
  },
];

/** Liefert die konfigurierte App zu einem Leistungsnamen, sonst null. */
export function externalAppForService(serviceName: string | null | undefined): ExternalAppConfig | null {
  if (!serviceName) return null;
  const name = serviceName.trim();
  return EXTERNAL_APPS.find((a) => a.serviceName === name) ?? null;
}

/**
 * Baut den Ziel-Link: mit Versuchsnummer der Charge-Link, sonst die Startseite.
 * Die Nummer wird URL-kodiert; leere/fehlende Nummern erzeugen keinen Charge-Link.
 */
export function externalAppUrl(app: ExternalAppConfig, versuchsnummer: string | null | undefined): string {
  const nr = typeof versuchsnummer === "string" ? versuchsnummer.trim() : "";
  return nr ? app.chargeUrl(nr) : app.startUrl;
}

/**
 * Sichtbarkeit: Master sieht den Button immer, sonst nur wer laut
 * Kompetenzmatrix (mdl_service_permissions) für diese Leistung qualifiziert ist –
 * dieselbe Qualifikation wie bei „Meine Aufgaben" und claim_measurement.
 */
export function canOpenExternalApp(
  role: string | null | undefined,
  qualifiedServiceIds: ReadonlySet<string> | readonly string[] | null | undefined,
  serviceId: string | null | undefined,
): boolean {
  if (role === "master") return true;
  if (!serviceId || !qualifiedServiceIds) return false;
  return Array.from(qualifiedServiceIds).includes(serviceId);
}

/** Erkennung der Tauri-Desktop-Laufzeit (WebView). */
function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Öffnet die externe App im Standardbrowser. In der Tauri-Desktop-App über
 * @tauri-apps/plugin-opener (window.open ist in der WebView unzuverlässig),
 * im Web-Build ersatzweise über window.open mit noopener.
 */
export async function openExternalAppUrl(url: string): Promise<void> {
  if (isTauriRuntime()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener");
}
