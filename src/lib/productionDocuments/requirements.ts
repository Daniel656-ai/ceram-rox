/**
 * Fertigungsunterlagen – Folgeprozesse (m³-Liste, Dokumentation).
 *
 * Die Voraussetzungen werden ausschließlich aus bereits vorhandenen
 * Auftragsdaten abgeleitet (Auftrag, aktuelle Fertigungsfreigabe-Revision,
 * Messungen/Geometrie, Ergebnisse). Es werden keine Daten doppelt erfasst.
 */

export type DocKind = "m3_list" | "documentation";

export type DocStatus =
  | "nicht_angefordert"
  | "angefordert"
  | "wartet_auf_daten"
  | "daten_vollstaendig"
  | "in_erstellung"
  | "erstellt";

export const DOC_KIND_LABEL: Record<DocKind, string> = {
  m3_list: "m³-Liste",
  documentation: "Dokumentation",
};

export const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  nicht_angefordert: "Nicht angefordert",
  angefordert: "Angefordert",
  wartet_auf_daten: "Wartet auf Daten",
  daten_vollstaendig: "Daten vollständig",
  in_erstellung: "In Erstellung",
  erstellt: "Erstellt",
};

export const DOC_STATUS_COLOR: Record<DocStatus, string> = {
  nicht_angefordert: "text-muted-foreground",
  angefordert: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  wartet_auf_daten: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  daten_vollstaendig: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  in_erstellung: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  erstellt: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ReleaseLike {
  id: string;
  release_number?: string | null;
  revision_number?: number | null;
  status?: string | null;
  is_current?: boolean | null;
}

export interface EvaluationInput {
  order: any;
  /** Aktuell gültige Revision der zugeordneten Fertigungsfreigabe. */
  currentRelease?: ReleaseLike | null;
  /** Status der m³-Liste (nur für die Dokumentation relevant). */
  m3Status?: DocStatus;
}

export interface Evaluation {
  missing: string[];
  basedOnReleaseId: string | null;
  /** Kurzbeschreibung der Grundlage (z. B. „Rev. 2 – aktuell“). */
  basis: string;
}

const isCompleted = (v: unknown) => String(v ?? "").toLowerCase() === "completed";

function measurements(order: any): any[] {
  return Array.isArray(order?.order_measurements) ? order.order_measurements : [];
}

function serviceName(m: any): string {
  return String(m?.measurement_services?.service_name ?? "");
}

function hasResults(m: any): boolean {
  const rows = Array.isArray(m?.measurement_results) ? m.measurement_results : [];
  return rows.some((r: any) => r?.value != null || (r?.text_value ?? "") !== "");
}

/** Geometriedaten (Zellenzahl/Geometrie) aus einer abgeschlossenen Messung. */
export function hasGeometryData(order: any): boolean {
  return measurements(order).some(
    (m) => /geometrie|geometry/i.test(serviceName(m)) && isCompleted(m.status) && hasResults(m)
  );
}

export function hasAnyResults(order: any): boolean {
  return measurements(order).some((m) => isCompleted(m.status) && hasResults(m));
}

export function hasSamples(order: any): boolean {
  const os = Array.isArray(order?.order_samples) ? order.order_samples : [];
  return os.length > 0 || !!order?.sample_id;
}

function releaseBasis(rel?: ReleaseLike | null): string {
  if (!rel) return "–";
  const rev = `Rev. ${Number(rel.revision_number) || 0}`;
  return rel.is_current === false ? `${rev} – nicht aktuell` : `${rev} – aktuell`;
}

export function evaluateRequirements(kind: DocKind, input: EvaluationInput): Evaluation {
  const { order, currentRelease, m3Status } = input;
  const missing: string[] = [];

  if (!currentRelease) {
    missing.push("Aktuelle Fertigungsfreigabe fehlt (keine Freigabe dem Auftrag zugeordnet)");
  } else if (currentRelease.is_current === false) {
    missing.push(`Fertigungsfreigabe Rev. ${Number(currentRelease.revision_number) || 0} ist noch nicht freigegeben`);
  }

  if (kind === "m3_list") {
    if (!hasGeometryData(order)) missing.push("Geometrievermessung (Zellenzahl/Geometriedaten) fehlt");
  } else {
    if (!hasSamples(order)) missing.push("Proben fehlen");
    if (!hasAnyResults(order)) missing.push("Messergebnisse fehlen");
    if (m3Status && m3Status !== "erstellt") missing.push("m³-Liste ist noch nicht erstellt");
    if (!m3Status || m3Status === "nicht_angefordert") missing.push("m³-Liste wurde noch nicht angefordert");
  }

  return {
    missing: Array.from(new Set(missing)),
    basedOnReleaseId: currentRelease?.id ?? null,
    basis: releaseBasis(currentRelease),
  };
}

/**
 * Automatische Statusfortschreibung: eine bestehende Anforderung geht nie
 * verloren – sie wechselt nur zwischen „Wartet auf Daten“ und
 * „Daten vollständig“, bis sie manuell in Erstellung/Erstellt gesetzt wird.
 */
export function nextStatus(current: DocStatus, missingCount: number): DocStatus {
  if (current === "nicht_angefordert") return current;
  if (current === "in_erstellung" || current === "erstellt") return current;
  return missingCount > 0 ? "wartet_auf_daten" : "daten_vollstaendig";
}
