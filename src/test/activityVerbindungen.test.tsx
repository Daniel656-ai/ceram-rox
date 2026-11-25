import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import ActivityMeasurementView from "@/components/results/ActivityMeasurementView";
import { extractActivity } from "@/lib/results/activityMeasurement";
import { activityExportRows } from "@/lib/orderExport/buildOrderExport";
import { compoundRef, isGasUnit } from "@/lib/results/activityCompounds";
import type { SampleResultValue } from "@/lib/results/sampleResultsAggregation";

vi.mock("@/components/CompletedResultForm", () => ({ default: () => null }));
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const FORM = "a8bdb319-e289-4f34-a55c-5b08c3071f36";
const res = (key: string, label: string, value: number | string | null, unit: string | null, official = true): SampleResultValue => ({
  id: crypto.randomUUID(), result_name: `form:${FORM}:${key}`, value: typeof value === "number" ? value : null, unit,
  temperature_range_from: null, temperature_range_to: null, temperature_unit: null,
  remarks: typeof value === "string" ? value : null, measured_at: null, display_label: label, is_official: official,
});
const SERVICE = { serviceName: "Aktivitätsmessung NOx" };

/** Struktur wie im NOx-Formular (DGA260003): eine Messbedingung, Felder mit "2" bleiben im Formular. */
const dga = () => [
  res("temperatur_1", "Temperatur 1", 200, "°C"), res("temperatur_2", "Temperatur 2", 300, "°C"),
  res("eta_nox", "η-NOx 1_{(200 °C)}", 27.5, "%"), res("eta_nox_kopie", "η-NOx 2_{(300 °C)}", 63.4, "%"),
  // Messbedingungen
  res("av_1", "AV 1", 41.4, "m/h"), res("fr_1", "FR 1", 1.3, "Nm^{3}/h"),
  res("no", "NO", 200, "ppm"), res("no_2", "NO (2)", 210, "ppm"),
  res("nh3_1", "NH_{3} 1", 240, "ppm"), res("h2o", "H_{2}O", 10, "%"), res("o2", "O_{2}", 7, "%"),
  res("co", "CO", 100, "ppm"), res("co_2", "CO (2)", 120, "ppm"),
  res("so2", "SO_{2}", 30, "ppm"), res("c2h4", "C_{2}H_{4}", 50, "ppm"), res("propan", "Propan", 20, "ppm"),
  res("co_leer", "CO2", null, "ppm"),
  // Dosiermengen sind keine Messbedingungen
  res("no_anlage", "NO_Anlage", 144, "Nml"), res("h2o_anlage", "H2O_Anlage", 1.9, "g"),
  // Gase je Temperaturstufe
  res("no_anzeige_in_1", "NO-Anzeige (In) 1", 201, "ppm"), res("no_anzeige_out_1", "NO-Anzeige (Out) 1", 167, "ppm"),
  res("c2h4_in_1", "C_{2}H_{4} In 1", 50, "ppm"), res("c2h4_out_1", "C_{2}H_{4} Out 1", 5, "ppm"),
  res("so2_in_2", "SO_{2} In 2", 30, "ppm"), res("so2_out_2", "SO_{2} Out 2", 28, "ppm"),
  res("propan_in_1", "Propan In 1", 20, "%"), res("propan_out_1", "Propan Out 1", 2, "%"),
];

describe("Verbindung aus der Beschriftung bestimmen", () => {
  it("entfernt Verwendungszusatz und Richtung, Formel bleibt", () => {
    expect(compoundRef("NO (2)", "no_2")).toEqual({ compound: "NO", dir: null, usage: 2 });
    expect(compoundRef("CO (2)", "co_2")).toEqual({ compound: "CO", dir: null, usage: 2 });
    expect(compoundRef("CO2", "co2")).toEqual({ compound: "CO2", dir: null, usage: null });
    expect(compoundRef("NH_{3} 1", "nh3_1")).toEqual({ compound: "NH3", dir: null, usage: 1 });
    expect(compoundRef("C_{2}H_{4} In 1", "c2h4_in_1")).toEqual({ compound: "C2H4", dir: "in", usage: 1 });
    expect(compoundRef("NO-Anzeige (Out) 2", "x")).toEqual({ compound: "NO", dir: "out", usage: 2 });
    expect(compoundRef("Propan", "propan")?.compound).toBe("C3H8");
    expect(compoundRef("H2O_Anlage", "h2o_anlage")?.compound).toBe("H2O");
  });
  it("Fallen: co_2 ist CO (nicht CO2), no_2 ist NO (nicht NO2) – auch ohne Beschriftung", () => {
    expect(compoundRef(null, "co_2")?.compound).toBe("CO");
    expect(compoundRef(null, "no_2")?.compound).toBe("NO");
    expect(compoundRef(null, "co2_in_1")).toEqual({ compound: "CO2", dir: "in", usage: null });
  });
  it("Nicht-Verbindungen und Einheiten", () => {
    expect(compoundRef("Temperatur 1", "temperatur_1")).toBeNull();
    expect(compoundRef("η-NOx 1_{(200 °C)}", "eta_nox")).toBeNull();
    expect(compoundRef("Test-Nr", "test_nr")).toBeNull();
    expect(isGasUnit("ppm")).toBe(true);
    expect(isGasUnit("%")).toBe(true);
    expect(isGasUnit("Nml")).toBe(false);
    expect(isGasUnit("g")).toBe(false);
  });
});

