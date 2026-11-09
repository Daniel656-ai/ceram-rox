import { describe, it, expect } from "vitest";
import { collectMirroredFieldKeys, isMirroredField, mayDeleteStoredRow } from "./persistGuard";

const linkedKey = (formId: string, fieldKey: string) => `form:${formId}:${fieldKey}`;

describe("isMirroredField", () => {
  it("erkennt Felder mit Wertquelle", () => {
    expect(isMirroredField({
      field_key: "spiegel",
      data_source: { source: { kind: "workflow_step", step_key: "s1", field_key: "q" } },
    })).toBe(true);
  });

  it("erkennt Stammdatenreferenzen", () => {
    expect(isMirroredField({
      field_key: "md",
      metadata: { master_data_ref: { list_key: "l", item_value: "i" } },
    })).toBe(true);
  });

  it("normale Felder sind nicht gespiegelt", () => {
    expect(isMirroredField({ field_key: "normal" })).toBe(false);
    expect(isMirroredField({ field_key: "normal", data_source: null, metadata: {} })).toBe(false);
  });
});

describe("collectMirroredFieldKeys", () => {
  it("sammelt direkte und verknüpfte Feldschlüssel", () => {
    const keys = collectMirroredFieldKeys(
      [
        { field_key: "direkt", data_source: { source: { kind: "form_field", field_key: "q" } } },
        { field_key: "normal" },
      ],
      [
        {
          formId: "f1",
          fields: [
            { field_key: "md", metadata: { master_data_ref: { list_key: "l", item_value: "i" } } },
            { field_key: "normal2" },
          ],
        },
      ],
      linkedKey,
    );
    expect([...keys].sort()).toEqual(["direkt", "form:f1:md"]);
  });

  it("verträgt leere/fehlende Eingaben", () => {
    expect(collectMirroredFieldKeys([], [], linkedKey).size).toBe(0);
    expect(collectMirroredFieldKeys(undefined as any, null as any, linkedKey).size).toBe(0);
  });
});

describe("mayDeleteStoredRow", () => {
  it("schützt gespiegelte Felder beim Entwurfsspeichern", () => {
    expect(mayDeleteStoredRow({ draftOnly: true, mirrored: true })).toBe(false);
  });

  it("lässt bewusstes Leeren normaler Felder im Entwurf zu", () => {
    expect(mayDeleteStoredRow({ draftOnly: true, mirrored: false })).toBe(true);
  });

  it("lässt Löschungen beim endgültigen Abschluss zu", () => {
    expect(mayDeleteStoredRow({ draftOnly: false, mirrored: true })).toBe(true);
    expect(mayDeleteStoredRow({ draftOnly: false, mirrored: false })).toBe(true);
  });
});
