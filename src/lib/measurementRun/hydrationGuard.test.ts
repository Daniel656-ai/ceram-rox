import { describe, it, expect } from "vitest";
import {
  extractInitialValues,
  resolveServerSync,
  valuesEqual,
} from "./hydrationGuard";

describe("extractInitialValues", () => {
  it("übernimmt Zahlen als Zeichenkette und JSON-remarks geparst", () => {
    const m = {
      measurement_results: [
        { result_name: "a", value: 5, remarks: null },
        { result_name: "b", value: null, remarks: '[{"t":1}]' },
        { result_name: "c", value: null, remarks: "freitext" },
        { result_name: null, value: 1, remarks: null },
      ],
    };
    expect(extractInitialValues(m)).toEqual({
      a: "5",
      b: [{ t: 1 }],
      c: "freitext",
    });
  });

  it("liefert leere Werte ohne Ergebnisse", () => {
    expect(extractInitialValues({})).toEqual({});
    expect(extractInitialValues(null)).toEqual({});
  });
});

describe("valuesEqual", () => {
  it("ist unabhängig von der Schlüsselreihenfolge", () => {
    expect(valuesEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it("behandelt Zahl und Zahlenstring als gleich (Hydration-Normalisierung)", () => {
    expect(valuesEqual({ a: 5 }, { a: "5" })).toBe(true);
  });

  it("erkennt echte inhaltliche Unterschiede", () => {
    expect(valuesEqual({ a: 5 }, { a: 6 })).toBe(false);
    expect(valuesEqual({ a: [1, 2] }, { a: [1, 2, 3] })).toBe(false);
    expect(valuesEqual({ a: { x: 1 } }, { a: { x: 2 } })).toBe(false);
  });
});

describe("resolveServerSync", () => {
  const base = {
    currentValues: { a: "1" },
    lastServerValues: { a: "1" },
    serverValues: { a: "1" },
  };

  it("hydriert vor der Initialisierung immer aus dem Serverstand", () => {
    expect(
      resolveServerSync({ ...base, initialized: false, dirty: true }).action,
    ).toBe("hydrate");
  });

  it("tut nichts, wenn der Serverstand unverändert ist", () => {
    expect(
      resolveServerSync({ ...base, initialized: true, dirty: false }).action,
    ).toBe("none");
    expect(
      resolveServerSync({ ...base, initialized: true, dirty: true }).action,
    ).toBe("none");
  });

  it("tut nichts, wenn der neue Serverstand inhaltlich den Anzeigewerten entspricht (eigener Save)", () => {
    expect(
      resolveServerSync({
        initialized: true,
        dirty: false,
        currentValues: { a: 2 },
        lastServerValues: { a: "1" },
        serverValues: { a: "2" },
      }).action,
    ).toBe("none");
  });

  it("übernimmt echte Serveränderungen ohne lokale Eingaben", () => {
    expect(
      resolveServerSync({
        initialized: true,
        dirty: false,
        currentValues: { a: "1" },
        lastServerValues: { a: "1" },
        serverValues: { a: "9" },
      }).action,
    ).toBe("adopt");
  });

  it("meldet Konflikt statt zu überschreiben, wenn lokale Eingaben offen sind", () => {
    expect(
      resolveServerSync({
        initialized: true,
        dirty: true,
        currentValues: { a: "1", b: "lokal" },
        lastServerValues: { a: "1" },
        serverValues: { a: "9" },
      }).action,
    ).toBe("conflict");
  });

  it("lokale Eingaben haben Vorrang, auch wenn der Serverstand leer ist", () => {
    expect(
      resolveServerSync({
        initialized: true,
        dirty: true,
        currentValues: { a: "lokal" },
        lastServerValues: { a: "1" },
        serverValues: {},
      }).action,
    ).toBe("conflict");
  });
});
