import { describe, it, expect, vi, beforeEach } from "vitest";

// Minimaler Datenbank-Mock für systemContext.load (nur lesende Einzelabfragen).
const rows: Record<string, Record<string, Record<string, unknown>>> = {};
vi.mock("@/lib/api/client", () => {
  const query = (table: string) => {
    let id: string | null = null;
    const q: any = {
      select: () => q,
      eq: (col: string, v: string) => { if (col === "id") id = v; return q; },
      in: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: async () => ({ data: id ? rows[table]?.[id] ?? null : null }),
    };
    return q;
  };
  return {
    dbClient: {
      auth: { getUser: async () => ({ data: { user: null } }) },
      from: query,
    },
  };
});

import {
  clearActiveTaskContext,
  extractSampleNumbers,
  getActiveTaskContext,
  resolveOrderLevelSampleId,
  resolveTaskSample,
  setActiveTaskContext,
  verifyFileSampleNumber,
  verifyImportContext,
} from "@/lib/samples/activeSampleContext";
import { systemContext } from "@/lib/api/systemContext";

const SAMPLES = [
  { id: "s1", sample_number: "P260001", sample_name: "Probe A" },
  { id: "s2", sample_number: "P260002", sample_name: "Probe B" },
  { id: "s3", sample_number: "P260003", sample_name: "Probe C" },
  { id: "s4", sample_number: "P260004", sample_name: "Probe D" },
];
// Auftrag mit vier Proben: Auftragsprobe ist (wie bei der Anlage) die erste.
const ORDER = { id: "o1", sample_id: "s1", samples: SAMPLES[0] };
const MEASUREMENTS = SAMPLES.map((s, i) => ({
  id: `m${i + 1}`,
  sample_id: s.id,
  samples: s,
  measurement_orders: ORDER,
}));

beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k];
  rows.measurement_orders = { o1: { id: "o1", sample_id: "s1", sample_ids: ["s1", "s2", "s3", "s4"] } };
  rows.samples = Object.fromEntries(SAMPLES.map((s) => [s.id, s]));
  for (const m of MEASUREMENTS) clearActiveTaskContext(m.id);
});

describe("Maßgebliche Probe einer Dienstleistung", () => {
  it("vier Proben im selben Auftrag: jede Dienstleistung zeigt ihre eigene Probe, nie die Auftragsprobe", () => {
    const resolved = MEASUREMENTS.map(resolveTaskSample);
    expect(resolved.map((r) => (r.status === "resolved" ? r.id : null))).toEqual(["s1", "s2", "s3", "s4"]);
    expect(resolved.map((r) => (r.status === "resolved" ? r.sampleNumber : null)))
      .toEqual(["P260001", "P260002", "P260003", "P260004"]);
  });

  it("Wechsel zwischen Proben: Systemvariablen (probe.*) folgen der Probe der Dienstleistung", async () => {
    for (const m of MEASUREMENTS) {
      const r = resolveTaskSample(m);
      const ctx = await systemContext.load({
        orderId: "o1",
        sampleId: r.status === "resolved" ? r.id : null,
        strictSample: true,
      });
      expect((ctx.probe as any)?.id).toBe(m.sample_id);
      expect((ctx.probe as any)?.sample_name).toBe(m.samples.sample_name);
    }
  });

  it("fehlende Proben-ID: kein stiller Rückfall auf die Auftrags- bzw. erste Probe", async () => {
    const r = resolveTaskSample({ ...MEASUREMENTS[2], sample_id: null });
    expect(r).toEqual({ status: "unresolved", reason: "missing" });
    const ctx = await systemContext.load({ orderId: "o1", sampleId: null, strictSample: true });
    expect(ctx.probe).toBeUndefined();
  });

  it("widersprüchliche Probe (ID ≠ geladene Relation) bleibt unaufgelöst", () => {
    const r = resolveTaskSample({ ...MEASUREMENTS[1], samples: SAMPLES[0] });
    expect(r).toEqual({ status: "unresolved", reason: "mismatch" });
  });

  it("Auftragsebene: mehrere Proben → keine Probe; genau eine Probe → diese", () => {
    expect(resolveOrderLevelSampleId({ ...ORDER, order_measurements: MEASUREMENTS })).toBeNull();
    expect(resolveOrderLevelSampleId({ ...ORDER, order_measurements: [MEASUREMENTS[0]] })).toBe("s1");
  });
});

describe("Import-Absicherung", () => {
  it("abweichende Probennummer in der Datei verhindert das Speichern", () => {
    const res = verifyFileSampleNumber([{ SAMPLE: "P260001 Probe A" }], "P260003");
    expect(res.ok).toBe(false);
    expect(res.message).toContain("P260001");
  });

  it("mehrere Probennummern in der Datei sind mehrdeutig und werden abgelehnt", () => {
    expect(verifyFileSampleNumber(["P260001", "P260002"], "P260001").ok).toBe(false);
  });

  it("passende Probennummer bzw. Datei ohne Probennummer ist zulässig", () => {
    expect(verifyFileSampleNumber(["Kopf: p260003"], "P260003").ok).toBe(true);
    expect(verifyFileSampleNumber(["Probe A"], "P260003").ok).toBe(true);
    expect(extractSampleNumbers(["XP2600011", "P260001-2"])).toEqual(["P260001-2"]);
  });

  it("Import ohne eindeutige Probe wird abgebrochen", () => {
    setActiveTaskContext({ orderMeasurementId: "m1", sampleId: null });
    expect(verifyImportContext({ orderMeasurementId: "m1", sampleId: null }, getActiveTaskContext()).ok).toBe(false);
  });

  it("Wechsel der Dienstleistung während eines Imports verhindert das Speichern", () => {
    setActiveTaskContext({ orderMeasurementId: "m1", sampleId: "s1" });
    const snapshot = { orderMeasurementId: "m1", sampleId: "s1" };
    expect(verifyImportContext(snapshot, getActiveTaskContext()).ok).toBe(true);
    // Nutzer wechselt zu Dienstleistung 3: alte Seite räumt auf, neue registriert sich.
    clearActiveTaskContext("m1");
    setActiveTaskContext({ orderMeasurementId: "m3", sampleId: "s3" });
    const res = verifyImportContext(snapshot, getActiveTaskContext());
    expect(res.ok).toBe(false);
    expect(res.message).toContain("gewechselt");
  });

  it("verspätetes Aufräumen der alten Dienstleistung löscht den neuen Kontext nicht", () => {
    setActiveTaskContext({ orderMeasurementId: "m3", sampleId: "s3" });
    clearActiveTaskContext("m1");
    expect(getActiveTaskContext()).toEqual({ orderMeasurementId: "m3", sampleId: "s3" });
  });
});
