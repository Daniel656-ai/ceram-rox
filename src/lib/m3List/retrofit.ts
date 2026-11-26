/**
 * Proben-Nachprüfung bestehender m³-Beprobungsaufträge (reine Analyse, keine Schreibzugriffe).
 * Nutzt dieselbe Probenlogik wie die Neuanlage (planM3Samples / buildM3SampleNumber).
 * Jede Unklarheit führt zu „review“ – es wird dann nichts automatisch geändert.
 */
import { hasRowServiceOverride } from "./rowServices";
import { planM3Samples, M3SampleNumberError, type M3SamplePlanEntry } from "./sampleNumber";
import type { TestMarkingRowsResolution } from "./testMarking";

export interface RetrofitSample { id: string; sample_number: string; order_id: string | null }
export interface RetrofitMeasurement { id: string; service_id: string; service_name?: string | null; sample_id: string | null; status: string; has_results?: boolean }

export interface RetrofitRow extends M3SamplePlanEntry {
  existingSampleId: string | null;
  state: "exists" | "missing" | "link" | "conflict";
  services: string[];
}

export interface RetrofitAnalysis {
  status: "complete" | "possible" | "review";
  reasons: string[];
  rows: RetrofitRow[];
  plan: {
    samples: Array<{ sample_number: string; element_number: string; sample_name: string; description: string }>;
    links: Array<{ sample_id: string }>;
    assignments: Array<{ measurement_id: string; sample_number: string }>;
    new_tasks: Array<{ service_id: string; sample_number: string }>;
  };
}

export function analyzeM3Retrofit(input: {
  orderId: string;
  orderStatus: string;
  articleNumber: unknown;
  rows: Record<string, unknown>[];
  marking: TestMarkingRowsResolution;
  linkedSamples: RetrofitSample[];
  /** Alle Proben mit einer der geplanten Nummern (systemweit). */
  samplesByNumber: RetrofitSample[];
  measurements: RetrofitMeasurement[];
}): RetrofitAnalysis {
  const reasons: string[] = [];
  const empty = { samples: [], links: [], assignments: [], new_tasks: [] };
  if (input.rows.some(hasRowServiceOverride)) {
    return { status: "review", reasons: ["Individuelle Messungen je m³-Zeile vorhanden. Die automatische Nachrüstung würde abweichende Beauftragungen vereinheitlichen und wurde gestoppt."], rows: [], plan: empty };
  }
  let planEntries: M3SamplePlanEntry[];
  try {
    planEntries = planM3Samples(input.articleNumber, input.rows, input.marking);
  } catch (e) {
    const msg = e instanceof M3SampleNumberError ? e.message : "m³-Zeilen nicht rekonstruierbar.";
    return { status: "review", reasons: [msg], rows: [], plan: empty };
  }

  const linkedIds = new Set(input.linkedSamples.map((s) => s.id));
  const plannedNumbers = new Set(planEntries.map((p) => p.sampleNumber));
  const plan: RetrofitAnalysis["plan"] = { samples: [], links: [], assignments: [], new_tasks: [] };
  const sampleIdByNumber = new Map<string, string>();
  const articleNo = String(input.articleNumber ?? "").trim();

  const rows: RetrofitRow[] = planEntries.map((p) => {
    const hits = input.samplesByNumber.filter((s) => s.sample_number === p.sampleNumber);
    const base = { ...p, services: [] as string[] };
    if (hits.length === 0) {
      plan.samples.push({ sample_number: p.sampleNumber, element_number: p.elementNumber, sample_name: `${articleNo} · Element ${p.elementNumber}`, description: `m³-Liste Zeile ${p.rowIndex + 1}` });
      return { ...base, existingSampleId: null, state: "missing" as const };
    }
    const s = hits[0];
    if (linkedIds.has(s.id)) { sampleIdByNumber.set(p.sampleNumber, s.id); return { ...base, existingSampleId: s.id, state: "exists" as const }; }
    if (s.order_id === input.orderId) {
      plan.links.push({ sample_id: s.id }); sampleIdByNumber.set(p.sampleNumber, s.id);
      return { ...base, existingSampleId: s.id, state: "link" as const };
    }
    reasons.push(`Probennummer ${p.sampleNumber} existiert bereits bei einem anderen Auftrag.`);
    return { ...base, existingSampleId: s.id, state: "conflict" as const };
  });

  for (const s of input.linkedSamples) {
    if (!plannedNumbers.has(s.sample_number)) reasons.push(`Verknüpfte Probe ${s.sample_number} ist keiner m³-Zeile zuordenbar.`);
  }

  // Dienstleistungszuordnung je Probe.
  const known = new Set([...input.linkedSamples.map((s) => s.id), ...sampleIdByNumber.values()]);
  for (const m of input.measurements) {
    if (m.sample_id && !known.has(m.sample_id)) reasons.push(`Aufgabe einer Dienstleistung ist einer nicht zuordenbaren Probe zugewiesen.`);
  }
  const services = [...new Set(input.measurements.map((m) => m.service_id))];
  for (const serviceId of services) {
    const ofService = input.measurements.filter((m) => m.service_id === serviceId);
    const name = ofService[0]?.service_name ?? serviceId;
    const needing = rows.filter((r) => r.state !== "conflict" && !ofService.some((m) => m.sample_id && m.sample_id === (r.existingSampleId ?? sampleIdByNumber.get(r.sampleNumber))));
    const unassigned = ofService.filter((m) => !m.sample_id);
    for (const r of rows) if (!needing.includes(r)) r.services.push(name);
    if (needing.length === 0) continue;
    if (unassigned.length === 0) {
      if (input.orderStatus === "completed") { reasons.push(`${name}: Auftrag abgeschlossen – keine neuen Aufgaben.`); continue; }
      for (const r of needing) { plan.new_tasks.push({ service_id: serviceId, sample_number: r.sampleNumber }); r.services.push(`${name} (neu)`); }
      continue;
    }
    if (unassigned.length === 1 && needing.length === 1) {
      const m = unassigned[0];
      if (m.status !== "open" || m.has_results) { reasons.push(`${name}: bestehende Aufgabe ist begonnen/abgeschlossen – keine automatische Zuordnung.`); continue; }
      plan.assignments.push({ measurement_id: m.id, sample_number: needing[0].sampleNumber });
      needing[0].services.push(`${name} (zuordnen)`);
      continue;
    }
    reasons.push(`${name}: ${unassigned.length} Aufgabe(n) ohne Probe für ${needing.length} Probe(n) – Zuordnung nicht eindeutig.`);
  }

  const hasWork = plan.samples.length + plan.links.length + plan.assignments.length + plan.new_tasks.length > 0;
  const status = reasons.length > 0 ? "review" : hasWork ? "possible" : "complete";
  return { status, reasons, rows, plan: status === "possible" ? plan : empty };
}
