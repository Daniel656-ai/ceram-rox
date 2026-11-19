import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import ActivityMeasurementView from "@/components/results/ActivityMeasurementView";
import { extractActivity } from "@/lib/results/activityMeasurement";
import { activityExportRows } from "@/lib/orderExport/buildOrderExport";
import { formatResultLabel } from "@/lib/resultLabels";
import { toUnicode } from "@/lib/richText";
import type { SampleResultValue } from "@/lib/results/sampleResultsAggregation";
import { ACTIVITY_BLOCK_JSON } from "./fixtures/activityBlockP260305";

vi.mock("@/components/CompletedResultForm", () => ({ default: () => null }));
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const res = (over: Partial<SampleResultValue>): SampleResultValue => ({
  id: crypto.randomUUID(), result_name: "form:f:x", value: null, unit: null, temperature_range_from: null,
  temperature_range_to: null, temperature_unit: null, remarks: null, measured_at: null, display_label: null,
  is_official: false, ...over,
});
const fl = (key: string, label: string, value: number | string | null, unit: string | null = null, official = false) =>
  res({
    result_name: `form:f:${key}`, display_label: label, unit, is_official: official,
    value: typeof value === "number" ? value : null, remarks: typeof value === "string" ? value : null,
  });
const block = () => res({ result_name: "form:f:aktivitatsmessblock", display_label: "Aktivitätsmessblock", remarks: ACTIVITY_BLOCK_JSON });

/* Varianten nach den echten Feldnamen aus tasks/014-varianten.csv */

describe("Variante B: flach je Temperaturstufe (FG-260011)", () => {
  const results = [
    fl("eta_nox", "η-NOx 1_{(200 °C)}", 27.5, "%", true), fl("eta_nox_kopie", "η-NOx 2_{(280 °C)}", 63.4, "%", true), fl("eta_nox_kopie_kopie", "η-NOx 3_{(360 °C)}", 78.6, "%", true),
    fl("k_wert", "K-Wert 1_{(200 °C)}", 7.9, "Nm/h", true), fl("k_wert_kopie", "K-Wert 2_{(280 °C)}", 41.6, "Nm/h", true), fl("k_wert_kopie_kopie", "K-Wert 3_{(360 °C)}", 63.8, "Nm/h", true),
    fl("no_anzeige_in_1", "NO-Anzeige (In) 1", 201, "ppm", true), fl("no_anzeige_out_1", "NO-Anzeige (Out) 1", 167.5, "ppm", true),
    fl("no_anzeige_in_2", "NO-Anzeige (In) 2", 201.2, "ppm", true), fl("no_anzeige_out_2", "NO-Anzeige (Out) 2", 98.4, "ppm", true),
    fl("no2_in_1", "NO_{2} In 1", 0.6, "ppm", true), fl("no2_out_1", "NO_{2} Out 1", 0, "ppm", true),
    fl("n2o_in_3", "N_{2}O In 3", 0.3, "ppm", true), fl("n2o_out_3", "N_{2}O Out 3", 0.3, "ppm", true),
    // Dosiermengen (Nml/g/Nl) sind keine Messbedingungen
    fl("no_anlage", "NO_Anlage", 200, "Nml"), fl("h2o_anlage", "H2O_Anlage", 1.93, "g"), fl("o2_anlage", "O2_Anlage", 2160, "Nml"),
  ];
  const { view, rest } = extractActivity(results);

  it("eine Aktivitätsmessung mit drei Temperaturstufen; Temperaturen aus der Beschriftung", () => {
    expect(view).not.toBeNull();
    const rows = view!.catalysts[0].rows;
    expect(rows.map((r) => r.temperature)).toEqual([200, 280, 360]);
    expect(rows.map((r) => r.eta)).toEqual([27.5, 63.4, 78.6]);
    expect(rows.map((r) => r.k)).toEqual([7.9, 41.6, 63.8]);
    expect(rows[0].gases.NO).toEqual({ in: 201, out: 167.5 });
    expect(rows[2].gases.N2O).toEqual({ in: 0.3, out: 0.3 });
    expect(view!.official).toBe(true); // Status richtet sich nach den Ergebniswerten (alle offiziell)
  });

  it("Dosiermengen stehen unter Weitere Angaben, nicht in den Messbedingungen", () => {
    expect(view!.catalysts[0].conditions).toEqual({ av: null, fr: null, no: null, nh3: null, h2o: null, o2: null });
    expect(view!.other.map((f) => f.label)).toEqual(["NO_Anlage", "H2O_Anlage", "O2_Anlage"]);
    expect(rest).toEqual([]);
  });
});

