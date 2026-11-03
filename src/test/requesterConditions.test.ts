import { describe, it, expect } from "vitest";
import { resolveRequesterConditions, findRunEntries } from "@/lib/results/requesterConditions";

const res = (ctx: Record<string, string> | null, key: string | null = null) =>
  ({ id: "r", result_name: "x", value: 1, unit: null, temperature_range_from: null, temperature_range_to: null,
     temperature_unit: null, remarks: null, measured_at: null, display_label: null, is_official: true,
     instance_key: key, instance_context: ctx }) as any;

describe("resolveRequesterConditions", () => {
  it("zeigt gespeicherten Ergebniskontext eines Durchlaufs", () => {
    const r = resolveRequesterConditions({ instanceKey: "a1b2", outputResults: [res({ T: "300 °C" }, "a1b2"), res({ T: "300 °C" }, "a1b2")] });
    expect(r.status).toBe("assigned");
    expect(r.entries).toEqual([{ key: "T", value: "300 °C" }]);
  });
  it("nutzt shared_form_data nur über exakte stabile Durchlauf-ID", () => {
    const sfd = { block: [{ __instance_id: "x1", __context: { AV: "5000" } }, { __instance_id: "x2", __context: { AV: "9000" } }] };
    const r = resolveRequesterConditions({ instanceKey: "x2", outputResults: [res(null, "x2")], orderSharedFormData: sfd });
    expect(r.entries).toEqual([{ key: "AV", value: "9000" }]);
    expect(r.sources).toEqual(["run_entry"]);
  });
  it("keine Zuordnung über Positions-Fallback idx_*", () => {
    const sfd = { block: [{ __context: { AV: "5000" } }] };
    const r = resolveRequesterConditions({ instanceKey: "idx_1", outputResults: [res(null, "idx_1")], orderSharedFormData: sfd });
    expect(r.status).toBe("unavailable");
  });
  it("keine Zuordnung über aktuelle auftragsweite Werte ohne Durchlauf-ID", () => {
    const r = resolveRequesterConditions({ instanceKey: null, outputResults: [res(null)], orderSharedFormData: { template: { values: { AV: "5000" } } } });
    expect(r.status).toBe("unavailable");
    expect(r.reason).toBe("no_binding");
  });
  it("mehrdeutige Durchlauf-ID → nicht eindeutig", () => {
    const sfd = { a: [{ __instance_id: "d", __context: { T: "1" } }], b: [{ __instance_id: "d", __context: { T: "1" } }] };
    expect(findRunEntries(sfd, "d")).toHaveLength(2);
    expect(resolveRequesterConditions({ instanceKey: "d", outputResults: [res(null, "d")], orderSharedFormData: sfd }).status).toBe("unavailable");
  });
  it("widersprüchliche Quellen → nicht eindeutig", () => {
    const sfd = { b: [{ __instance_id: "k", __context: { T: "400" } }] };
    const r = resolveRequesterConditions({ instanceKey: "k", outputResults: [res({ T: "300" }, "k")], orderSharedFormData: sfd });
    expect(r.reason).toBe("source_conflict");
  });
  it("abweichender Kontext innerhalb der Zeile → nicht eindeutig", () => {
    const r = resolveRequesterConditions({ instanceKey: "k", outputResults: [res({ T: "300" }, "k"), res({ T: "350" }, "k")] });
    expect(r.reason).toBe("inconsistent_results");
  });
});
