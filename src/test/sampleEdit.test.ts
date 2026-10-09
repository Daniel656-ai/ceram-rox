import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildSampleEditForm, diffSampleEdit, setHazardous, sanitizeSamplePatch,
  canEditSample, validateSampleEditForm, EDITABLE_SAMPLE_FIELDS,
} from "@/lib/samples/sampleEdit";

const base = {
  id: "s1", sample_number: "P260001", created_at: "2026-01-02T10:00:00Z", created_by: "u1",
  order_id: "o1", pilot_plant_order_id: "o2", parent_sample_id: "p0", mixture_batch_id: "mb",
  sample_name: "Probe A", project_id: "pr1", description: "Desc", category: "dieselkatalysator",
  v2o5_content: 2.5, operating_hours: 100, is_used_catalyst: false, raw_material_id: null,
  raw_material_code: "RM1", lot_number: "L1", bigbag_number: null, post_measurement_action: "aufbewahren",
  post_measurement_action_text: null, storage_min_duration: "1 Jahr", storage_hints: null,
  storage_expiry_date: "2027-01-01", disposal_method: null, disposal_hints: null, disposal_category: null,
  is_hazardous: true, hazard_categories: ["entzuendlich"], tags: ["x"], status: "neu", location_id: "loc",
};

describe("sampleEdit", () => {
  it("unverändertes Formular erzeugt keinen Patch", () => {
    const r = diffSampleEdit(base, buildSampleEditForm(base));
    expect(r.changes).toEqual([]);
    expect(r.patch).toEqual({});
  });

  it("nur geänderte Felder landen im Patch", () => {
    const f = buildSampleEditForm(base);
    f.sample_name = "Neu";
    const r = diffSampleEdit(base, f);
    expect(r.patch).toEqual({ sample_name: "Neu" });
    expect(r.changes[0]).toEqual({ field: "sample_name", old: "Probe A", new: "Neu" });
  });

  it("jedes erlaubte Feld ist änderbar", () => {
    const f = buildSampleEditForm(base);
    Object.assign(f, {
      sample_name: "N", project_id: "pr2", description: "D2", post_measurement_action: "andere",
      post_measurement_action_text: "t", storage_min_duration: "2", storage_hints: "h",
      storage_expiry_date: "2028-01-01", disposal_method: "m", disposal_hints: "dh",
      disposal_category: "laborabfall", is_hazardous: false, hazard_categories: [], tags: ["y"],
    });
    f.params = { category: "plattenkatalysator", v2o5_content: "3", operating_hours: "5",
      is_used_catalyst: true, raw_material_id: "rm", raw_material_code: "RM2", lot_number: "L2", bigbag_number: "B" };
    const keys = Object.keys(diffSampleEdit(base, f).patch).sort();
    expect(keys).toEqual([...EDITABLE_SAMPLE_FIELDS].sort());
  });

  it("Probennummer, Erstelldatum, Verknüpfungen werden nie gespeichert", () => {
    const clean = sanitizeSamplePatch({
      sample_number: "X", created_at: "x", created_by: "u9", order_id: "o9", pilot_plant_order_id: "o9",
      parent_sample_id: "p9", mixture_batch_id: "m", status: "entsorgt", location_id: "l",
      current_holder_id: "u", sample_name: "ok",
    });
    expect(clean).toEqual({ sample_name: "ok" });
  });

  it("Projektänderung betrifft nur project_id der Probe", () => {
    const f = buildSampleEditForm(base);
    f.project_id = "pr2";
    expect(diffSampleEdit(base, f).patch).toEqual({ project_id: "pr2" });
  });

  it("Gefahrstoff abwählen leert die Klassen und wird protokolliert", () => {
    const f = setHazardous(buildSampleEditForm(base), false);
    expect(f.hazard_categories).toEqual([]);
    const r = diffSampleEdit(base, f);
    expect(r.hazardCleared).toBe(true);
    expect(r.patch).toEqual({ is_hazardous: false, hazard_categories: [] });
  });

  it("Pflichtfelder wie bei der Anlage", () => {
    const f = buildSampleEditForm(base);
    f.sample_name = " ";
    expect(validateSampleEditForm(f)).toContain("sample_name");
  });

  it("nur Ersteller oder Master", () => {
    expect(canEditSample(base, "u1", "auftraggeber")).toBe(true);
    expect(canEditSample(base, "u2", "master")).toBe(true);
    expect(canEditSample(base, "u2", "durchfuehrer")).toBe(false);
    expect(canEditSample(base, null, "master")).toBe(false);
  });
});

// API: Fehlerbehandlung + nur Probe wird aktualisiert
const calls: any[] = [];
let updateResult: any = { data: [{ id: "s1" }], error: null };
vi.mock("@/lib/api/client", () => {
  const builder = (table: string) => {
    const b: any = {
      update: (p: any) => { calls.push({ table, op: "update", p }); return b; },
      insert: (p: any) => { calls.push({ table, op: "insert", p }); return Promise.resolve({ data: null, error: null }); },
      eq: () => b,
      select: () => Promise.resolve(updateResult),
    };
    return b;
  };
  return { dbClient: { from: builder } };
});

describe("api.samples.updateFields", () => {
  beforeEach(() => { calls.length = 0; updateResult = { data: [{ id: "s1" }], error: null }; });

  it("aktualisiert nur samples und schreibt Verlauf", async () => {
    const { samples } = await import("@/lib/api/samples");
    await samples.updateFields({ id: "s1", patch: { project_id: "pr2", order_id: "x" }, userId: "u1",
      changes: [{ field: "project_id", old: "pr1", new: "pr2" }] });
    expect(calls.map((c) => c.table)).toEqual(["samples", "sample_history"]);
    expect(calls[0].p).toEqual({ project_id: "pr2" });
    expect(calls[1].p.action).toBe("fields_updated");
  });

  it("wirft bei fehlender Berechtigung (0 Zeilen) und schreibt keinen Verlauf", async () => {
    updateResult = { data: [], error: null };
    const { samples } = await import("@/lib/api/samples");
    await expect(samples.updateFields({ id: "s1", patch: { sample_name: "x" }, userId: "u2", changes: [] })).rejects.toThrow();
    expect(calls.some((c) => c.table === "sample_history")).toBe(false);
  });

  it("wirft bei Datenbankfehler", async () => {
    updateResult = { data: null, error: { message: "boom" } };
    const { samples } = await import("@/lib/api/samples");
    await expect(samples.updateFields({ id: "s1", patch: { sample_name: "x" }, userId: "u1", changes: [] })).rejects.toThrow();
  });
});
