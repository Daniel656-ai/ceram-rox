import { useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export function UpdateChecker() {
  useEffect(() => {
    async function checkForUpdate() {
      try {
        const update = await check();
        if (update) {
          const confirmed = window.confirm(
            `Version ${update.version} ist verfügbar. Jetzt aktualisieren?`
          );
          if (confirmed) {
            await update.downloadAndInstall();
            await relaunch();
          }
        }
      } catch (e) {
        console.error("Update-Check fehlgeschlagen:", e);
      }
    }
    checkForUpdate();
  }, []);

  return null;
}