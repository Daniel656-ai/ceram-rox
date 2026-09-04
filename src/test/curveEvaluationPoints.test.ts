import { describe, expect, it } from "vitest";
import { groupPointEvaluations } from "@/components/curves/CurvePointEvaluations";
import { evaluationCsv, rawDataCsv } from "@/lib/curves/export";
import type { CurveEvaluationRecord } from "@/lib/api/measurementRawData";

const rec = (over: Partial<CurveEvaluationRecord>): CurveEvaluationRecord => ({
  id: "r1", dataset_id: "d1", measurement_result_id: null, kind: "point", x_at: 850,
  group_id: "g1", comment: null, include_in_report: true, x_label: "Temp.", y_label: "dL/Lo",
  revision: 1, updated_by: null, updated_at: "2026-01-01T10:00:00Z",
  method: "value_at_x", method_label: "Wert an definierter Stelle",
  x_channel: "temp", x_unit: "°C", y_channel: "dl_lo", y_unit: "%",
  x_from: 850, x_to: 850, value: 1.23, unit: "%", formula: "", details: [],
  result_label: null, created_by: null, created_at: "2026-01-01T10:00:00Z",
  ...over,
});

describe("Auswertungspunkte", () => {
  it("gruppiert Kurvenwerte je Stelle und sortiert nach X", () => {
    const groups = groupPointEvaluations([
      rec({ id: "a", group_id: "g2", x_at: 1000 }),
      rec({ id: "b", group_id: "g1", x_at: 850 }),
      rec({ id: "c", group_id: "g1", x_at: 850, y_channel: "alpha" }),
    ]);
    expect(groups.map((g) => g.x)).toEqual([850, 1000]);
    expect(groups[0].rows).toHaveLength(2);
  });

  it("ignoriert Bereichsauswertungen", () => {
    expect(groupPointEvaluations([rec({ kind: "range" })])).toHaveLength(0);
  });

  it("exportiert Auswertungen mit deutschem Zahlenformat", () => {
    const csv = evaluationCsv([rec({ value: 1.5 })]);
    expect(csv).toContain("1,5");
    expect(csv.split("\n")[0]).toContain("Auswertungsmethode");
  });

  it("exportiert Rohdaten unverändert", () => {
    const csv = rawDataCsv({
      channels: [{ key: "temp", label: "Temp.", unit: "°C" }, { key: "dl", label: "dL", unit: "%" }],
      rows: [[20, 0], [850, 1.25]],
    });
    expect(csv.split("\n")[0]).toBe("Temp. [°C];dL [%]");
    expect(csv).toContain("850;1,25");
  });
});
