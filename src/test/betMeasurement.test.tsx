import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import BetResultsTable from "@/components/results/BetResultsTable";
import OrderComparisonView from "@/components/results/OrderComparisonView";
import { SampleMeasurementResultsTable } from "@/components/results/SampleResultsView";
import { betValue, displayResults, isBetResult, isBetService } from "@/lib/results/betMeasurement";
import { buildOrderComparison, type OrderGroup } from "@/lib/results/orderGroups";
import { groupRecordsBySample, type SampleMeasurementRecord, type SampleResultValue } from "@/lib/results/sampleResultsAggregation";
import { summarizeServices } from "@/lib/results/serviceSummary";
import { buildOrderExport } from "@/lib/orderExport/buildOrderExport";

vi.mock("@/components/CompletedResultForm", () => ({ default: () => null }));
vi.mock("@/components/results/RequesterConditionsPanel", () => ({ default: () => null }));
vi.mock("@/components/results/CorrectionHistoryDialog", () => ({ default: () => null }));
vi.mock("@/components/results/ResultCorrectionDialog", () => ({ default: () => null }));
vi.mock("@/hooks/useResultCorrections", () => ({ useCanCorrectResults: () => false }));
vi.mock("@/components/order/OrderExcelExportButton", () => ({ default: () => null }));
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

/* Echte Feldnamen aus dem Export tasks016-bet-varianten.csv (inzwischen gelöscht; Formular BET (v1)) */
const res = (key: string, label: string, value: number | string | null, unit: string | null, official: boolean, remarks: string | null = null): SampleResultValue => ({
  id: key, result_name: `form:f:${key}`, display_label: label, value: typeof value === "number" ? value : null,
  remarks: typeof value === "string" ? value : remarks, unit, is_official: official,
  temperature_range_from: null, temperature_range_to: null, temperature_unit: null, measured_at: null,
});
const importInfo = res("messdatenimport", "Messdatenimport", null, null, false, JSON.stringify({
  imported_at: "2026-11-16T12:38:50Z", profile: "Gasadsorption", count: 1, keys: ["spezifische_oberflache_bet"],
  units: { spezifische_oberflache_bet: "m²/g" },
}));
const betResults = (official = true): SampleResultValue[] => [
  res("ges_gewicht_brutto", "Ges. Gewicht -Brutto", 60.6222, "g", false),
  res("leergewicht_tara", "Leergewicht - TARA", 30.9049, "g", false),
  res("probengewicht_netto", "Probengewicht - Netto", 30.4309, "g", false),
  res("rohr_nr", "Rohr Nr.:", 9, null, false),
  res("smp_nummer", "SMP-Nummer", "0000-9348", null, false),
  res("spezifische_oberflache_bet", "Spezifische Oberfläche - BET [m²/g]", 98.7008, "m²/g", official),
  importInfo,
];
const meas = (results: SampleResultValue[], serviceName = "BET", id = "m1"): SampleMeasurementRecord =>
  ({ measurementId: id, measurementNumber: "M1", serviceName, sampleNumber: "P1", sampleName: "0000-9348", orderNumber: "BR-260001", results }) as unknown as SampleMeasurementRecord;

describe("BET: Erkennung über Messart + Feldzuordnung", () => {
  it("Messart", () => {
    expect(isBetService("BET")).toBe(true);
    expect(isBetService("Spezifische Oberfläche (BET)")).toBe(true);
    expect(isBetService("Dilatometrie")).toBe(false);
    expect(isBetService("Betonprüfung")).toBe(false);
  });
  it("Feld: Schlüssel, Beschriftung oder bet-Feld mit m²/g; Hilfswerte und Importinfo nicht", () => {
    const r = betResults();
    expect(r.filter(isBetResult).map((x) => x.id)).toEqual(["spezifische_oberflache_bet"]);
    // anderer Formularschlüssel, gleiche Beschriftung
    expect(isBetResult(res("x1", "Spezifische Oberfläche BET", 5, "m²/g", false))).toBe(true);
    // anderer Schlüssel und andere Beschriftung, aber bet-Feld mit m²/g
    expect(isBetResult(res("bet_wert", "Messwert", 5, "m^{2}/g", false))).toBe(true);
    expect(isBetResult(res("tara", "Leergewicht - TARA", 30, "g", false))).toBe(false);
  });
  it("displayResults: nur der BET-Wert; andere Messarten und Messungen ohne BET-Feld bleiben unverändert", () => {
    const r = betResults();
    expect(displayResults("BET", r)).toHaveLength(1);
    expect(displayResults("Dilatometrie", r)).toHaveLength(r.length);
    const ohne = [res("tara", "Leergewicht - TARA", 30, "g", false)];
    expect(displayResults("BET", ohne)).toEqual(ohne); // nichts geht verloren
  });
  it("betValue", () => {
    expect(betValue(res("a", "a", 98.7, "m²/g", true))).toBe(98.7);
    expect(betValue(res("a", "a", null, "m²/g", true))).toBeNull();
    expect(betValue(res("a", "a", "12,5", "m²/g", true))).toBe(12.5);
  });
});

