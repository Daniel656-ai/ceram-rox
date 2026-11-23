import { describe, it, expect } from "vitest";
import { buildServiceSchemas, exportCell, flattenSchemas } from "@/lib/resultSchema";
import {
  ALL_SERVICES,
  buildServiceOptions,
  columnsForService,
  nonEmptyColumns,
  recordsForService,
  resolveMatrixService,
} from "@/lib/resultsMatrix";
import type { ResultRecord } from "@/hooks/useResultsDatabase";

const out = (label: string, value: number | null, unit: string | null = null) => ({
  result_name: `form:f:${label}`, display_label: label, value, unit, remarks: null, is_official: true,
  temperature_range_from: null, temperature_range_to: null, temperature_unit: null, id: label + value,
  instance_key: null, instance_label: null, instance_context: null,
});
const rec = (serviceId: string, serviceName: string, results: ReturnType<typeof out>[]): ResultRecord =>
  ({ measurementId: crypto.randomUUID(), serviceId, serviceName, outputResults: results }) as unknown as ResultRecord;

// Reihenfolge der Messarten im Schema ist alphabetisch: Aktivität, BET, RFA
const records = [
  rec("s-akt", "Aktivität", [out("Aktivität", 1, "Bq")]),
  rec("s-bet", "BET", [out("Spezifische Oberfläche - BET", 12.3, "m²/g")]),
  rec("s-bet", "BET", [out("Spezifische Oberfläche - BET", 11.8, "m²/g"), out("Porenvolumen", 0, "cm³/g")]),
  rec("s-rfa", "RFA", [out("SiO2", 5, "%"), out("Al2O3", 1, "%"), out("Fe2O3", 0.3, "%"), out("TiO2", 0.5, "%")]),
];
const schemas = buildServiceSchemas(records, []);

describe("Ergebnismatrix: Messart und leere Spalten", () => {
  it("Optionen: Messart mit den meisten Ergebnissen zuerst", () => {
    const opts = buildServiceOptions(schemas, records);
    expect(opts.map((o) => o.name)).toEqual(["RFA", "BET", "Aktivität"]);
    expect(opts[0].resultCount).toBe(4);
  });

  it("Auswahl: gemerkte Messart, sonst die mit den meisten Ergebnissen, „Alle“ nur wenn gemerkt", () => {
    const opts = buildServiceOptions(schemas, records);
    expect(resolveMatrixService(null, opts)).toBe("s-rfa");
    expect(resolveMatrixService("s-bet", opts)).toBe("s-bet");
    expect(resolveMatrixService("gibt-es-nicht", opts)).toBe("s-rfa");
    expect(resolveMatrixService(ALL_SERVICES, opts)).toBe(ALL_SERVICES);
    expect(resolveMatrixService(null, [])).toBe(ALL_SERVICES);
  });

  it("Spalten und Zeilen einer Messart: nur deren Parameter, BET-Parameter stehen links", () => {
    const cols = columnsForService(schemas, "s-bet");
    expect(cols.map((c) => c.label)).toEqual(["Spezifische Oberfläche - BET", "Porenvolumen"]);
    expect(recordsForService(records, "s-bet")).toHaveLength(2);
    expect(columnsForService(schemas, ALL_SERVICES)).toEqual(flattenSchemas(schemas));
    expect(recordsForService(records, ALL_SERVICES)).toHaveLength(4);
  });

  it("leere Spalten werden entfernt, ein gemessener Wert 0 zählt als Wert", () => {
    const cols = columnsForService(schemas, ALL_SERVICES);
    const onlyBetRows = recordsForService(records, "s-bet");
    const shown = nonEmptyColumns(cols, onlyBetRows).map((c) => c.label);
    expect(shown).toEqual(["Spezifische Oberfläche - BET", "Porenvolumen"]);
    // eine Zeile ohne Porenvolumen-Wert: Spalte entfällt
    const first = nonEmptyColumns(cols, [onlyBetRows[0]]).map((c) => c.label);
    expect(first).toEqual(["Spezifische Oberfläche - BET"]);
    expect(nonEmptyColumns(cols, [])).toEqual([]);
  });

  it("Export bleibt unberührt: gemeinsame Spaltenliste und Zellwerte sind unverändert", () => {
    const all = flattenSchemas(schemas);
    expect(all.map((c) => c.label)).toEqual([
      "Aktivität", "Spezifische Oberfläche - BET", "Porenvolumen", "SiO2", "Al2O3", "Fe2O3", "TiO2",
    ].filter((l) => all.some((c) => c.label === l)));
    expect(exportCell(records[2], all.find((c) => c.label === "Porenvolumen")!.key)).toBe(0);
  });
});

describe("Messart-Auswahl folgt den Filtern", () => {
  const only = (key: string) => recordsForService(records, key);

  it("Zahlen berücksichtigen die Filter, die Reihenfolge bleibt stabil", () => {
    const all = buildServiceOptions(schemas, records, records);
    const filtered = buildServiceOptions(schemas, records, only("s-bet"));
    expect(filtered.map((o) => o.key)).toEqual(all.map((o) => o.key));
    const bet = filtered.find((o) => o.key === "s-bet")!;
    const rfa = filtered.find((o) => o.key === "s-rfa")!;
    expect(bet.resultCount).toBe(3);
    expect(rfa.resultCount).toBe(0);
    expect(rfa.totalCount).toBe(4);
  });

  it("gemerkte Messart ohne Ergebnisse unter den Filtern: Auswahl springt auf eine mit Ergebnissen (keine leere Tabelle)", () => {
    const opts = buildServiceOptions(schemas, records, only("s-bet"));
    expect(resolveMatrixService("s-rfa", opts)).toBe("s-bet");
    // Filter weg: die gemerkte Messart gilt wieder
    const back = buildServiceOptions(schemas, records, records);
    expect(resolveMatrixService("s-rfa", back)).toBe("s-rfa");
  });

  it("ohne Standardwahl: Messart mit den meisten Ergebnissen unter den Filtern", () => {
    const opts = buildServiceOptions(schemas, records, only("s-akt"));
    expect(resolveMatrixService(null, opts)).toBe("s-akt");
  });

  it("sind alle Messarten leer, bleibt die gemerkte stehen; „Alle“ bleibt immer gültig", () => {
    const none = buildServiceOptions(schemas, records, []);
    expect(resolveMatrixService("s-bet", none)).toBe("s-bet");
    expect(resolveMatrixService(ALL_SERVICES, none)).toBe(ALL_SERVICES);
  });
});
