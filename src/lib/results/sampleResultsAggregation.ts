import { format, parseISO, isAfter, isBefore } from "date-fns";
import { de } from "date-fns/locale";

/**
 * Probenbezogene Aggregation der Ergebnisdatenbank (3-Ebenen-Sicht).
 *
 * Verbindliche Regeln:
 * - Verlustfrei: Jeder gespeicherte Ergebnisdatensatz erscheint genau einmal.
 *   Es wird niemals dedupliziert, gemittelt oder auf Min/Max reduziert.
 * - Kanonische Identität eines Werts: result_name + COALESCE(instance_key,'').
 * - Offiziell ist ausschließlich `is_official === true`; NULL/false gilt als
 *   vorläufiger Arbeitswert und wird nie als offiziell ausgewiesen.
 * - Die Gruppierung nach Proben dient nur der Navigation (Ebene 1).
 */

export interface SampleResultValue {
  id: string;
  result_name: string;
  value: number | null;
  unit: string | null;
  temperature_range_from: number | null;
  temperature_range_to: number | null;
  temperature_unit: string | null;
  remarks: string | null;
  measured_at: string | null;
  display_label: string | null;
  is_official: boolean;
  instance_key?: string | null;
  instance_label?: string | null;
  instance_context?: Record<string, string> | null;
}

/** Eine Messung (Analyse) einer Probe mit sämtlichen Ergebniswerten. */
export interface SampleMeasurementRecord {
  measurementId: string;
  measurementNumber: string;
  orderId: string;
  orderNumber: string;
  /** Anzeige-Identität des Auftrags (technische Nummer bleibt orderNumber). */
  orderDisplayNumber: string;
  orderType: string;
  projectNumber: string;
  projectName: string;
  sampleId: string | null;
  sampleNumber: string;
  sampleName: string;
  originalSampleNumber: string | null;
  serviceId: string | null;
  serviceName: string;
  serviceCategory: string;
  assignedToId: string | null;
  assignedToName: string;
  createdById: string;
  createdByName: string;
  status: string;
  completedAt: string | null;
  createdAt: string;
  remarks: string;
  results: SampleResultValue[];
  /** Read-only: shared_form_data des Auftrags (durchlaufgebundene Vorgaben). */
  orderSharedFormData?: unknown;
}

/** Ebene 1: eine Probe mit allen zugehörigen Messungen. */
export interface SampleGroup {
  /** Stabiler Gruppenschlüssel (sampleId, sonst Auftrags-Fallback). */
  sampleKey: string;
  sampleId: string | null;
  sampleNumber: string;
  sampleName: string;
  originalSampleNumber: string | null;
  projectNames: string[];
  orderDisplayNumbers: string[];
  orderIds: string[];
  measurements: SampleMeasurementRecord[];
  officialCount: number;
  interimCount: number;
  lastActivityAt: string | null;
}

/** Kanonische Identität eines Ergebniswerts (Durchlauf-sicher). */
export function resultIdentityKey(resultName: string, instanceKey?: string | null): string {
  return `${resultName}::${instanceKey ?? ""}`;
}

/** Ein Wert ist nur dann offiziell, wenn ausdrücklich true gesetzt ist. */
export function isOfficialResult(r: Pick<SampleResultValue, "is_official">): boolean {
  return r.is_official === true;
}

/**
 * Gruppiert Messungen verlustfrei nach Proben. Messungen ohne eigene Probe
 * bilden je Auftrag eine eigene Gruppe („Ohne Probe"), damit kein Datensatz
 * untergeht oder einer fremden Probe zugeordnet wird.
 */
