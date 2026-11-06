import { describe, it, expect } from "vitest";
import {
  buildAmendmentChanges,
  validateAmendment,
  isBlockEntryResultName,
  resultIdentityKey,
  type ExistingResult,
} from "@/lib/amendment/payload";

const ex = (over: Partial<ExistingResult>): ExistingResult => ({
  id: "r1",
  result_name: "dichte",
  instance_key: null,
  display_label: "Dichte",
  unit: "g/cm³",
  value: 2.5,
  text_value: null,
  remarks: null,
  is_official: true,
  ...over,
});

describe("resultIdentityKey", () => {
  it("hält Schlüsselbestandteile getrennt (keine Verkettungskollision)", () => {
    expect(resultIdentityKey("a::b", null)).not.toBe(resultIdentityKey("a", "b"));
  });
});

describe("isBlockEntryResultName", () => {
  const fid = "123e4567-e89b-42d3-a456-426614174000";
  it("erkennt Messblock-Einträge", () => {
    expect(isBlockEntryResultName(`form:${fid}:block1[inst1].feld`)).toBe(true);
  });
  it("erkennt normale Formularfelder nicht als Block", () => {
    expect(isBlockEntryResultName(`form:${fid}:temperatur`)).toBe(false);
    expect(isBlockEntryResultName("dichte")).toBe(false);
  });
});

describe("buildAmendmentChanges", () => {
  it("übernimmt geänderte numerische Werte", () => {
    const { values, changes } = buildAmendmentChanges(
      [ex({})],
      [{ result_name: "dichte", instance_key: null, value: 2.7 }],
      [],
    );
    expect(values).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: "modified", oldDisplay: "2.5", newDisplay: "2.7" });
  });

  it("behandelt 0 als gültigen Wert", () => {
    const { values, changes } = buildAmendmentChanges(
      [ex({})],
      [{ result_name: "dichte", instance_key: null, value: 0 }],
      [],
    );
    expect(values).toHaveLength(1);
    expect(changes[0].newDisplay).toBe("0");
  });

  it("lässt unveränderte Felder unberührt", () => {
    const { values, changes } = buildAmendmentChanges(
      [ex({})],
      [{ result_name: "dichte", instance_key: null, value: 2.5 }],
      [],
    );
    expect(values).toHaveLength(0);
    expect(changes).toHaveLength(0);
  });

  it("unterscheidet fehlenden Schlüssel (behalten) von null (leeren)", () => {
    const { values } = buildAmendmentChanges(
      [ex({ text_value: "alt", value: null })],
      [{ result_name: "dichte", instance_key: null, text_value: null, remarks: "neu" }],
      [],
    );
    expect(values[0].text_value).toBeNull();
    expect(values[0]).not.toHaveProperty("value");
  });

  it("meldet ausdrückliches Leeren als cleared", () => {
    const { changes } = buildAmendmentChanges(
      [ex({ text_value: null, remarks: null })],
      [{ result_name: "dichte", instance_key: null, value: null }],
      [],
    );
    expect(changes[0].kind).toBe("cleared");
  });

  it("führt Entfernen mit altem Wert in der Zusammenfassung", () => {
    const { remove, changes } = buildAmendmentChanges(
      [ex({})],
      [],
      [{ result_name: "dichte", instance_key: null }],
    );
    expect(remove).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: "removed", oldDisplay: "2.5" });
  });

  it("ignoriert Entfernen nicht vorhandener Felder", () => {
    const { remove } = buildAmendmentChanges([ex({})], [], [
      { result_name: "unbekannt", instance_key: null },
    ]);
    expect(remove).toHaveLength(0);
  });

  it("meldet neue Felder als added", () => {
    const { values, changes } = buildAmendmentChanges(
      [],
      [{ result_name: "neu", instance_key: null, value: 1 }],
      [],
    );
    expect(values).toHaveLength(1);
    expect(changes[0].kind).toBe("added");
  });
});