describe("BET: Darstellung", () => {
  const wrap = (ui: React.ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);

  it("Tabelle Probe | BET [m²/g]; vorläufig grau, offiziell normal", () => {
    wrap(<BetResultsTable rows={[
      { key: "a", sample: { number: "P1", name: "FG1" }, value: 98.7008, official: true },
      { key: "b", sample: { number: "P2", name: "FG2" }, value: 55.5, official: false },
    ]} />);
    expect(screen.getByText("Probe")).toBeTruthy();
    expect(screen.getByText("BET [m²/g]")).toBeTruthy();
    expect(screen.getByText("98,7008").className).not.toContain("text-muted-foreground");
    expect(screen.getByText("55,5").className).toContain("text-muted-foreground");
  });

  it("Probendetail: nur der BET-Wert, keine Hilfswerte, keine Importinfo", () => {
    wrap(<SampleMeasurementResultsTable measurement={meas(betResults(false))} />);
    expect(screen.getByTestId("bet-results")).toBeTruthy();
    expect(screen.getByText("98,7008").className).toContain("text-muted-foreground");
    for (const t of [/Tara/i, /Brutto/i, /Probengewicht/i, /Rohr/i, /SMP/i, /Importinfo/i, /Messdatenimport/i]) {
      expect(screen.queryByText(t)).toBeNull();
    }
  });

  it("Auftragsansicht: je Probe eine Zeile, keine Hilfswerte-Spalten", () => {
    const s = (k: string, num: string, value: number): any => ({
      sampleKey: k, sampleNumber: num, sampleName: `Name ${k}`, projectNames: [], orderDisplayNumbers: ["BR-1"], orderIds: ["o"],
      measurements: [meas(betResults().map((r) => (r.id === "spezifische_oberflache_bet" ? { ...r, value } : r)), "BET", `m-${k}`)],
      officialCount: 1, interimCount: 0, lastActivityAt: null,
    });
    const order = { orderKey: "o", orderId: "o", displayNumber: "BR-1", projectNames: [], samples: [s("a", "P1", 98.7), s("b", "P2", 60.1)], measurementCount: 2, officialCount: 2, interimCount: 0, lastActivityAt: null } as unknown as OrderGroup;
    // Spalten der Vergleichstabelle: nur BET
    const cols = buildOrderComparison(order).flatMap((x) => x.columns.map((c) => c.label));
    expect(cols).toHaveLength(1);
    expect(cols[0]).toMatch(/BET/);
    wrap(<OrderComparisonView order={order} onClose={() => {}} onSelectSample={() => {}} />);
    expect(screen.getByTestId("bet-results")).toBeTruthy();
    expect(screen.getByText("98,7")).toBeTruthy();
    expect(screen.getByText("60,1")).toBeTruthy();
    expect(screen.queryByText(/Tara|Brutto|Rohr|SMP/i)).toBeNull();
  });
});

