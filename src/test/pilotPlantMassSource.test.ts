import { describe, expect, it } from "vitest";
import { includePilotPlantMassType } from "@/components/OrderKindDynamicForm";
import type { FormField } from "@/lib/api/formFields";
import type { FormLayoutTree } from "@/lib/api/formDefinitionLayout";

const local = { id: "existing-mass-id", field_key: "massetyp", field_type: "select", parent_field_id: null, global_field_id: null, select_options: ["DK", "GK", "KK", "MK", "PK", "Heat Media"] } as FormField;
const layout: FormLayoutTree = { version: 1, nodes: [] };

describe("Approved local Pilot Plant mass source", () => {
  it("reuses the existing massetyp definition, including the stored Heat Media value", () => {
    const result = includePilotPlantMassType(layout, [local], "pilot_plant");
    expect(result.nodes).toEqual([{ id: "pp-existing-mass-existing-mass-id", type: "field", field_id: "existing-mass-id", width: 12 }]);
    expect(local.field_key).toBe("massetyp");
    expect(local.select_options).toEqual(["DK", "GK", "KK", "MK", "PK", "Heat Media"]);
    expect(layout.nodes).toEqual([]);
  });
  it("does not substitute masse_type or pp_masse_type", () => {
    for (const field_key of ["masse_type", "pp_masse_type"]) {
      expect(includePilotPlantMassType(layout, [{ ...local, field_key }], "pilot_plant")).toBe(layout);
    }
  });
  it("leaves lab forms unchanged", () => {
    expect(includePilotPlantMassType(layout, [local], "labor")).toBe(layout);
  });
  it("does not duplicate a field already present in a nested layout", () => {
    const nested: FormLayoutTree = { version: 1, nodes: [{ id: "section", type: "section", children: [{ id: "field", type: "field", field_id: local.id, visible: false }] }] };
    expect(includePilotPlantMassType(nested, [local], "pilot_plant")).toBe(nested);
  });
  it("does not create a missing field", () => {
    expect(includePilotPlantMassType(layout, [], "pilot_plant")).toBe(layout);
  });
});