describe("Messbedingungen: alle Eingangsgase mit Werten (DGA260003)", () => {
  const { view, rest } = extractActivity(dga(), SERVICE);
  const c = view!.catalysts[0].conditions;

  it("bekannte bleiben, weitere Verbindungen als zusätzliche Spalten in Reihenfolge des Auftretens", () => {
    expect([c.no, c.nh3, c.h2o, c.o2]).toEqual([200, 240, 10, 7]);
    expect(c.extra.map((e) => [e.compound, e.value, e.unit])).toEqual([
      ["CO", 100, "ppm"], ["SO2", 30, "ppm"], ["C2H4", 50, "ppm"], ["C3H8", 20, "ppm"],
    ]);
  });

  it("mehrfach vorkommende Verbindung: erste Verwendung in der Tabelle, weitere unter „Weitere Angaben“ (nichts geht verloren)", () => {
    const other = view!.other.map((f) => f.label);
    expect(other).toContain("CO (2)");
    expect(other).toContain("NO (2)");
    expect(c.extra.some((e) => e.compound === "CO2")).toBe(false);
  });

  it("Dosiermengen (Nml, g) bleiben unter „Weitere Angaben“, leere Werte erzeugen keine Spalte", () => {
    expect(view!.other.map((f) => f.label)).toEqual(expect.arrayContaining(["NO_Anlage", "H2O_Anlage"]));
    expect(c.extra.map((e) => e.compound)).not.toContain("CO2");
    expect(rest.some((r) => r.display_label === "CO2")).toBe(true);
  });

  it("zugeordnete Felder tauchen nicht mehr unter „Weitere Angaben“ auf", () => {
    const other = view!.other.map((f) => f.label).join("|");
    for (const t of ["SO2", "SO₂", "C₂H₄", "Propan"]) expect(other).not.toContain(t);
  });
});

describe("Ergebnisse je Temperatur: alle Gase (In/Out) mit Werten", () => {
  const { view } = extractActivity(dga(), SERVICE);
  const cat = view!.catalysts[0];

  it("bekannte Gase vorn, neue dahinter; Einheit aus dem Formular", () => {
    expect(cat.gasColumns).toEqual(["NO", "C2H4", "C3H8", "SO2"]);
    expect(cat.gasUnits).toEqual({ C2H4: "ppm", SO2: "ppm", C3H8: "%" });
  });

  it("Werte je Stufe richtig zugeordnet (SO2 In/Out gehört zu Stufe 2)", () => {
    const [r1, r2] = cat.rows;
    expect(r1.gases.C2H4).toEqual({ in: 50, out: 5 });
    expect(r1.gases.C3H8).toEqual({ in: 20, out: 2 });
    expect(r1.gases.SO2).toBeUndefined();
    expect(r2.gases.SO2).toEqual({ in: 30, out: 28 });
  });
});

describe("Anzeige und Excel", () => {
  it("Ansicht zeigt zusätzliche Spalten in chemischer Schreibweise", () => {
    const { view } = extractActivity(dga(), SERVICE);
    render(<TooltipProvider><ActivityMeasurementView view={view!} /></TooltipProvider>);
    for (const t of ["CO in", "SO₂ in", "C₂H₄ in", "C₃H₈ in"]) expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    expect(screen.getByText("C₂H₄")).toBeTruthy();
    expect(screen.getByText("Rest")).toBeTruthy();
  });

  it("Excel zieht mit: Kopfzeile und Werte der zusätzlichen Spalten", () => {
    const { view } = extractActivity(dga(), SERVICE);
    const rows = activityExportRows(view!).map((r) => r.map((c) => c.v));
    const head = rows.find((r) => r.includes("Rest") === false && r.some((c) => c === "C₂H₄ in [ppm]") && r.some((c) => c === "AV [m/h]"))!;
    expect(head).toEqual(expect.arrayContaining(["CO in [ppm]", "SO₂ in [ppm]", "C₂H₄ in [ppm]", "C₃H₈ in [ppm]"]));
    const i = head.indexOf("C₂H₄ in [ppm]");
    const valueRow = rows[rows.indexOf(head) + 1];
    expect(valueRow[i]).toBe(50);
    const tempHead = rows.find((r) => r.includes("Temperatur [°C]"))!;
    expect(tempHead).toEqual(expect.arrayContaining(["C₂H₄ in [ppm]", "C₂H₄ out [ppm]", "C₃H₈ in [%]", "SO₂ out [ppm]"]));
  });
});

