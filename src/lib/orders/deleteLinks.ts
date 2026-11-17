/** Labels and ordering for server-counted order delete links; only non-zero entries are shown. */
export const ORDER_LINK_LABELS: Record<string, string> = {
  samples: "Zugeordnete Proben (bleiben erhalten, werden entkoppelt)",
  services: "Dienstleistungspositionen (werden gelöscht)",
  assignments: "Messdienstleister-Zuordnungen (werden entfernt)",
  tasks: "Workflow-Aufgaben (werden gelöscht)",
  results_official: "Offizielle Ergebnisse (gelöscht, vollständig im Protokoll gesichert)",
  results_preliminary: "Vorläufige Ergebnisse (gelöscht, im Protokoll gesichert)",
  raw_datasets: "Rohdatensätze (gelöscht, Metadaten gesichert)",
  corrections: "Korrekturhistorie (bleibt erhalten)",
  imports: "Importvorgänge (werden gelöscht)",
  work_logs: "Arbeitsprotokolle (gelöscht, im Protokoll gesichert)",
  time_entries: "Projektzeiten (bleiben erhalten, werden entkoppelt)",
  materials: "Materialbuchungen (bleiben erhalten, werden entkoppelt)",
  documents: "Dokumente (Einträge gelöscht, Dateien bleiben im Speicher)",
  uploads: "Hochgeladene Dateien (Einträge gelöscht, Dateien bleiben im Speicher)",
  reports: "Berichte (werden gelöscht)",
  project: "Projektverknüpfung (Projekt bleibt erhalten)",
  production_releases: "Fertigungsfreigaben (bleiben erhalten, werden entkoppelt)",
  production_documents: "Fertigungsunterlagen/m³-Listen (bleiben erhalten, werden entkoppelt)",
  follow_up_measurements: "Folgemessungen anderer Aufträge (bleiben erhalten, Verweis entfernt)",
  produced_samples: "Pilot-Plant-Probenerzeugung (Einträge werden gelöscht)",
};

export function visibleOrderLinks(links: Record<string, number> | undefined | null): { key: string; label: string; count: number }[] {
  if (!links) return [];
  return Object.keys(ORDER_LINK_LABELS)
    .map((key) => ({ key, label: ORDER_LINK_LABELS[key], count: Number(links[key] ?? 0) }))
    .filter((e) => e.count > 0);
}
