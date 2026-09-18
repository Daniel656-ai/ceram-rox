/**
 * Ableitung des Modulschlüssels aus der bestehenden Routing-Struktur.
 *
 * Es wird bewusst KEINE zweite, manuell gepflegte Modulliste geführt:
 * der Modulschlüssel entsteht rein aus dem vorhandenen Pfad, indem
 * variable Segmente (IDs) entfernt werden.
 */

const ID_LIKE =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i;

/** Maximale Tiefe: Hauptbereich + eine Unterebene (z. B. admin/benutzer). */
const MAX_SEGMENTS = 2;

export function moduleFromPath(pathname: string): string {
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .filter((s) => !ID_LIKE.test(s));

  if (segments.length === 0) return "dashboard";
  return segments.slice(0, MAX_SEGMENTS).join("/");
}

/** Laufzeitvariante: Desktop (Tauri) oder Web. */
export function runtimeVariant(): "web" | "desktop" {
  if (typeof window === "undefined") return "web";
  const w = window as unknown as Record<string, unknown>;
  return "__TAURI__" in w || "__TAURI_INTERNALS__" in w ? "desktop" : "web";
}
