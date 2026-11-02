import { it } from "vitest";
import { buildLinkedFormResultCandidates } from "@/lib/officialResults";
it("debug", () => {
  const fields = [
    { id: "b1", field_key: "messblock", field_type: "measurement_block", parent_field_id: null },
    { id: "c1", field_key: "fe_wert", field_type: "number", parent_field_id: "b1" },
  ] as any[];
  const tv = { "form:F1:messblock": [{ __instance_id: "i1", "element:Nd": 0.04, fe_wert: 5.2, "element:Ti": "" }] };
  const c = buildLinkedFormResultCandidates("F1", fields, [], tv, [], { rfaDefault: true });
  console.log("COUNT", c.length);
  for (const x of c.filter(x => x.key.includes("Nd") || x.key.includes("fe_wert") || x.key.includes("Ti"))) {
    console.log(x.key, "| official:", x.official, "| value:", JSON.stringify(x.value));
  }
});
