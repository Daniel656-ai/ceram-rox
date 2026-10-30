import { describe, it, expect } from "vitest";
import {
  parseResultInput,
  canonicalResultKey,
  buildReplaceResultsPayload,
  buildChangedEntries,
  type ReplaceResultsPayload,
} from "@/lib/results/replaceResults";

const basePayload = (): ReplaceResultsPayload => ({
  orderMeasurementId: "om-1",
  operationId: "op-1",
  reason: "Korrigierte Auswertung",
  results: [{ result_name: "BET", value: 12.5 }],
});

describe("parseResultInput", () => {
  it("interpretiert 0 als gültigen numerischen Wert", () => {
    expect(parseResultInput("0")).toEqual({ value: 0 });
  });

  it("akzeptiert deutsches Komma und Punkt", () => {
    expect(parseResultInput("12,5")).toEqual({ value: 12.5 });
    expect(parseResultInput("12.5")).toEqual({ value: 12.5 });
  });

  it("akzeptiert Exponentialschreibweise", () => {
    expect(parseResultInput("1e3")).toEqual({ value: 1000 });
  });

  it("behandelt Texte wie n.b. und < 0.1 als Textwerte", () => {
    expect(parseResultInput("n.b.")).toEqual({ text_value: "n.b." });
    expect(parseResultInput("< 0.1")).toEqual({ text_value: "< 0.1" });
  });

  it("behandelt leere Eingaben als nicht übernommen", () => {
    expect(parseResultInput("")).toBeNull();
    expect(parseResultInput("   ")).toBeNull();
  });

  it("behandelt mehrdeutige Zahlentexte als Text statt als Zahl", () => {
    expect(parseResultInput("1.2.3")).toEqual({ text_value: "1.2.3" });
  });
});

describe("canonicalResultKey", () => {
  it("behandelt NULL, undefined und leere Instanzschlüssel gleich", () => {
    const a = canonicalResultKey("BET", null);
    const b = canonicalResultKey("BET", undefined);
    const c = canonicalResultKey("BET", "");
    const d = canonicalResultKey("BET", "  ");
    expect(a).toBe(b);
    expect(a).toBe(c);
    expect(a).toBe(d);
  });

  it("unterscheidet verschiedene Instanzschlüssel", () => {
    expect(canonicalResultKey("BET", "m1")).not.toBe(canonicalResultKey("BET", "m2"));
  });
});

describe("buildReplaceResultsPayload", () => {
  it("normalisiert und akzeptiert einen gültigen Payload", () => {
    const p = buildReplaceResultsPayload({
      ...basePayload(),
      reason: "  Korrigierte Auswertung  ",
      results: [{ result_name: " BET ", value: 0, unit: " m²/g " }],
    });
    expect(p.reason).toBe("Korrigierte Auswertung");
    expect(p.results[0]).toMatchObject({ result_name: "BET", value: 0, unit: "m²/g" });
  });

  it("lehnt fehlende Begründung ab", () => {
    expect(() => buildReplaceResultsPayload({ ...basePayload(), reason: "  " })).toThrow(
      /Begründung/
    );
  });

  it("lehnt leere Ergebnisliste ab", () => {
    expect(() => buildReplaceResultsPayload({ ...basePayload(), results: [] })).toThrow(
      /Mindestens ein Ergebnis/
    );
  });

  it("lehnt Dubletten inkl. NULL/leer-Instanzschlüssel ab", () => {
    expect(() =>
      buildReplaceResultsPayload({
        ...basePayload(),
        results: [
          { result_name: "BET", instance_key: null, value: 1 },
          { result_name: "BET", instance_key: "", value: 2 },
        ],
      })
    ).toThrow(/Dublette/);
  });

  it("lehnt gleichzeitige Zahlen- und Textwerte ab", () => {
    expect(() =>
      buildReplaceResultsPayload({
        ...basePayload(),
        results: [{ result_name: "BET", value: 1, text_value: "n.b." }],
      })
    ).toThrow(/Widersprüchliche Eingabe/);
  });

  it("lehnt Einträge ohne Wert ab", () => {
    expect(() =>
      buildReplaceResultsPayload({
        ...basePayload(),
        results: [{ result_name: "BET" }],
      })
    ).toThrow(/Kein Wert angegeben/);
  });

  it("lehnt leere Textwerte ab", () => {
    expect(() =>
      buildReplaceResultsPayload({
        ...basePayload(),
        results: [{ result_name: "BET", text_value: "   " }],
      })
    ).toThrow(/darf nicht leer/);
  });

  it("lehnt nicht-endliche Zahlen ab", () => {
    expect(() =>
      buildReplaceResultsPayload({
        ...basePayload(),
        results: [{ result_name: "BET", value: Number.NaN }],
      })
    ).toThrow(/Ungültiger numerischer Wert/);
  });

  it("lehnt Rohdatenablösung ohne neuen Datensatz ab", () => {
    expect(() =>
      buildReplaceResultsPayload({
        ...basePayload(),
        replacesDatasetId: "ds-old",
      })
    ).toThrow(/neuen Rohdatensatzes/);
  });

  it("lehnt Selbstablösung eines Rohdatensatzes ab", () => {
    expect(() =>
      buildReplaceResultsPayload({
        ...basePayload(),
        newRawDatasetId: "ds-1",
        replacesDatasetId: "ds-1",
      })
    ).toThrow(/nicht selbst ablösen/);
  });
});

describe("buildChangedEntries", () => {
  const existingRow = {
    resultName: "BET",
    instanceKey: null,
    instanceLabel: null,
    displayLabel: "BET-Oberfläche",
    unit: "m²/g",
    currentValue: 15.2,
    currentText: null,
    isNew: false,
  };

  it("übernimmt unveränderte Zeilen nicht (keine Historie)", () => {
    const entries = buildChangedEntries([{ ...existingRow, input: "15,2" }]);
    expect(entries).toHaveLength(0);
  });

  it("erkennt numerische Änderung auf 0", () => {
    const entries = buildChangedEntries([{ ...existingRow, input: "0" }]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ result_name: "BET", value: 0 });
  });

  it("erkennt Typwechsel Zahl → Text", () => {
    const entries = buildChangedEntries([{ ...existingRow, input: "n.b." }]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ text_value: "n.b." });
    expect(entries[0].value).toBeUndefined();
  });

  it("erkennt Typwechsel Text → Zahl", () => {
    const entries = buildChangedEntries([
      { ...existingRow, currentValue: null, currentText: "< 0.1", input: "0,04" },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ value: 0.04 });
  });

  it("lässt geleerte bestehende Zeilen unangetastet", () => {
    const entries = buildChangedEntries([{ ...existingRow, input: "" }]);
    expect(entries).toHaveLength(0);
  });

  it("übernimmt neue Zeilen nur mit Name und Wert", () => {
    const entries = buildChangedEntries([
      { ...existingRow, input: "15,2" },
      {
        resultName: "Neuer Parameter",
        unit: "%",
        input: "3,5",
        currentValue: null,
        currentText: null,
        isNew: true,
      },
      {
        resultName: "Ohne Wert",
        unit: null,
        input: "",
        currentValue: null,
        currentText: null,
        isNew: true,
      },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ result_name: "Neuer Parameter", value: 3.5, unit: "%" });
  });
});
