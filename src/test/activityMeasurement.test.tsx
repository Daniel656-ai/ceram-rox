import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import ActivityMeasurementView from "@/components/results/ActivityMeasurementView";
import { SampleMeasurementResultsTable } from "@/components/results/SampleResultsView";
import {
  extractActivity,
  isActivityBlockResult,
  parseActivityBlock,
} from "@/lib/results/activityMeasurement";
import { buildOrderComparison, type OrderGroup } from "@/lib/results/orderGroups";
import { activityExportRows } from "@/lib/orderExport/buildOrderExport";
import { cleanUnmappableMarkup, toUnicode } from "@/lib/richText";
import { formatResultLabel } from "@/lib/resultLabels";
import type { SampleGroup, SampleMeasurementRecord, SampleResultValue } from "@/lib/results/sampleResultsAggregation";
import { ACTIVITY_BLOCK_JSON } from "./fixtures/activityBlockP260305";

vi.mock("@/components/CompletedResultForm", () => ({ default: () => null }));
vi.mock("@/components/results/RequesterConditionsPanel", () => ({ default: () => null }));
vi.mock("@/components/results/CorrectionHistoryDialog", () => ({ default: () => null }));
vi.mock("@/components/results/ResultCorrectionDialog", () => ({ default: () => null }));
vi.mock("@/hooks/useResultCorrections", () => ({ useCanCorrectResults: () => false }));
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const res = (over: Partial<SampleResultValue>): SampleResultValue => ({
  id: crypto.randomUUID(), result_name: "form:f:x", value: null, unit: null, temperature_range_from: null,
  temperature_range_to: null, temperature_unit: null, remarks: null, measured_at: null, display_label: null,
  is_official: false, ...over,
});
const block = (official = false) =>
  res({ result_name: "form:f:aktivitatsmessblock", display_label: "Aktivitätsmessblock", remarks: ACTIVITY_BLOCK_JSON, is_official: official });

describe("Aktivitätsmessblock (echte Daten P260305)", () => {
  const cats = parseActivityBlock(block())!;

  it("erkennt zwei Katalysatoren mit kat_nr als Titel", () => {
    expect(cats.map((c) => c.title)).toEqual(["FG26_0330/1", "FG26_0330/2"]);
  });

  it("Messbedingungen: AV, FR (feucht), Sollwerte der Anlage", () => {
    expect(cats[0].conditions).toEqual({ av: 41.38, fr: 1.44, no: 200, nh3: 240, h2o: 10, o2: 10 });
    expect(cats[1].conditions.no).toBe(233);
  });

  it("Temperaturzeilen aufsteigend, ein K-Wert (k_wert_kopie), η NOx, Gase in/out", () => {
    const rows = cats[0].rows;
    expect(rows.map((r) => r.temperature)).toEqual([200, 280, 360]);
    expect(rows.map((r) => r.eta)).toEqual([22.4, 57.8, 71]);
    expect(rows.map((r) => r.k)).toEqual([10.5, 35.7, 51.2]);
    expect(rows[0].gases.NO).toEqual({ in: 199.8, out: 155 });
    expect(rows[0].gases.NO2).toEqual({ in: 0.5, out: 0 });
    expect(rows[0].gases.N2O).toEqual({ in: 0.2, out: 0.2 });
    expect(rows[0].gases.NH3).toEqual({ in: 241, out: 189.4 });
  });

  it("leere Spalten (CO, CO₂) entfallen; Reihenfolge NO, NH₃, NO₂, N₂O", () => {
    expect(cats[0].gasColumns).toEqual(["NO", "NH3", "NO2", "N2O"]);
  });

  it("andere Ergebnisse sind kein Aktivitätsmessblock", () => {
    expect(isActivityBlockResult(res({ value: 5 }))).toBe(false);
    expect(isActivityBlockResult(res({ remarks: '[{"__instance_id":"x","__label":""}]' }))).toBe(false);
    expect(isActivityBlockResult(res({ remarks: "Text" }))).toBe(false);
  });

  it("extractActivity trennt den Block von den übrigen Werten", () => {
    const other = res({ result_name: "form:f:av_1", display_label: "AV 1", value: 41.38 });
    const { view, rest } = extractActivity([other, block()]);
    expect(view?.official).toBe(false);
    expect(view?.catalysts).toHaveLength(2);
    expect(rest).toEqual([other]);
    expect(extractActivity([block(true)]).view?.official).toBe(true);
  });
});