describe("Variante C: alt flach (DAB260006)", () => {
  const results = [
    fl("temperatur_1", "Temperatur 1", 350, "°C"), fl("temperatur_5", "Temperatur 5", 450, "°C"),
    fl("no", "NO", 200, "ppm"), fl("no_2", "NO (2)", 200, "ppm"), fl("nh3_1", "NH_{3} 1", 240, "ppm"), fl("nh3_2", "NH_{3} 2", 25, "ppm"),
    fl("co", "CO", 300, "ppm"), fl("h2o", "H_{2}O", 10, "%"), fl("o2", "O_{2}", 100, "%"),
    fl("av_1", "AV 1", 41.38, "m/h"), fl("sv_1", "SV 1", 76051, "h^{-1}"), fl("testbedingungen", "Testbedingungen", "Standardbedingungen"),
  ];
  const { view } = extractActivity(results);

  it("wird als Aktivitätsmessung erkannt, Temperaturen als Zeilen", () => {
    expect(view).not.toBeNull();
    expect(view!.catalysts[0].rows.map((r) => r.temperature)).toEqual([350, 450]);
  });

  it("Bedingungen von Test 1 im Katalysator 1; Test 2 und der Rest unter Weitere Angaben", () => {
    expect(view!.catalysts).toHaveLength(1);
    expect(view!.catalysts[0].conditions).toMatchObject({ av: 41.38, no: 200, nh3: 240, h2o: 10, o2: 100 });
    const labels = view!.other.map((f) => f.label);
    expect(labels).toEqual(expect.arrayContaining(["NO (2)", "NH₃ 2", "CO", "SV 1", "Testbedingungen"]));
    expect(view!.other.find((f) => f.label === "SV 1")?.unit).toBe("h⁻¹");
  });

  it("nur Bedingungen ohne Temperaturstufen/Ergebnisse: keine Aktivitätsansicht", () => {
    expect(extractActivity([fl("no", "NO", 200, "ppm"), fl("h2o", "H_{2}O", 10, "%")]).view).toBeNull();
  });
});

describe("Probendaten (AH-260001) im Katalysatorkopf", () => {
  const results = [
    fl("test_nr", "Test-Nr", "Ur 4170"), fl("d_Kanalgroesse", "d (Kanalgröße)", 6.48, "mm"), fl("ti_innenwnadstaerke", "ti (Innenwandstärke)", 0.8, "mm"),
    fl("l", "l (AV_{1})", 76.7, "mm"), fl("l_kopie", "l (AV_{2})", 99.4, "mm"),
    fl("anzahl_der_kanale_av1", "Anzahl der Kanäle (AV1)", 9), fl("zellenzahl_av1", "Zellenzahl_{ AV1}", 81),
    fl("ap", "AP", 1502.2, "m^{2}/m^{3}"),
    block(),
  ];
  const { view, rest } = extractActivity(results);

  it("Test-Nr, Kanalgröße, Wandstärke, Länge, Kanäle, Zellenzahl; Länge je Katalysator", () => {
    const c1 = view!.catalysts[0].sampleData.map((f) => [f.label, f.value, f.unit]);
    expect(c1).toEqual([["Test-Nr", "Ur 4170", null], ["Kanalgröße d", 6.48, "mm"], ["Wandstärke ti", 0.8, "mm"], ["Länge l", 76.7, "mm"], ["Anzahl Kanäle", 9, null], ["Zellenzahl", 81, null]]);
    const c2 = view!.catalysts[1].sampleData.map((f) => [f.label, f.value]);
    expect(c2).toEqual([["Test-Nr", "Ur 4170"], ["Kanalgröße d", 6.48], ["Wandstärke ti", 0.8], ["Länge l", 99.4]]);
  });

  it("nicht Zugeordnetes (AP) steht unter Weitere Angaben; keine Resttabelle", () => {
    expect(view!.other).toEqual([{ label: "AP", value: 1502.2, unit: "m²/m³" }]);
    expect(rest).toEqual([]);
  });

  it("Darstellung: Probendaten und Weitere Angaben", () => {
    render(<TooltipProvider><ActivityMeasurementView view={view!} /></TooltipProvider>);
    expect(screen.getAllByText("Probendaten")).toHaveLength(2);
    expect(screen.getByText("Weitere Angaben")).toBeTruthy();
    expect(screen.getAllByText("Test-Nr")).toHaveLength(2);
  });

  it("Excel: Probendaten, Messbedingungen, Temperaturtabelle, Weitere Angaben", () => {
    const rows = activityExportRows(view!).map((r) => r.map((c) => c.v));
    const flat = rows.flat();
    expect(flat).toContain("Probendaten");
    expect(flat).toContain("Test-Nr");
    expect(flat).toContain("Länge l [mm]");
    expect(flat).toContain("Messbedingungen");
    expect(flat).toContain("Ergebnisse je Temperatur");
    expect(flat).toContain("Weitere Angaben");
    expect(rows.find((r) => r[0] === "AP")).toEqual(["AP", 1502.2, "m²/m³"]);
  });
});

