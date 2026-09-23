import { describe, it, expect } from "vitest";
import {
  subfieldListId,
  subfieldFormFieldType,
  subfieldInsertMetadata,
  type GlobalRepeaterSubfield,
} from "@/lib/api/globalModel";

const sub = (p: Partial<GlobalRepeaterSubfield>): GlobalRepeaterSubfield => ({
  field_key: "ms",
  display_name: "MS",
  data_type: "text",
  ...p,
});

describe("Repeater-Unterfelder mit Stammdatenreferenz", () => {
  it("behandelt Unterfelder ohne Datenquelle unverändert", () => {
    const s = sub({});
    expect(subfieldListId(s)).toBeNull();
    expect(subfieldFormFieldType(s)).toBe("text");
    expect(subfieldInsertMetadata(s)).toEqual({});
  });

  it("macht aus einem Unterfeld mit Stammdatenliste eine Auswahl", () => {
    const s = sub({ list_id: "list-mundstuecke" });
    expect(subfieldListId(s)).toBe("list-mundstuecke");
    expect(subfieldFormFieldType(s)).toBe("select");
    expect(subfieldInsertMetadata(s)).toEqual({ global_list_id: "list-mundstuecke" });
  });

  it("wirkt generisch für beliebige Unterfeldtypen und Listen", () => {
    expect(subfieldFormFieldType(sub({ data_type: "number", list_id: "andere-liste" }))).toBe("select");
    expect(subfieldFormFieldType(sub({ data_type: "number" }))).toBe("number");
    expect(subfieldListId(sub({ list_id: "" }))).toBeNull();
  });
});