describe("BET: Zähler und Excel", () => {
  it("Zähler zählen nur den BET-Wert", () => {
    const rec = { ...meas(betResults()), orderId: "o", orderDisplayNumber: "BR-1", projectName: "", originalSampleNumber: null, sampleId: "s1", completedAt: null, createdAt: null } as any;
    const g = groupRecordsBySample([rec])[0];
    expect(g.officialCount).toBe(1);
    expect(g.interimCount).toBe(0);
    const s = summarizeServices([rec])[0];
    expect([s.official, s.interim]).toEqual([1, 0]);
  });

  it("Auftrags-Excel: nur der BET-Wert", () => {
    const rec = { ...meas(betResults()), orderId: "o", orderDisplayNumber: "BR-1", projectName: "", createdByName: "", assignedToName: "", remarks: "", sampleId: "s1", originalSampleNumber: null, completedAt: null, createdAt: "2026-11-10T00:00:00Z", orderCreatedAt: "2026-11-10T00:00:00Z" } as any;
    const out = buildOrderExport({ records: [rec], statusLabel: "offen", precision: { fields: [], calculations: [], serviceFields: [] } as any, exportDate: new Date("2026-11-20") });
    const cells = out!.sheets.flatMap((sh) => sh.rows.flat().map((c) => c.v));
    expect(cells).toContain(98.7008);
    for (const t of ["Leergewicht - TARA [g]", "Rohr Nr.:", "SMP-Nummer", "0000-9348 "]) expect(cells).not.toContain(t);
    for (const n of [60.6222, 30.9049, 30.4309, 9]) expect(cells).not.toContain(n); // Hilfswerte nicht im Excel
  });
});

describe("BET: BET-Feld vorhanden, aber leer", () => {
  it("zeigt „Probe | –“ statt der Hilfswerte", () => {
    const leer = betResults().map((r) => (r.id === "spezifische_oberflache_bet" ? { ...r, value: null } : r));
    render(<TooltipProvider><SampleMeasurementResultsTable measurement={meas(leer)} /></TooltipProvider>);
    expect(screen.getByTestId("bet-results")).toBeTruthy();
    expect(screen.getByText("–")).toBeTruthy();
    expect(screen.queryByText(/Tara|Brutto|Rohr|SMP/i)).toBeNull();
  });
});

import { fireEvent } from "@testing-library/react";
import { restrictGroupToService } from "@/lib/results/sampleResultsAggregation";

describe("Probendetail aus einer Messart: nur Messungen dieser Messart", () => {
  const act = (id: string): SampleMeasurementRecord =>
    ({ ...meas([res("av_1", "AV 1", 41.38, "m/h", false)], "Aktivitätsmessung", id), orderId: "o" }) as any;
  const group = () => ({
    sampleKey: "A", sampleId: "s", sampleNumber: "P1", sampleName: "X", originalSampleNumber: null, projectNames: [], orderDisplayNumbers: ["BR-1"], orderIds: ["o"],
    measurements: [meas(betResults(), "BET", "m-bet"), act("m-act")], officialCount: 1, interimCount: 6, lastActivityAt: null,
  }) as any;

  it("mit Messart: nur diese Messart, Zähler passend", () => {
    const g = restrictGroupToService(group(), "BET");
    expect(g.measurements.map((m: any) => m.serviceName)).toEqual(["BET"]);
    expect([g.officialCount, g.interimCount]).toEqual([1, 0]);
    expect(restrictGroupToService(group(), "Aktivitätsmessung").measurements).toHaveLength(1);
  });

  it("ohne Messart-Bezug (Nach Probe) oder unbekannte Messart: alle Messarten wie bisher", () => {
    const g = group();
    expect(restrictGroupToService(g, null)).toBe(g);
    expect(restrictGroupToService(g, undefined)).toBe(g);
    expect(restrictGroupToService(g, "Gibt es nicht")).toBe(g);
  });

  it("Auftragsansicht gibt beim Klick die Messart mit (BET-Zeile und Sektionstabelle)", () => {
    const sample = { sampleKey: "A", sampleNumber: "P1", sampleName: "X", projectNames: [], orderDisplayNumbers: ["BR-1"], orderIds: ["o"], measurements: [meas(betResults(), "BET", "m-bet"), act("m-act"), meas([res("wert", "Wert", 5, "mm", true)], "Dilatometrie", "m-dil")], officialCount: 1, interimCount: 0, lastActivityAt: null } as any;
    const order = { orderKey: "o", orderId: "o", displayNumber: "BR-1", projectNames: [], samples: [sample], measurementCount: 2, officialCount: 1, interimCount: 0, lastActivityAt: null } as unknown as OrderGroup;
    const onSelect = vi.fn();
    render(<TooltipProvider><OrderComparisonView order={order} onClose={() => {}} onSelectSample={onSelect} /></TooltipProvider>);
    fireEvent.click(screen.getByText("98,7008"));
    expect(onSelect).toHaveBeenLastCalledWith(sample, "BET");
    fireEvent.click(screen.getByText("5"));
    expect(onSelect).toHaveBeenLastCalledWith(sample, "Dilatometrie");
  });
});