describe("Block: nicht zugeordnete Block-Felder gehen nicht verloren", () => {
  it("co_3, Bemerkungen u. ä. stehen unter Weitere Angaben, Umrechnungsfaktoren nicht", () => {
    const json = JSON.stringify([{
      __instance_id: "a", __label: "", __context: {},
      gas_einstellungen: [{ no_anlage: 200, kat_nr: "X/1", no_umrechnung: 144, fr_trocken_umrechnung: 21600 }],
      temperatur_11: [{ temperatur_1: 300, eta_nox: 50, k_wert_kopie: 20, co_3: 7, so2: 0, bemerkungen_1: "ohne SO2" }],
    }]);
    const { view } = extractActivity([res({ result_name: "form:f:aktivitatsmessblock", remarks: json })]);
    const labels = view!.other.map((f) => f.label);
    expect(labels.some((l) => /Co 3 \(300 °C\)/.test(l))).toBe(true);
    expect(labels.some((l) => /Bemerkungen 1/.test(l))).toBe(true);
    expect(labels.some((l) => /umrechnung/i.test(l))).toBe(false);
  });
});

describe("Beschriftungsfehler", () => {
  it("NH_{3} 1 -> NH₃ 1, NO (2) -> NO (2), l (AV_{1}) -> l (AV₁)", () => {
    expect(formatResultLabel("NH_{3} 1", null)).toBe("NH₃ 1");
    expect(formatResultLabel("NO (2)", null)).toBe("NO (2)");
    expect(toUnicode(formatResultLabel("l (AV_{1})", null))).toBe("l (AV₁)"); // Auszeichnung bleibt für RichText erhalten
    expect(formatResultLabel("NO", "ppm")).toBe("NO [ppm]");
    expect(formatResultLabel("SiO2", "%")).toBe("SiO₂ [%]");
  });
});

describe("Absicherungen nach Review", () => {
  it("formatElementLabel: Formeln mit Leerzeichen und Zahl behalten ihr bisheriges Verhalten", async () => {
    const { formatElementLabel } = await import("@/lib/elementKeys");
    expect(formatElementLabel("SiO 2")).toBe("SiO₂");
    expect(formatElementLabel("NO 2")).toBe("NO₂");
    expect(formatElementLabel("CO 2")).toBe("CO₂");
    expect(formatElementLabel("TiO 2")).toBe("TiO₂");
    expect(formatElementLabel("Fe 2")).toBe("Fe₂");
    expect(formatElementLabel("SiO2 (2)")).toBe("SiO₂ (2)");
    expect(formatElementLabel("Fe2O3 (1)")).toBe("Fe₂O₃ (1)");
    expect(formatElementLabel("NO (2)")).toBe("NO (2)");
    expect(formatElementLabel("NH_{3} 1")).toBe("NH₃ 1");
  });

  it("kollidierende Felder (no_in_1 und no_anzeige_in_1) gehen nicht verloren", () => {
    const { view } = extractActivity([
      fl("temperatur_1", "Temperatur 1", 300, "°C"),
      fl("no_in_1", "NO In 1", 100, "ppm"), fl("no_anzeige_in_1", "NO-Anzeige (In) 1", 120, "ppm"),
      fl("no_anzeige_out_1", "NO-Anzeige (Out) 1", 50, "ppm"),
    ]);
    expect(view!.catalysts[0].rows[0].gases.NO).toEqual({ in: 100, out: 50 });
    expect(view!.other).toEqual([{ label: "NO-Anzeige (In) 1", value: 120, unit: "ppm" }]);
  });

  it("einzelne Felder allein (ohne Temperaturstufe mit Ergebnis) sind keine Aktivitätsmessung", () => {
    expect(extractActivity([fl("k_wert", "K-Wert", 5, "Nm/h")]).view).toBeNull();
    expect(extractActivity([fl("eta_nox", "η NOx", 50, "%"), fl("no_in_1", "NO In 1", 1)]).view).toBeNull();
    expect(extractActivity([fl("gaszusammensetzung_co2", "Gaszusammensetzung CO_{2}", 8, "%"), fl("beta", "β", 0.45)]).view).toBeNull();
  });
});