describe("Alte Aufträge sehen gleich aus", () => {
  it("nur bekannte Gase: keine zusätzlichen Spalten, keine Einheiten-Map, Bedingungen wie bisher", () => {
    const old = [
      res("temperatur_1", "Temperatur 1", 200, "°C"), res("eta_nox", "η-NOx 1_{(200 °C)}", 27.5, "%"),
      res("no_anzeige_in_1", "NO-Anzeige (In) 1", 201, "ppm"), res("no_anzeige_out_1", "NO-Anzeige (Out) 1", 167.5, "ppm"),
      res("no2_in_1", "NO_{2} In 1", 0.6, "ppm"), res("no2_out_1", "NO_{2} Out 1", 0, "ppm"),
      res("no_anlage", "NO_Anlage", 200, "Nml"), res("h2o_anlage", "H2O_Anlage", 1.93, "g"),
    ];
    const { view } = extractActivity(old, SERVICE);
    const cat = view!.catalysts[0];
    expect(cat.gasColumns).toEqual(["NO", "NO2"]);
    expect(cat.gasUnits).toBeUndefined();
    expect(cat.conditions.extra).toEqual([]);
    expect(view!.other.map((f) => f.label)).toEqual(["NO_Anlage", "H2O_Anlage"]);
  });
});

describe("SV (Raumgeschwindigkeit) in den Messbedingungen", () => {
  // DGA260004: SV 1 = 25 000 h⁻¹ (Feld sv_1, Einheit h^{-1})
  const base = () => [
    res("temperatur_1", "Temperatur 1", 200, "°C"), res("eta_nox", "η-NOx 1_{(200 °C)}", 27.5, "%"),
    res("av_1", "AV 1", 41.4, "m/h"), res("fr_1", "FR 1", 1.3, "Nm^{3}/h"), res("no", "NO", 200, "ppm"),
  ];

  it("erkennt SV aus Beschriftung + Einheit, Verwendungszusatz entfällt, nicht mehr unter „Weitere Angaben“", async () => {
    const { svUsage } = await import("@/lib/results/activityCompounds");
    expect(svUsage("SV 1", "h^{-1}")).toBe(1);
    expect(svUsage("SV", "1/h")).toBeNull();
    expect(svUsage("SV 2", "h⁻¹")).toBe(2);
    expect(svUsage("SV (FR_{1})", "1/h")).toBeUndefined(); // anderes Feld, bleibt wie bisher
    expect(svUsage("SV 1", "ppm")).toBeUndefined();
    const { view } = extractActivity([...base(), res("sv_1", "SV 1", 25000, "h^{-1}")], SERVICE);
    expect(view!.catalysts[0].conditions.sv).toBe(25000);
    expect(view!.other.map((f) => f.label)).not.toContain("SV 1");
  });

  it("Ansicht: Spalte „SV [h⁻¹]“ direkt nach AV, nur mit Wert", () => {
    const withSv = extractActivity([...base(), res("sv_1", "SV 1", 25000, "h^{-1}")], SERVICE).view!;
    const { container } = render(<TooltipProvider><ActivityMeasurementView view={withSv} /></TooltipProvider>);
    const heads = [...container.querySelectorAll("table")[0].querySelectorAll("th")].map((t) => t.textContent);
    expect(heads.slice(0, 3)).toEqual(["AV[m/h]", "SV[h⁻¹]", "FR[Nm³/h]"]);
    const without = extractActivity(base(), SERVICE).view!;
    expect(without.catalysts[0].conditions.sv).toBeNull();
  });

  it("zwei Verwendungen: erste in der Tabelle, weitere unter „Weitere Angaben“", () => {
    const { view } = extractActivity([...base(), res("sv_1", "SV 1", 25000, "h^{-1}"), res("sv_2", "SV 2", 30000, "h^{-1}")], SERVICE);
    expect(view!.catalysts[0].conditions.sv).toBe(25000);
    expect(view!.other.map((f) => f.label)).toContain("SV 2");
    expect(view!.other.map((f) => f.label)).not.toContain("SV 1");
  });

  it("Excel zieht mit: „SV [h⁻¹]“ nach AV, Wert in derselben Spalte", () => {
    const { view } = extractActivity([...base(), res("sv_1", "SV 1", 25000, "h^{-1}")], SERVICE);
    const rows = activityExportRows(view!).map((r) => r.map((c) => c.v));
    const head = rows.find((r) => r[0] === "AV [m/h]")!;
    expect(head.slice(0, 3)).toEqual(["AV [m/h]", "SV [h⁻¹]", "FR [Nm³/h]"]);
    expect(rows[rows.indexOf(head) + 1].slice(0, 3)).toEqual([41.4, 25000, 1.3]);
  });
});
