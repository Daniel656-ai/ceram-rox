/**
 * Deutsche Bezeichnungen für Statuswerte in der Ergebnisdarstellung (Badges).
 * Bekannte englische Statuswerte werden übersetzt; unbekannte bleiben unverändert (nichts geht verloren).
 */
const STATUS_DE: Record<string, string> = {
  open: "offen",
  pending: "ausstehend",
  planned: "geplant",
  draft: "Entwurf",
  in_progress: "in Bearbeitung",
  inprogress: "in Bearbeitung",
  completed: "abgeschlossen",
  done: "abgeschlossen",
  closed: "abgeschlossen",
  cancelled: "abgebrochen",
  canceled: "abgebrochen",
  rejected: "abgelehnt",
  approved: "freigegeben",
  released: "freigegeben",
  failed: "fehlgeschlagen",
  on_hold: "angehalten",
};

export function measurementStatusLabel(status: string | null | undefined): string {
  const raw = (status ?? "").trim();
  if (!raw) return "";
  return STATUS_DE[raw.toLowerCase().replace(/[\s-]+/g, "_")] ?? raw;
}
