/** Anzeige-Regeln für das Löschen einzelner Dienstleistungen (Server entscheidet verbindlich). */

export const MIN_DELETE_REASON = 5;

export const BLOCKER_LABELS: Record<string, string> = {
  order_locked: "Der Auftrag ist gesperrt (abgeschlossen).",
  status_not_open: "Die Aufgabe ist nicht mehr im Anfangszustand „offen“ – bitte stornieren statt löschen.",
  results: "Es sind Ergebnisse vorhanden.",
  raw_data: "Es sind Rohdaten vorhanden.",
  corrections: "Es sind Ergebniskorrekturen vorhanden.",
  work_logs: "Es sind Arbeitszeitbuchungen vorhanden.",
  documents: "Es sind Dokumente vorhanden.",
  uploads: "Es sind hochgeladene Dateien verknüpft.",
};

export interface DeleteCounts {
  parameters?: number;
  prepared_samples?: number;
  replacement_measurements?: number;
  knetung_materials?: number;
  history_entries?: number;
}

/** Verständliche Liste der automatischen Folgen (werden vor Bestätigung gezeigt). */
export function describeSideEffects(c: DeleteCounts): string[] {
  const out: string[] = [];
  if (c.parameters) out.push(`${c.parameters} Auftraggeber-Vorgabe(n) werden mitgelöscht; ihre Werte werden im Protokoll gesichert.`);
  if (c.prepared_samples) out.push(`${c.prepared_samples} Probe(n)/Teilprobe(n) verlieren die Zuordnung „vorbereitet für“ diese Aufgabe; die Proben bleiben erhalten.`);
  if (c.replacement_measurements) out.push(`${c.replacement_measurements} Ersatzmessung(en) verlieren den Verweis auf diese Ursprungsaufgabe; sie bleiben erhalten.`);
  if (c.knetung_materials) out.push(`${c.knetung_materials} Knetungsmaterial-Eintrag/Einträge verlieren den Aufgabenbezug; sie bleiben erhalten.`);
  if (c.history_entries) out.push(`${c.history_entries} Historieneintrag/-einträge bleiben erhalten und bleiben dem Auftrag zugeordnet.`);
  return out;
}

export function canSubmitDelete(allowed: boolean, reason: string): boolean {
  return allowed && reason.trim().length >= MIN_DELETE_REASON;
}

export function deleteErrorText(msg: string): string {
  const m = (msg || "").toLowerCase();
  if (m.includes("not permitted")) return "Keine Berechtigung – nur Admin darf Dienstleistungen löschen.";
  if (m.includes("reason too short")) return `Begründung mit mindestens ${MIN_DELETE_REASON} Zeichen erforderlich.`;
  if (m.includes("schreibgeschützt") || m.includes("order_locked")) return "Der Auftrag ist gesperrt – Löschen nicht möglich.";
  if (m.includes("delete blocked")) {
    const keys = m.split("delete blocked:")[1]?.split(",").map((s) => s.trim()) ?? [];
    return "Löschen abgelehnt: " + keys.map((k) => BLOCKER_LABELS[k] ?? k).join(" ");
  }
  if (m.includes("not found")) return "Die Aufgabe existiert nicht mehr.";
  return "Die Dienstleistung wurde nicht gelöscht. Es wurde nichts verändert.";
}