describe("Vorgabe: Messart Aktivitätsmessung wird IMMER in unserer Ansicht dargestellt", () => {
  const wrap = (ui: React.ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);

  it("passt nur die Messart (keine Temperaturstufen): trotzdem unsere Ansicht mit Hinweisen", () => {
    const results = [fl("av_1", "AV 1", 41.38, "m/h"), fl("ap", "AP", 1502.2, "m^{2}/m^{3}"), fl("test_nr", "Test-Nr", "Ur 1")];
    expect(extractActivity(results).view).toBeNull(); // Struktur allein reicht nicht
    const { view } = extractActivity(results, { serviceName: "Aktivitätsmessung" });
    expect(view).not.toBeNull();
    expect(view!.catalysts[0].rows).toEqual([]);
    expect(view!.catalysts[0].conditions.av).toBe(41.38);
    expect(view!.other.map((f) => f.label)).toEqual(["AP"]);
    wrap(<ActivityMeasurementView view={view!} sample={{ number: "P1", name: "FG1" }} />);
    expect(screen.getByText("keine Ergebnisse je Temperatur erfasst")).toBeTruthy();
    expect(screen.getByText("Weitere Angaben")).toBeTruthy();
  });

  it("Messart ohne jeden Wert: keine Ansicht (kurze Zeile „keine Messwerte erfasst“ wie bisher)", () => {
    expect(extractActivity([fl("av_1", "AV 1", null)], { serviceName: "Aktivitätsmessung" }).view).toBeNull();
  });

  it("andere Messarten sind nicht betroffen", () => {
    expect(extractActivity([fl("av_1", "AV 1", 41.38, "m/h")], { serviceName: "Dilatometrie" }).view).toBeNull();
  });

  it("Fehlende Messbedingungen: Hinweis statt Tabelle voller Striche", () => {
    const { view } = extractActivity(
      [fl("temperatur_1", "Temperatur 1", 300, "°C"), fl("eta_nox", "η NOx", 50, "%")],
      { serviceName: "Aktivitätsmessung" },
    );
    wrap(<ActivityMeasurementView view={view!} />);
    expect(screen.getByText("keine Messbedingungen erfasst")).toBeTruthy();
  });
});

describe("Vorgabe: Kopf – Probe, Katalysator nur bei echter Katalysatornummer", () => {
  const wrap = (ui: React.ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);
  const view = () => extractActivity([block()]).view!;

  it("Probe mit Bezeichnung groß und Nummer klein; Katalysator FG26_0330/1 und /2", () => {
    wrap(<ActivityMeasurementView view={view()} sample={{ number: "P260305", name: "FG26_0330" }} />);
    expect(screen.getByText("FG26_0330")).toBeTruthy();
    expect(screen.getByText("P260305")).toBeTruthy();
    expect(screen.getByText("FG26_0330/1")).toBeTruthy();
    expect(screen.getByText("FG26_0330/2")).toBeTruthy();
  });

  it("Katalysatorbezeichnung gleich Probenbezeichnung: Zeile entfällt", () => {
    const { view: v } = extractActivity([res({ result_name: "form:f:aktivitatsmessblock", remarks: JSON.stringify([{
      gas_einstellungen: [{ no_anlage: 200, kat_nr: "FG26_0330" }],
      temperatur_11: [{ temperatur_1: 300, eta_nox: 50, no_anzeige_in_1: 200, no_anzeige_out_1: 100 }],
    }]) })]);
    wrap(<ActivityMeasurementView view={v!} sample={{ number: "P1", name: "FG26_0330" }} />);
    expect(screen.queryByText(/Katalysator/)).toBeNull();
  });

  it("flache Variante ohne kat_nr: keine Katalysator-Zeile", () => {
    const { view: v } = extractActivity([fl("temperatur_1", "Temperatur 1", 300), fl("eta_nox", "η NOx", 50, "%")]);
    wrap(<ActivityMeasurementView view={v!} sample={{ number: "P1", name: "X" }} />);
    expect(screen.queryByText(/Katalysator/)).toBeNull();
  });

  it("Excel: Titel nur mit echter Katalysatornummer; Hinweise bei fehlenden Bereichen", () => {
    const rows = activityExportRows(view(), { number: "P260305", name: "FG26_0330" }).map((r) => r.map((c) => c.v));
    expect(rows[0][0]).toBe("Aktivitätsmessung · Katalysator FG26_0330/1");
    const empty = extractActivity([fl("av_1", "AV 1", 41.38, "m/h")], { serviceName: "Aktivitätsmessung" }).view!;
    const r2 = activityExportRows(empty).map((r) => r.map((c) => c.v)).flat();
    expect(r2).toContain("keine Ergebnisse je Temperatur erfasst");
    expect(r2).toContain("Aktivitätsmessung");
  });
});
