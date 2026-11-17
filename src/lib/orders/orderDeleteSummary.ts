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
