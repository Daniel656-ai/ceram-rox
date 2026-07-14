import { useEffect } from "react";

/**
 * Prüft nur in der Tauri-Desktop-App auf Updates. Im Browser-Preview würde
 * `@tauri-apps/plugin-updater` beim Import/`check()` auf `window.__TAURI_INTERNALS__`
 * zugreifen und einen unbehandelten Fehler werfen ("Cannot read properties of
 * undefined (reading 'invoke')"), der die Konsole flutet und in seltenen Fällen
 * begleitend zu abgebrochenen Verbindungen ("Verbindung wurde zurückgesetzt")
 * auftrat. Der dynamische Import stellt sicher, dass die Tauri-Module im Web
 * gar nicht erst geladen werden.
 */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function UpdateChecker() {
  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ check }, { relaunch }] = await Promise.all([
          import("@tauri-apps/plugin-updater"),
          import("@tauri-apps/plugin-process"),
        ]);
        if (cancelled) return;
        const update = await check();
        if (!update || cancelled) return;
        const confirmed = window.confirm(
          `Version ${update.version} ist verfügbar. Jetzt aktualisieren?`
        );
        if (confirmed) {
          await update.downloadAndInstall();
          await relaunch();
        }
      } catch (e) {
        console.error("Update-Check fehlgeschlagen:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
