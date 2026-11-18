import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import OrderOverviewTable from "@/components/results/OrderOverviewTable";
import SampleOverviewTable from "@/components/results/SampleOverviewTable";
import { ResultCountBadges } from "@/components/results/ResultCountBadges";
import { buildOrderComparison, type OrderGroup } from "@/lib/results/orderGroups";
import type { SampleGroup, SampleMeasurementRecord, SampleResultValue } from "@/lib/results/sampleResultsAggregation";

const sample = (key: string, official: number, interim: number): SampleGroup =>
  ({
    sampleKey: key, sampleId: key, sampleNumber: key, sampleName: `Name ${key}`, originalSampleNumber: null,
    projectNames: ["Projekt X"], orderDisplayNumbers: ["FG-1"], orderIds: ["o1"], measurements: [{}],
    officialCount: official, interimCount: interim, lastActivityAt: null,
  }) as unknown as SampleGroup;

const order = (): OrderGroup => ({
  orderKey: "o1", orderId: "o1", displayNumber: "FG-260014", projectNames: ["Projekt X"],
  samples: [sample("P1", 4, 12), sample("P2", 0, 3)],
  measurementCount: 2, officialCount: 4, interimCount: 15, lastActivityAt: null,
});

// jsdom kennt ResizeObserver nicht (HorizontalScrollArea der normalen Ansicht).
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const wrap = (ui: React.ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);

describe("kompakte Auftragsliste", () => {
  it("kompakt: nur Auftrag/Probe und Messwerte, keine Zusatzspalten, kein Knopf je Zeile", () => {
    wrap(
      <OrderOverviewTable
        orders={[order()]} expanded={new Set(["o1"])} onToggle={() => {}} onSelectSample={() => {}}
        onOpenOverview={() => {}} compact
      />,
    );
    expect(screen.queryByText("Projekt / Bezeichnung")).toBeNull();
    expect(screen.queryByText("Analysen")).toBeNull();
    expect(screen.queryByText("Letzte Aktivität")).toBeNull();
    expect(screen.getByText("Messwerte")).toBeTruthy();
    expect(screen.queryByText(/Ergebnisübersicht$/)).toBeNull();
    expect(screen.getAllByText("4 offiziell").length).toBeGreaterThan(0);
    expect(screen.getAllByText("12 vorläufig").length).toBeGreaterThan(0);
  });

  it("normal: zusätzliche Spalten sichtbar", () => {
    wrap(
      <OrderOverviewTable
        orders={[order()]} expanded={new Set()} onToggle={() => {}} onSelectSample={() => {}} onOpenOverview={() => {}}
      />,
    );
    expect(screen.getByText("Projekt / Bezeichnung")).toBeTruthy();
    expect(screen.getByText("Letzte Aktivität")).toBeTruthy();
  });

  it("Klick auf die Auftragszeile öffnet die Ergebnisübersicht, der Pfeil nur das Auf-/Zuklappen", () => {
    const onOpen = vi.fn();
    const onToggle = vi.fn();
    wrap(
      <OrderOverviewTable
        orders={[order()]} expanded={new Set()} onToggle={onToggle} onSelectSample={() => {}} onOpenOverview={onOpen}
      />,
    );
    fireEvent.click(screen.getByLabelText("Proben aufklappen"));
    expect(onToggle).toHaveBeenCalledWith("o1");
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("FG-260014"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("Probenliste kompakt ohne Zusatzspalten", () => {
    wrap(<SampleOverviewTable groups={[sample("P1", 1, 0)]} onSelect={() => {}} compact />);
    expect(screen.queryByText("Projekt")).toBeNull();
    expect(screen.queryByText("Probenbezeichnung")).toBeNull();
    expect(screen.getByText("1 offiziell")).toBeTruthy();
  });
});

describe("Messwert-Zähler", () => {
  it("0 offiziell wird neutral (outline) dargestellt, nicht hervorgehoben", () => {
    render(<ResultCountBadges official={0} interim={5} />);
    const badge = screen.getByText("0 offiziell");
    expect(badge.className).not.toMatch(/bg-primary/);
    expect(screen.getByText("5 vorläufig")).toBeTruthy();
  });

  it("vorläufig wird nur bei > 0 gezeigt", () => {
    render(<ResultCountBadges official={3} interim={0} />);
    expect(screen.queryByText(/vorläufig/)).toBeNull();
  });
});

describe("Ergebnisübersicht: Analysen ohne offizielle Werte", () => {
  const res = (o: Partial<SampleResultValue>): SampleResultValue => ({
    id: crypto.randomUUID(), result_name: "form:f:x", value: 1, unit: "m²/g", temperature_range_from: null,
    temperature_range_to: null, temperature_unit: null, remarks: null, measured_at: null, display_label: "BET [m²/g]",
    is_official: true, ...o,
  });
  const meas = (serviceName: string, results: SampleResultValue[]) =>
    ({ measurementId: crypto.randomUUID(), serviceName, results }) as unknown as SampleMeasurementRecord;

  it("zählt offizielle und vorläufige Werte je Analyseart", () => {
    const s = {
      sampleKey: "P1", sampleNumber: "P1", sampleName: "",
      measurements: [
        meas("BET", [res({}), res({ is_official: false })]),
        meas("Aktivitätsmessung", Array.from({ length: 12 }, () => res({ is_official: false }))),
      ],
    } as unknown as SampleGroup;
    const sections = buildOrderComparison({ ...order(), samples: [s] });
    const act = sections.find((x) => x.serviceName === "Aktivitätsmessung")!;
    expect(act.columns).toHaveLength(0);
    expect(act.officialCount).toBe(0);
    expect(act.interimCount).toBe(12);
    const bet = sections.find((x) => x.serviceName === "BET")!;
    expect(bet.officialCount).toBe(1);
    expect(bet.interimCount).toBe(1);
  });
});
