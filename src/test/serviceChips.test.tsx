import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import ServiceChips from "@/components/results/ServiceChips";
import OrderOverviewTable from "@/components/results/OrderOverviewTable";
import SampleOverviewTable from "@/components/results/SampleOverviewTable";
import { summarizeServices } from "@/lib/results/serviceSummary";
import type { OrderGroup } from "@/lib/results/orderGroups";
import type { SampleGroup, SampleMeasurementRecord, SampleResultValue } from "@/lib/results/sampleResultsAggregation";

(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const res = (official: boolean, o: Partial<SampleResultValue> = {}): SampleResultValue => ({
  id: crypto.randomUUID(), result_name: "x", value: 1, unit: null, temperature_range_from: null,
  temperature_range_to: null, temperature_unit: null, remarks: null, measured_at: null, display_label: "x",
  is_official: official, instance_key: null, instance_label: null, instance_context: null, ...o,
});
const meas = (service: string, results: SampleResultValue[]): SampleMeasurementRecord =>
  ({ measurementId: crypto.randomUUID(), serviceName: service, results }) as unknown as SampleMeasurementRecord;

const protocol = JSON.stringify({ imported_at: "2026-11-01T00:00:00Z", profile: "RFA", count: 1 });

describe("Messarten zusammenfassen", () => {
  it("zählt Analysen, offizielle und vorläufige Werte je Messart (alphabetisch)", () => {
    const s = summarizeServices([
      meas("RFA", [res(true), res(true), res(false)]),
      meas("BET", [res(true)]),
      meas("RFA", [res(false)]),
    ]);
    expect(s).toEqual([
      { name: "BET", analyses: 1, official: 1, interim: 0 },
      { name: "RFA", analyses: 2, official: 2, interim: 2 },
    ]);
  });

  it("interne Einträge (Importprotokoll, leere Blöcke) zählen nicht als Werte; Messart ohne Namen heißt „Messung“", () => {
    const s = summarizeServices([
      meas("", [res(false, { value: null, remarks: protocol }), res(false, { value: null, remarks: JSON.stringify([{ a: null }]) })]),
    ]);
    expect(s).toEqual([{ name: "Messung", analyses: 1, official: 0, interim: 0 }]);
  });
});

describe("ServiceChips", () => {
  const four = [meas("BET", [res(true)]), meas("RFA", [res(true), res(false)]), meas("Geometrie", [res(true)]), meas("Aktivität", [res(false)])];

  it("bis zu drei Chips, der Rest als „+N“", () => {
    render(<ServiceChips measurements={four} />);
    expect(screen.getByText("Aktivität")).toBeTruthy();
    expect(screen.getByText("BET")).toBeTruthy();
    expect(screen.getByText("Geometrie")).toBeTruthy();
    expect(screen.queryByText("RFA")).toBeNull();
    expect(screen.getByText("+1")).toBeTruthy();
  });

  it("Klick öffnet die Details je Messart mit Anzahl offiziell/vorläufig", () => {
    render(<ServiceChips measurements={four} />);
    fireEvent.click(screen.getByLabelText("Messarten anzeigen (4)"));
    const list = screen.getByText("Messarten (4)").closest("div")!;
    const rfa = within(list).getByText("RFA").closest("li")!;
    expect(within(rfa).getByText("1 offiziell")).toBeTruthy();
    expect(within(rfa).getByText("1 vorläufig")).toBeTruthy();
    const akt = within(list).getByText("Aktivität").closest("li")!;
    expect(within(akt).getByText("0 offiziell")).toBeTruthy();
    expect(within(akt).getByText("1 vorläufig")).toBeTruthy();
  });

  it("kompakt: ein einzelner Chip bzw. „N Messarten“ (einzeilig)", () => {
    const { unmount } = render(<ServiceChips measurements={[meas("BET", [res(true)])]} compact />);
    expect(screen.getByText("BET")).toBeTruthy();
    unmount();
    render(<ServiceChips measurements={four} compact />);
    expect(screen.getByText("4 Messarten")).toBeTruthy();
    expect(screen.queryByText("BET")).toBeNull();
  });

  it("ohne Messungen: „–“", () => {
    render(<ServiceChips measurements={[]} />);
    expect(screen.getByText("–")).toBeTruthy();
  });

  it("Klick auf Chips löst den Klick der Tabellenzeile nicht aus", () => {
    const onRow = vi.fn();
    render(
      <div onClick={onRow}>
        <ServiceChips measurements={four} />
      </div>,
    );
    fireEvent.click(screen.getByText("BET"));
    fireEvent.click(screen.getByLabelText("Messarten anzeigen (4)"));
    fireEvent.click(screen.getByText("Messarten (4)"));
    expect(onRow).not.toHaveBeenCalled();
  });
});

describe("Tabellen mit Messarten-Spalte", () => {
  const sample = (key: string, ms: SampleMeasurementRecord[]): SampleGroup =>
    ({
      sampleKey: key, sampleNumber: key, sampleName: "", originalSampleNumber: null, projectNames: [],
      orderDisplayNumbers: ["A1"], measurements: ms, officialCount: 1, interimCount: 0, lastActivityAt: null,
    }) as unknown as SampleGroup;
  const order = (): OrderGroup => {
    const s1 = sample("P1", [meas("BET", [res(true)]), meas("RFA", [res(true)])]);
    const s2 = sample("P2", [meas("RFA", [res(true)])]);
    return {
      orderKey: "o", orderId: "o", displayNumber: "FG-1", projectNames: [], samples: [s1, s2],
      measurementCount: 3, officialCount: 3, interimCount: 0, lastActivityAt: null,
    };
  };
  const wrap = (ui: React.ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);

  it("Auftragszeile und Probenzeilen zeigen ihre Messarten", () => {
    wrap(
      <OrderOverviewTable orders={[order()]} expanded={new Set(["o"])} onToggle={() => {}} onSelectSample={() => {}} onOpenOverview={() => {}} />,
    );
    expect(screen.getByText("Messarten")).toBeTruthy();
    // Auftrag: BET + RFA; P1: BET + RFA; P2: RFA
    expect(screen.getAllByText("BET")).toHaveLength(2);
    expect(screen.getAllByText("RFA")).toHaveLength(3);
  });

  it("bei offener Seitenleiste bleibt die Spalte erhalten (kompakt)", () => {
    wrap(
      <OrderOverviewTable orders={[order()]} expanded={new Set()} onToggle={() => {}} onSelectSample={() => {}} onOpenOverview={() => {}} compact />,
    );
    expect(screen.getByText("Messarten")).toBeTruthy();
    expect(screen.getByText("2 Messarten")).toBeTruthy();
  });

  it("Nach Probe: jede Probe zeigt ihre Messarten", () => {
    wrap(<SampleOverviewTable groups={order().samples} onSelect={() => {}} />);
    expect(screen.getByText("Messarten")).toBeTruthy();
    expect(screen.getAllByText("RFA")).toHaveLength(2);
    expect(screen.getAllByText("BET")).toHaveLength(1);
  });

  it("Klick auf die Zeile öffnet weiterhin die Ergebnisübersicht, Klick auf die Chips nicht", () => {
    const onOpen = vi.fn();
    wrap(
      <OrderOverviewTable orders={[order()]} expanded={new Set()} onToggle={() => {}} onSelectSample={() => {}} onOpenOverview={onOpen} />,
    );
    fireEvent.click(screen.getAllByText("BET")[0]);
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("FG-1"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