describe("Darstellung", () => {
  const wrap = (ui: React.ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);

  it("zeigt Titel, Messbedingungen und Temperaturtabelle; vorläufig grau; CO/CO₂ nicht", () => {
    const view = extractActivity([block()]).view!;
    wrap(<ActivityMeasurementView view={view} />);
    expect(screen.getByText("FG26_0330/1")).toBeTruthy();
    expect(screen.getByText("FG26_0330/2")).toBeTruthy();
    expect(screen.getAllByText("Messbedingungen")).toHaveLength(2);
    expect(screen.getAllByText("Ergebnisse je Temperatur")).toHaveLength(2);
    expect(screen.getAllByText("Rest")).toHaveLength(2);
    expect(screen.getAllByText("[m/h]").length).toBeGreaterThan(0);
    expect(screen.getAllByText("[Nm³/h]").length).toBeGreaterThan(0);
    expect(screen.getAllByText("[Nm/h]").length).toBeGreaterThan(0);
    expect(screen.getAllByText("[°C]").length).toBeGreaterThan(0);
    expect(screen.getAllByText("NO₂").length).toBeGreaterThan(0);
    expect(screen.getAllByText("N₂O").length).toBeGreaterThan(0);
    expect(screen.queryByText("CO")).toBeNull();
    expect(screen.queryByText("CO₂")).toBeNull();
    expect(screen.getAllByText("199,8 / 155").length).toBe(1);
    const row = screen.getAllByText("199,8 / 155")[0].closest("tr")!;
    expect(row.className).toContain("text-muted-foreground");
    expect(within(row).getByText("22,4")).toBeTruthy();
  });

  it("offiziell: normale Textfarbe", () => {
    const view = extractActivity([block(true)]).view!;
    wrap(<ActivityMeasurementView view={view} />);
    const row = screen.getAllByText("199,8 / 155")[0].closest("tr")!;
    expect(row.className).not.toContain("text-muted-foreground");
  });

  it("Probendetail: Aktivitätsmessung statt Rohzeilen (keine „No2 in 1“ / „Eta nox“-Zeilen), einfache Felder bleiben", () => {
    const m = {
      measurementId: "m1", measurementNumber: "M260640", serviceName: "Aktivitätsmessung", sampleNumber: "P260305", sampleName: "FG26_0330",
      orderNumber: "FG-260016", results: [
        res({ result_name: "form:f:av_1", display_label: "AV 1", value: 41.38, unit: "m/h" }),
        res({ result_name: "form:f:fr_1", display_label: "FR 1", value: 1.44, unit: "Nm^{3}/h" }),
        res({ result_name: "form:f:zellenzahl_av2", display_label: "Zellenzahl_{ (AV2)}", value: 64 }),
        block(),
      ],
    } as unknown as SampleMeasurementRecord;
    render(<TooltipProvider><SampleMeasurementResultsTable measurement={m} /></TooltipProvider>);
    expect(screen.getByTestId("activity-measurement")).toBeTruthy();
    expect(screen.queryByText(/Eta nox/i)).toBeNull();
    expect(screen.queryByText(/No2 in 1/i)).toBeNull();
    expect(screen.getByText("AV 1")).toBeTruthy();
    expect(screen.getByText("Nm³/h")).toBeTruthy();
    expect(screen.getByText("Zellenzahl (AV2)")).toBeTruthy();
  });
});

describe("Ergebnisübersicht und Excel", () => {
  const meas = { measurementId: "m1", serviceName: "Aktivitätsmessung", results: [block()] } as unknown as SampleMeasurementRecord;
  const sample = { sampleKey: "P1", sampleNumber: "P260305", sampleName: "FG26_0330", measurements: [meas] } as unknown as SampleGroup;
  const order = { orderKey: "o", orderId: "o", displayNumber: "FG-260016", projectNames: [], samples: [sample], measurementCount: 1, officialCount: 0, interimCount: 1, lastActivityAt: null } as OrderGroup;

  it("buildOrderComparison zeigt den Block nicht mehr als Rohspalten", () => {
    const labels = buildOrderComparison(order).flatMap((s) => s.columns.map((c) => c.label));
    expect(labels.join("|")).not.toMatch(/Eta nox|K wert|No2/i);
  });

  it("Excel: Messbedingungen und Temperaturtabelle je Katalysator, Gase in/out als Zahlenspalten, Status", () => {
    const rows = activityExportRows(extractActivity([block()]).view!).map((r) => r.map((c) => c.v));
    expect(rows[0]).toEqual(["Aktivitätsmessung · Katalysator FG26_0330/1", "vorläufig"]);
    expect(rows[2]).toEqual(["AV [m/h]", "FR [Nm³/h]", "NO in [ppm]", "NH₃ in [ppm]", "H₂O in [%]", "O₂ in [%]", "N₂ in"]);
    expect(rows[3]).toEqual([41.38, 1.44, 200, 240, 10, 10, "Rest"]);
    const head = rows[6];
    expect(head.slice(0, 5)).toEqual(["Temperatur [°C]", "η NOx [%]", "K-Wert [Nm/h]", "NO in [ppm]", "NO out [ppm]"]);
    expect(head).not.toContain("CO in [ppm]");
    expect(head[head.length - 1]).toBe("Status");
    expect(rows[7].slice(0, 5)).toEqual([200, 22.4, 10.5, 199.8, 155]);
    expect(rows[7][rows[7].length - 1]).toBe("vorläufig");
  });
});

describe("Aufräumen: Einheiten und Beschriftungen", () => {
  it("Nm^{3}/h -> Nm³/h; Zellenzahl_{ (AV2)} -> Zellenzahl (AV2)", () => {
    expect(formatResultLabel("FR 1", "Nm^{3}/h")).toBe("FR 1 [Nm³/h]");
    expect(toUnicode(cleanUnmappableMarkup("Zellenzahl_{ (AV2)}"))).toBe("Zellenzahl (AV2)");
    expect(toUnicode(cleanUnmappableMarkup("Zellenzahl_{ AV1}"))).toBe("Zellenzahl AV1");
  });
  it("darstellbare Auszeichnungen bleiben (V_{2}O_{5}, Nm^{3})", () => {
    expect(cleanUnmappableMarkup("V_{2}O_{5}")).toBe("V_{2}O_{5}");
    expect(toUnicode(cleanUnmappableMarkup("Nm^{3}/h"))).toBe("Nm³/h");
  });
});
