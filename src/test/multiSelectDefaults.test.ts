import { describe, it, expect } from "vitest";
import {
  parseMultiSelectDefault,
  serializeMultiSelectDefault,
  multiSelectInitialValue,
} from "@/lib/multiSelectDefaults";

const UNTERSUCHUNGEN = ["ph_messung", "pm_ziegel", "pm_extruder", "feuchte", "staucher"];

describe("Mehrfach-Vorauswahl", () => {
  it("speichert und liest die Vorauswahl über default_value", () => {
    const raw = serializeMultiSelectDefault(UNTERSUCHUNGEN);
    expect(raw).toBe(JSON.stringify(UNTERSUCHUNGEN));
    expect(parseMultiSelectDefault(raw)).toEqual(UNTERSUCHUNGEN);
  });

  it("entfernt Duplikate und leere Werte, leer = kein Standard", () => {
    expect(serializeMultiSelectDefault(["a", "a", " ", "b"])).toBe(JSON.stringify(["a", "b"]));
    expect(serializeMultiSelectDefault([])).toBeNull();
  });

  it("bleibt rückwärtskompatibel zu Einzel- und Komma-Standardwerten", () => {
    expect(parseMultiSelectDefault("feuchte")).toEqual(["feuchte"]);
    expect(parseMultiSelectDefault("feuchte, staucher")).toEqual(["feuchte", "staucher"]);
    expect(parseMultiSelectDefault(null)).toEqual([]);
  });

  it("übernimmt die Vorauswahl nur beim erstmaligen Öffnen", () => {
    const def = serializeMultiSelectDefault(UNTERSUCHUNGEN);
    expect(multiSelectInitialValue(undefined, def, UNTERSUCHUNGEN)).toEqual({
      apply: true,
      value: UNTERSUCHUNGEN,
    });
  });

  it("überschreibt eine gespeicherte Auswahl nicht", () => {
    const def = serializeMultiSelectDefault(UNTERSUCHUNGEN);
    const gespeichert = ["ph_messung", "pm_extruder", "feuchte", "staucher"];
    expect(multiSelectInitialValue(gespeichert, def, UNTERSUCHUNGEN).apply).toBe(false);
    // Auch eine bewusst geleerte Auswahl bleibt leer.
    expect(multiSelectInitialValue([], def, UNTERSUCHUNGEN).apply).toBe(false);
  });

  it("ignoriert Vorauswahlwerte, die es in den Stammdaten nicht mehr gibt", () => {
    const def = serializeMultiSelectDefault(["feuchte", "geloescht"]);
    expect(multiSelectInitialValue(undefined, def, UNTERSUCHUNGEN)).toEqual({
      apply: true,
      value: ["feuchte"],
    });
  });

  it("ohne Vorauswahl passiert nichts", () => {
    expect(multiSelectInitialValue(undefined, null, UNTERSUCHUNGEN).apply).toBe(false);
  });
});