export function groupRecordsBySample(records: SampleMeasurementRecord[]): SampleGroup[] {
  const groups = new Map<string, SampleGroup>();
  for (const rec of records) {
    const key = rec.sampleId ?? `order:${rec.orderId}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        sampleKey: key,
        sampleId: rec.sampleId,
        sampleNumber: rec.sampleNumber,
        sampleName: rec.sampleName,
        originalSampleNumber: rec.originalSampleNumber,
        projectNames: [],
        orderDisplayNumbers: [],
        orderIds: [],
        measurements: [],
        officialCount: 0,
        interimCount: 0,
        lastActivityAt: null,
      };
      groups.set(key, g);
    }
    g.measurements.push(rec);
    if (rec.projectName && !g.projectNames.includes(rec.projectName)) g.projectNames.push(rec.projectName);
    const displayNum = rec.orderDisplayNumber || rec.orderNumber;
    if (displayNum && !g.orderDisplayNumbers.includes(displayNum)) g.orderDisplayNumbers.push(displayNum);
    if (rec.orderId && !g.orderIds.includes(rec.orderId)) g.orderIds.push(rec.orderId);
    if (rec.originalSampleNumber && !g.originalSampleNumber) g.originalSampleNumber = rec.originalSampleNumber;
    for (const r of rec.results) {
      if (isOfficialResult(r)) g.officialCount += 1;
      else g.interimCount += 1;
    }
    const t = rec.completedAt ?? rec.createdAt;
    if (t && (!g.lastActivityAt || t > g.lastActivityAt)) g.lastActivityAt = t;
  }
  return [...groups.values()].sort((a, b) =>
    (a.sampleNumber || "￿").localeCompare(b.sampleNumber || "￿", "de")
  );
}

/** Durchlauf-Instanzen einer Messung (Messdatenblock/Repeater), stabil sortiert. */
export interface MeasurementInstance {
  instanceKey: string;
  instanceLabel: string | null;
  results: SampleResultValue[];
}

export function groupResultsByInstance(results: SampleResultValue[]): MeasurementInstance[] {
  const map = new Map<string, MeasurementInstance>();
  for (const r of results) {
    const key = r.instance_key ?? "";
    let inst = map.get(key);
    if (!inst) {
      inst = { instanceKey: key, instanceLabel: r.instance_label ?? null, results: [] };
      map.set(key, inst);
    }
    if (!inst.instanceLabel && r.instance_label) inst.instanceLabel = r.instance_label;
    inst.results.push(r);
  }
  return [...map.values()];
}

/** Zählt zur Sicherheit: jede Ergebnis-ID darf in den Gruppen genau einmal vorkommen. */
export function countResultOccurrences(groups: SampleGroup[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const g of groups)
    for (const m of g.measurements)
      for (const r of m.results) counts.set(r.id, (counts.get(r.id) ?? 0) + 1);
  return counts;
}

export interface SampleFilterState {
  serviceFilter: string;
  projectFilter: string;
  creatorFilter: string;
  technicianFilter: string;
  sampleFilter: string;
  dateFrom: string;
  dateTo: string;
  searchText: string;
}

/**
 * Filtersemantik identisch zur Ergebnismatrix/Statistik, damit die globalen
 * Filtereinstellungen in allen drei Ansichten gleich wirken.
 */
export function matchesSampleFilters(rec: SampleMeasurementRecord, f: SampleFilterState): boolean {
  if (f.serviceFilter !== "all" && rec.serviceName !== f.serviceFilter) return false;
  if (f.projectFilter !== "all" && rec.projectName !== f.projectFilter) return false;
  if (f.creatorFilter !== "all" && rec.createdByName !== f.creatorFilter) return false;
  if (f.technicianFilter !== "all" && rec.assignedToName !== f.technicianFilter) return false;
  if (
    f.sampleFilter &&
    !rec.sampleNumber.toLowerCase().includes(f.sampleFilter.toLowerCase()) &&
    !rec.sampleName.toLowerCase().includes(f.sampleFilter.toLowerCase())
  )
    return false;
  if (f.dateFrom && rec.completedAt && isBefore(parseISO(rec.completedAt), parseISO(f.dateFrom))) return false;
  if (f.dateTo && rec.completedAt && isAfter(parseISO(rec.completedAt), parseISO(f.dateTo + "T23:59:59"))) return false;
  if (f.searchText) {
    const s = f.searchText.toLowerCase();
    const matches = [
      rec.measurementNumber,
      rec.orderDisplayNumber,
      rec.orderNumber,
      rec.projectNumber,
      rec.projectName,
      rec.sampleNumber,
      rec.sampleName,
      rec.serviceName,
      rec.assignedToName,
      rec.createdByName,
      rec.remarks,
    ].some((v) => v?.toLowerCase().includes(s));
    if (!matches) return false;
  }
  return true;
}

/** Datumsformatierung der Probenansicht (de-AT). */
export function formatSampleDate(iso: string | null): string {
  if (!iso) return "–";
  try {
    return format(parseISO(iso), "dd.MM.yyyy", { locale: de });
  } catch {
    return "–";
  }
}
