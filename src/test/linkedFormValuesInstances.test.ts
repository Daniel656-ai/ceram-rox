import { describe, it, expect } from "vitest";
import { buildLinkedFormValues, parseInstanceResultKey } from "@/lib/linkedFormValues";

const row = (results: any[], extra: any = {}) => ({
  id: extra.id ?? "m1",
  sample_id: extra.sample_id ?? "s1",
  updated_at: extra.updated_at ?? "2026-09-21T10:00:00Z",
  measurement_results: results,
});

describe("Wertverknüpfung: Messdatenblock-Ergebnisse", () => {
  it("zerlegt messungsbezogene Schlüssel", () => {
    expect(parseInstanceResultKey("geo[inst-1].D")).toEqual({
      blockKey: "geo", instanceId: "inst-1", fieldKey: "D",
    });
    expect(parseInstanceResultKey("D")).toBeNull();
  });

  it("stellt Messdatenblock-Werte zusätzlich unter dem reinen Feldschlüssel bereit", () => {
    const out = buildLinkedFormValues([
      row([
        { result_name: "form:geo:messung[i1].D", value: 150.3775, is_official: true },
        { result_name: "form:geo:messung[i1].ti", value: 0.2995, is_official: true },
        { result_name: "form:geo:messung[i1].d", value: 2.1967, is_official: true },
      ]),
    ]);
    expect(out.geo.D).toBe(150.3775);
    expect(out.geo.ti).toBe(0.2995);
    expect(out.geo.d).toBe(2.1967);
    // Exakter Schlüssel bleibt erhalten
    expect(out.geo["messung[i1].D"]).toBe(150.3775);
  });

  it("lässt normale Formularfelder unverändert und bevorzugt sie", () => {
    const out = buildLinkedFormValues([
      row([
        { result_name: "form:geo:D", value: 1 },
        { result_name: "form:geo:messung[i1].D", value: 2, is_official: true },
      ]),
    ]);
    expect(out.geo.D).toBe(1);
  });

  it("bevorzugt offizielle und danach zuletzt gemessene Ergebnisse", () => {
    const out = buildLinkedFormValues([
      row([
        { result_name: "form:geo:m[i1].D", value: 10, is_official: false, measured_at: "2026-09-22T10:00:00Z" },
        { result_name: "form:geo:m[i2].D", value: 20, is_official: true, measured_at: "2026-09-20T10:00:00Z" },
        { result_name: "form:geo:m[i3].D", value: 30, is_official: true, measured_at: "2026-09-21T10:00:00Z" },
      ]),
    ]);
    expect(out.geo.D).toBe(30);
  });

  it("beachtet Probenfilter und ausgeschlossene Messung", () => {
    const rows = [
      row([{ result_name: "form:geo:m[i1].D", value: 5 }], { id: "a", sample_id: "s1" }),
      row([{ result_name: "form:geo:m[i1].D", value: 9 }], { id: "b", sample_id: "s2" }),
    ];
    expect(buildLinkedFormValues(rows, { sampleId: "s1" }).geo.D).toBe(5);
    expect(buildLinkedFormValues(rows, { excludeMeasurementId: "a", sampleId: null }).geo.D).toBe(9);
  });

  it("übernimmt keine leeren Werte", () => {
    const out = buildLinkedFormValues([row([{ result_name: "form:geo:m[i1].D", value: null, remarks: "" }])]);
    expect(out.geo?.D).toBeUndefined();
  });
});
