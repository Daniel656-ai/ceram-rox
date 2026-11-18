/** Antwort der Datenbankfunktion `order_delete_summary`: Was hängt am Auftrag? */
export interface OrderDeleteSummary {
  documents: string[];
  upload_files: string[];
  reports: number;
  production_releases: (string | null)[];
  m3_requests: number;
  samples: number;
  measurements: number;
  has_results: boolean;
  /** Ab „Auftrag löschen erweitern“: */
  blockers?: string[];
  process_links?: number;
  prefilled_values?: number;
  audit_entries?: number;
  sample_plan?: Array<{ name: string | null; deletable: boolean; reason: string | null }>;
}

const MAX_NAMES = 5;

function names(list: (string | null)[]): string {
  const shown = list.slice(0, MAX_NAMES).map((n) => n || "ohne Namen");
  const rest = list.length - shown.length;
  return shown.join(", ") + (rest > 0 ? ` und ${rest} weitere` : "");
}

/** Hinweiszeilen für den Löschdialog; leer, wenn nichts angehängt ist. */
export function describeOrderAttachments(s: Partial<OrderDeleteSummary> | null | undefined): string[] {
  if (!s) return [];
  const lines: string[] = [];
  const files = [...(s.documents ?? []), ...(s.upload_files ?? [])];
  if (files.length) lines.push(`${files.length} Datei(en): ${names(files)}`);
  if (s.reports) lines.push(`${s.reports} Bericht(e)`);
  if (s.production_releases?.length) {
    lines.push(`Fertigungsfreigabe ${names(s.production_releases)} (bleibt bestehen, wird vom Auftrag gelöst)`);
  }
  if (s.m3_requests) lines.push(`${s.m3_requests} m³-Listen-Anfrage(n)`);
  if (s.samples) lines.push(`${s.samples} Probenzuordnung(en) (die Proben selbst bleiben bestehen)`);
  return lines;
}

/** Inhalt des Löschdialogs für einen ganzen Auftrag. */
export interface OrderDeletionDescription {
  /** Sperrgründe – ist die Liste nicht leer, ist das Löschen nicht möglich. */
  blockers: string[];
  /** Wird mitgelöscht. */
  removed: string[];
  /** Wird nur gelöst; das Gelöste bleibt bestehen. */
  released: string[];
  /** Bleibt bestehen (mit Grund). */
  kept: string[];
}

export function describeOrderDeletion(s: Partial<OrderDeleteSummary> | null | undefined): OrderDeletionDescription {
  const out: OrderDeletionDescription = { blockers: [...(s?.blockers ?? [])], removed: [], released: [], kept: [] };
  if (!s) return out;
  const files = [...(s.documents ?? []), ...(s.upload_files ?? [])];
  if (files.length) out.removed.push(`${files.length} Datei(en): ${names(files)}`);
  if (s.prefilled_values) out.removed.push(`${s.prefilled_values} vorläufige Formularwert(e) vom Anlegen`);
  if (s.reports) out.removed.push(`${s.reports} automatisch angelegte(r) Bericht(e) ohne Inhalt`);
  if (s.m3_requests) out.removed.push(`${s.m3_requests} m³-Listen-Anfrage(n)`);
  if (s.audit_entries) out.removed.push(`${s.audit_entries} Eintrag/Einträge im Änderungsprotokoll des Auftrags (bleiben im Löschprotokoll gesichert)`);
  const plan = s.sample_plan ?? [];
  const del = plan.filter((p) => p.deletable).map((p) => p.name);
  if (del.length) out.removed.push(`${del.length} Probe(n), die nur für diesen Auftrag angelegt wurden: ${names(del)}`);
  if (s.production_releases?.length) {
    out.released.push(`Fertigungsfreigabe ${names(s.production_releases)} (bleibt bestehen, wird vom Auftrag gelöst)`);
  }
  if (s.process_links) out.released.push(`${s.process_links} Prozess-Verknüpfung(en) (der Prozessauftrag bleibt bestehen)`);
  if (s.samples) out.released.push(`${s.samples} Probenzuordnung(en) werden gelöst`);
  for (const p of plan.filter((x) => !x.deletable)) {
    out.kept.push(`Probe ${p.name || "ohne Namen"} bleibt bestehen${p.reason ? ` (${p.reason})` : ""}`);
  }
  return out;
}
