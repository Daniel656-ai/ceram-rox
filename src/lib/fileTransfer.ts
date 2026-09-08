/**
 * Dateiübergabe VOR dem bestehenden Import.
 *
 * Zweck: aus Drag & Drop bzw. Zwischenablage ein echtes `File`-Objekt gewinnen,
 * das anschließend unverändert an den bestehenden Importablauf übergeben wird.
 * Es findet hier bewusst keinerlei Import-, Parser- oder Backendlogik statt.
 */

export const NO_FILE_MESSAGE =
  "Es konnte keine Datei erkannt werden. Bitte speichern Sie den Anhang zuerst oder fügen Sie ihn mit Strg+V ein.";

function collect(dt: DataTransfer | null | undefined): File[] {
  if (!dt) return [];
  const out: File[] = [];

  // 1) Normaler Weg (Explorer, Datei-Auswahl, die meisten Browser)
  if (dt.files && dt.files.length) out.push(...Array.from(dt.files));

  // 2) Fallback über items (z. B. Zwischenablage, manche Mail-Clients)
  if (!out.length && dt.items && dt.items.length) {
    for (const item of Array.from(dt.items)) {
      if (item.kind !== "file") continue;
      const f = item.getAsFile();
      if (f) out.push(f);
    }
  }

  // Leere Platzhalter (virtuelle Verweise ohne Inhalt) verwerfen
  return out.filter((f) => f && (f.size > 0 || !!f.type));
}

/** Dateien aus einem Drop-Ereignis. Leeres Array = kein verwertbarer Dateiinhalt. */
export function filesFromDrop(e: { dataTransfer?: DataTransfer | null }): File[] {
  return collect(e.dataTransfer);
}

/** Dateien aus einem Paste-Ereignis (Strg+V). Leeres Array = kein verwertbarer Dateiinhalt. */
export function filesFromClipboard(e: {
  clipboardData?: DataTransfer | null;
}): File[] {
  return collect(e.clipboardData);
}
