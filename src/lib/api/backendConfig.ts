/**
 * Zentrale Backend-Konfiguration (URL, Publishable Key, Projekt-Referenz).
 *
 * Web-App und Desktop-Version (Tauri) müssen zwingend dasselbe Backend und
 * dieselben Edge Functions verwenden. Im Web liefert Vite die Werte über
 * `import.meta.env`. Bei einem Desktop-Build ohne gesetzte Build-Variablen
 * wären sie leer – dann greifen die hier hinterlegten, öffentlichen Werte
 * desselben Projekts, damit niemals eine relative (und damit im Desktop
 * nicht auflösbare) Adresse entsteht.
 *
 * URL und Publishable Key sind öffentlich; der Schutz erfolgt über RLS.
 */

const FALLBACK_URL = "https://vrzqlfovvdxofxqyslev.supabase.co";
const FALLBACK_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyenFsZm92dmR4b2Z4cXlzbGV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MzI3MzAsImV4cCI6MjA4NjIwODczMH0.9YI0DV52bobu62tba7tVj9Zd2IT3O5RLfjW99VahEu8";

function envValue(key: string): string {
  const raw = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[key];
  return typeof raw === "string" ? raw.trim() : "";
}

const rawUrl = envValue("VITE_SUPABASE_URL");
const rawKey = envValue("VITE_SUPABASE_PUBLISHABLE_KEY");

/** Basis-URL des Backends – immer absolut. */
export const BACKEND_URL = (/^https?:\/\//i.test(rawUrl) ? rawUrl : FALLBACK_URL).replace(/\/+$/, "");
/** Öffentlicher Publishable/Anon-Key. */
export const BACKEND_ANON_KEY = rawKey || FALLBACK_KEY;
/** Basis-Adresse aller Edge Functions. */
export const FUNCTIONS_BASE_URL = `${BACKEND_URL}/functions/v1`;
/** Projekt-Referenz aus der Backend-URL (Diagnosezweck). */
export const BACKEND_PROJECT_REF = BACKEND_URL.replace(/^https?:\/\//, "").split(".")[0] ?? "";
/** true, wenn die Werte aus dem Build stammen (statt aus dem Fallback). */
export const BACKEND_FROM_ENV = /^https?:\/\//i.test(rawUrl) && !!rawKey;

/** Laufzeitumgebung – hilft, Web und Desktop in Protokollen zu unterscheiden. */
export function runtimeKind(): "desktop" | "web" {
  const w = globalThis as unknown as Record<string, unknown>;
  const isTauri =
    "__TAURI_INTERNALS__" in w ||
    "__TAURI__" in w ||
    (typeof location !== "undefined" && /tauri\.localhost|^tauri:/.test(location.origin));
  return isTauri ? "desktop" : "web";
}

/** Kompakte Konfigurationsübersicht für Fehlermeldungen und Protokolle. */
export function backendDiagnostics() {
  return {
    laufzeit: runtimeKind(),
    herkunft: location?.origin ?? "unbekannt",
    backendUrl: BACKEND_URL,
    projektRef: BACKEND_PROJECT_REF,
    functionsBasis: FUNCTIONS_BASE_URL,
    konfigAusBuild: BACKEND_FROM_ENV,
    keyLaenge: BACKEND_ANON_KEY.length,
  };
}
