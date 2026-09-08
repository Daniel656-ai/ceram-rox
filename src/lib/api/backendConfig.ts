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

/** Loopback-, LAN- bzw. Docker-Adresse (z. B. lokales Supabase auf Port 54321)? */
function isLocalHost(host: string): boolean {
  return (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "[::1]" ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

/**
 * Eine gebaute Adresse ist nur brauchbar, wenn sie absolut ist UND nicht auf
 * einen Rechner im lokalen Netz zeigt, den die laufende Anwendung gar nicht
 * erreichen kann. Genau das war die Ursache des Desktop-Fehlers: im Build war
 * eine lokale Supabase-Instanz (…:54321) hinterlegt, auf der die Edge Function
 * nicht existiert. Läuft die Anwendung selbst auf demselben lokalen Host
 * (klassische lokale Entwicklung im Browser), bleibt die Adresse gültig.
 */
function usableUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  let host = "";
  try {
    host = new URL(value).hostname;
  } catch {
    return false;
  }
  if (!isLocalHost(host)) return true;
  const ownHost = typeof location !== "undefined" ? location.hostname : "";
  return !!ownHost && ownHost === host;
}

const envUrlUsable = usableUrl(rawUrl);

/** Basis-URL des Backends – immer absolut und immer erreichbar. */
export const BACKEND_URL = (envUrlUsable ? rawUrl : FALLBACK_URL).replace(/\/+$/, "");
/** Öffentlicher Publishable/Anon-Key – passend zur tatsächlich genutzten URL. */
export const BACKEND_ANON_KEY = envUrlUsable ? rawKey || FALLBACK_KEY : FALLBACK_KEY;
/** Basis-Adresse aller Edge Functions. */
export const FUNCTIONS_BASE_URL = `${BACKEND_URL}/functions/v1`;
/** Projekt-Referenz aus der Backend-URL (Diagnosezweck). */
export const BACKEND_PROJECT_REF = BACKEND_URL.replace(/^https?:\/\//, "").split(".")[0] ?? "";
/** true, wenn die Werte aus dem Build stammen (statt aus dem Fallback). */
export const BACKEND_FROM_ENV = envUrlUsable && !!rawKey;
/** true, wenn eine unbrauchbare lokale Build-Adresse ersetzt wurde. */
export const BACKEND_URL_OVERRIDDEN = !!rawUrl && !envUrlUsable;

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
