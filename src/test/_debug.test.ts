import { it } from "vitest";
import { mapReadings, buildCaseTargets } from "@/lib/measurementImport";
it("debug", () => {
  const spec = buildCaseTargets([], [{ field_key: "fe_wert", label: "fe_wert", official: true, unit: null }], null, true);
  console.log("SPEC", JSON.stringify(spec.slice(0, 4)), "len", spec.length);
  const spec2 = buildCaseTargets([], [{ field_key: "fe_wert", label: "fe_wert", official: true, unit: "%" }], null, true);
  const t = spec2.find(s => s.field_key === "fe_wert");
  console.log("FE TARGET", JSON.stringify(t));
  const rows = mapReadings([{ sourceName: "fe_wert", raw: "5,2", value: 5.2, unit: "ppm", belowDetection: false }], null, spec2, {});
  console.log("ROW", JSON.stringify(rows[0]));
});
