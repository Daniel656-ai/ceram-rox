import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import OrderComparisonView from "@/components/results/OrderComparisonView";
import { buildOrderComparison, summarizeRuns, type OrderGroup } from "@/lib/results/orderGroups";
import type { SampleGroup, SampleMeasurementRecord, SampleResultValue } from "@/lib/results/sampleResultsAggregation";

// jsdom kennt ResizeObserver nicht (HorizontalScrollArea).
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const res = (label: string, value: number, run: string | null, o: Partial<SampleResultValue> = {}): SampleResultValue => ({
  id: crypto.randomUUID(), result_name: `form:f:${label}`, value, unit: "%", temperature_range_from: null,
  temperature_range_to: null, temperature_unit: null, remarks: null, measured_at: null, display_label: label,
  is_official: true, instance_key: run, instance_label: run ? `Lauf ${run}` : null, instance_context: null, ...o,
});
const meas = (id: string, results: SampleResultValue[]) =>
  ({ measurementId: id, serviceName: "RFA", results }) as unknown as SampleMeasurementRecord;
const sampleOf = (no: string, ms: SampleMeasurementRecord[]) =>
  ({ sampleKey: no, sampleNumber: no, sampleName: "", measurements: ms }) as unknown as SampleGroup;
const orderOf = (samples: SampleGroup[], projectNames: string[] = []): OrderGroup =>
  ({
    orderKey: "o", orderId: "o", displayNumber: "MWI260003", projectNames, samples,
    measurementCount: 1, officialCount: 0, interimCount: 0, lastActivityAt: null,
  }) as OrderGroup;

// P1: drei Durchläufe, P2: ein Durchlauf
const threeRuns = [
  res("SiO2", 7.18, "1"), res("SiO2", 7.3, "2"), res("SiO2", 6.34, "3"),
  res("Al2O3", 1, "1"), res("Al2O3", 2, "2"), res("Al2O3", 3, "3"),
];
const order = () => orderOf([sampleOf("P260746", [meas("m1", threeRuns)]), sampleOf("P260747", [meas("m2", [res("SiO2", 5, null)])])]);

describe("Durchläufe als Unterzeilen", () => {
  it("jeder Durchlauf ist eine eigene Unterzeile mit eigenem Wert (kein '/' in der Zelle)", () => {
    const [sec] = buildOrderComparison(order());
    const p1 = sec.rows[0];
    expect(p1.runs).toHaveLength(3);
    expect(p1.runs.map((r) => r.label)).toEqual(["Lauf 1", "Lauf 2", "Lauf 3"]);
    const key = sec.columns.find((c) => c.label === "SiO2")!.key;
    expect(p1.runs.map((r) => r.cells[key])).toEqual([[7.18], [7.3], [6.34]]);
    // Probe mit nur einem Durchlauf: keine Bezeichnung
    expect(sec.rows[1].runs).toHaveLength(1);
    expect(sec.rows[1].runs[0].label).toBeNull();
    expect(sec.hasMultipleRuns).toBe(true);
  });

  it("fehlt ein Name, heißen die Durchläufe 'Lauf n'", () => {
    const rs = [res("SiO2", 1, "a", { instance_label: null }), res("SiO2", 2, "b", { instance_label: null })];
    const [sec] = buildOrderComparison(orderOf([sampleOf("P1", [meas("m", rs)])]));
    expect(sec.rows[0].runs.map((r) => r.label)).toEqual(["Lauf 1", "Lauf 2"]);
  });

  it("Mittelwert und n über die Durchläufe, Einzelwerte bleiben erhalten", () => {
    const [sec] = buildOrderComparison(order());
    const key = sec.columns.find((c) => c.label === "SiO2")!.key;
    const s = summarizeRuns(sec.rows[0], key);
    expect(s.n).toBe(3);
    expect(s.mean).toBeCloseTo((7.18 + 7.3 + 6.34) / 3, 10);
    expect(s.values).toEqual([7.18, 7.3, 6.34]);
  });

  it("Mittelwert nur bei gleichem Kontext (Wiederholungen), nicht bei unterschiedlicher Messstelle", () => {
    const same = [res("SiO2", 1, "1", { instance_context: { Messstelle: "A" } }), res("SiO2", 2, "2", { instance_context: { Messstelle: "A" } })];
    expect(buildOrderComparison(orderOf([sampleOf("P1", [meas("m", same)])]))[0].meanAvailable).toBe(true);
    const diff = [res("SiO2", 1, "1", { instance_context: { Messstelle: "A" } }), res("SiO2", 2, "2", { instance_context: { Messstelle: "B" } })];
    expect(buildOrderComparison(orderOf([sampleOf("P1", [meas("m", diff)])]))[0].meanAvailable).toBe(false);
  });
});

describe("Ergebnisübersicht: Darstellung", () => {
  const wrap = (o: OrderGroup) =>
    render(
      <TooltipProvider>
        <OrderComparisonView order={o} onClose={() => {}} onSelectSample={() => {}} />
      </TooltipProvider>,
    );

  it("zeigt jeden Durchlauf einzeln und die Probe nur in der ersten Zeile", () => {
    wrap(order());
    expect(screen.getAllByText("P260746")).toHaveLength(1);
    expect(screen.getByText(/· Lauf 1/)).toBeTruthy();
    expect(screen.getByText("Lauf 2")).toBeTruthy();
    expect(screen.getByText("Lauf 3")).toBeTruthy();
    expect(screen.getByText("7,18")).toBeTruthy();
    expect(screen.getByText("7,3")).toBeTruthy();
    expect(screen.getByText("6,34")).toBeTruthy();
    expect(screen.queryByText(/7,18 \//)).toBeNull();
  });

  it("Schalter 'Mittelwert anzeigen' ersetzt die Unterzeilen durch eine Zeile mit n=3", () => {
    wrap(order());
    fireEvent.click(screen.getByLabelText("Mittelwert anzeigen"));
    expect(screen.getByText(/Ø n=3/)).toBeTruthy();
    expect(screen.queryByText("Lauf 2")).toBeNull();
    expect(screen.getByText("6,94")).toBeTruthy();
    // Probe mit nur einem Durchlauf bleibt unverändert
    expect(screen.getAllByText("P260747")).toHaveLength(1);
  });

  it("Schalter nur, wenn es Proben mit mehreren Durchläufen gibt", () => {
    wrap(orderOf([sampleOf("P1", [meas("m", [res("SiO2", 1, null)])])]));
    expect(screen.queryByLabelText("Mittelwert anzeigen")).toBeNull();
  });

  it("Kopf: 'Projekt' nur, wenn eines vorhanden ist", () => {
    const { unmount } = wrap(order());
    expect(screen.queryByText(/Projekt/)).toBeNull();
    unmount();
    wrap(orderOf([sampleOf("P1", [])], ["Alpha"]));
    expect(screen.getByText(/Projekt Alpha/)).toBeTruthy();
  });
});