describe("validateAmendment", () => {
  const base = {
    existing: [ex({})],
    values: [{ result_name: "dichte", instance_key: null, value: 3 }],
    remove: [],
    files: [],
  };

  it("verlangt eine Begründung", () => {
    expect(validateAmendment({ ...base, reason: "   " })).toContain("Eine Begründung ist erforderlich.");
  });

  it("akzeptiert einen gültigen Vorgang", () => {
    expect(validateAmendment({ ...base, reason: "Tippfehler" })).toEqual([]);
  });

  it("weist doppelte Identitäten in values ab", () => {
    const errors = validateAmendment({
      ...base,
      reason: "x",
      values: [
        { result_name: "dichte", instance_key: null, value: 3 },
        { result_name: "dichte", instance_key: null, value: 4 },
      ],
    });
    expect(errors.some((e) => e.includes("Doppelter Eintrag"))).toBe(true);
  });

  it("weist gleichzeitiges Ändern und Entfernen ab", () => {
    const errors = validateAmendment({
      ...base,
      reason: "x",
      remove: [{ result_name: "dichte", instance_key: null }],
    });
    expect(errors.some((e) => e.includes("gleichzeitig"))).toBe(true);
  });

  it("weist value + text_value gleichzeitig ab", () => {
    const errors = validateAmendment({
      ...base,
      reason: "x",
      values: [{ result_name: "dichte", instance_key: null, value: 1, text_value: "a" }],
    });
    expect(errors.some((e) => e.includes("Widerspruch"))).toBe(true);
  });

  it("weist vollständiges Leeren ohne Löschaktion ab", () => {
    const errors = validateAmendment({
      ...base,
      reason: "x",
      values: [{ result_name: "dichte", instance_key: null, value: null }],
    });
    expect(errors.some((e) => e.includes("wäre danach leer"))).toBe(true);
  });

  it("weist neue Messblock-Ergebnisse ab (G1)", () => {
    const fid = "123e4567-e89b-42d3-a456-426614174000";
    const errors = validateAmendment({
      ...base,
      reason: "x",
      values: [{ result_name: `form:${fid}:block[neu].feld`, instance_key: null, value: 1 }],
    });
    expect(errors.some((e) => e.includes("Messblock"))).toBe(true);
  });

  it("weist Entfernen nicht vorhandener Felder ab", () => {
    const errors = validateAmendment({
      ...base,
      reason: "x",
      values: [],
      remove: [{ result_name: "gibts-nicht", instance_key: null }],
      files: [{ kind: "upload", storage_path: "orders/m/f/x.pdf", file_name: "x.pdf" }],
    });
    expect(errors.some((e) => e.includes("existiert nicht"))).toBe(true);
  });

  it("weist doppelte old_id beim Dateiersatz ab", () => {
    const errors = validateAmendment({
      ...base,
      reason: "x",
      values: [],
      files: [
        { kind: "upload", old_id: "u1", storage_path: "orders/m/f/a.pdf", file_name: "a.pdf" },
        { kind: "upload", old_id: "u1", storage_path: "orders/m/f/b.pdf", file_name: "b.pdf" },
      ],
    });
    expect(errors.some((e) => e.includes("mehrfach ersetzt"))).toBe(true);
  });

  it("weist doppelte Speicherpfade ab", () => {
    const errors = validateAmendment({
      ...base,
      reason: "x",
      values: [],
      files: [
        { kind: "document", storage_path: "u/m/a.pdf", file_name: "a.pdf" },
        { kind: "document", storage_path: "u/m/a.pdf", file_name: "a2.pdf" },
      ],
    });
    expect(errors.some((e) => e.includes("Doppelter Speicherpfad"))).toBe(true);
  });

  it("weist Vorgänge ohne jede Änderung ab", () => {
    const errors = validateAmendment({ ...base, reason: "x", values: [] });
    expect(errors).toContain("Keine Änderungen gegenüber dem gespeicherten Stand.");
  });
});
