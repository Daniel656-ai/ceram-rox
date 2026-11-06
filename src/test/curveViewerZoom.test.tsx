import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import CurveViewer, { type CurveSelection } from "@/components/curves/CurveViewer";
import type { MeasurementDataset } from "@/lib/curves/dataset";

const ds: MeasurementDataset = {
  channels: [{ key: "t", label: "t", unit: "s" }, { key: "a", label: "a", unit: null }],
  rows: Array.from({ length: 101 }, (_, i) => [i, i * 2]),
};

/** Zeichenfläche im jsdom simulieren: 0..1000 px. */
function mockRects(container: HTMLElement) {
  const rect = { left: 0, top: 0, right: 1000, bottom: 300, width: 1000, height: 300, x: 0, y: 0, toJSON: () => ({}) };
  container.querySelectorAll("*").forEach((el) => {
    (el as HTMLElement).getBoundingClientRect = () => rect as DOMRect;
  });
  (Element.prototype as any).setPointerCapture ??= () => {};
  (Element.prototype as any).hasPointerCapture ??= () => false;
  (Element.prototype as any).releasePointerCapture ??= () => {};
}

(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
if (typeof (globalThis as any).PointerEvent === "undefined") {
  (globalThis as any).PointerEvent = class extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: any = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
  };
}
afterEach(cleanup);

describe("CurveViewer Zoom/Auswertung", () => {
  it("chartRef zeigt auf den Diagrammcontainer ohne Navigator", () => {
    const ref = createRef<HTMLDivElement>();
    render(<CurveViewer dataset={ds} chartRef={ref} />);
    expect(ref.current).toBe(screen.getByTestId("curve-main-chart"));
    expect(ref.current!.contains(screen.getByTestId("curve-navigator"))).toBe(false);
  });

  it("Zoom ändert den Auswertungsbereich nicht; Auswertungsmodus setzt ihn", () => {
    const onSel = vi.fn<(s: CurveSelection) => void>();
    const { container } = render(<CurveViewer dataset={ds} onSelectionChange={onSel} />);
    mockRects(container);
    const chart = screen.getByTestId("curve-main-chart");
    const last = () => onSel.mock.calls[onSel.mock.calls.length - 1][0];
    expect(last()).toMatchObject({ from: 0, to: 100 });
    expect(screen.getByText(/101 Originalmesspunkte/)).toBeTruthy();

    // Zoom-Modus: 200px..500px => 20..50
    fireEvent.pointerDown(chart, { button: 0, clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(chart, { clientX: 500, pointerId: 1 });
    fireEvent.pointerUp(chart, { clientX: 500, pointerId: 1 });
    expect(screen.getByText(/31 Originalmesspunkte/)).toBeTruthy();
    expect(last()).toMatchObject({ from: 0, to: 100 });

    // Rückgängig => Gesamtbereich
    fireEvent.click(screen.getByTitle("Zoom rückgängig"));
    expect(screen.getByText(/101 Originalmesspunkte/)).toBeTruthy();

    // Auswertungsmodus
    fireEvent.click(screen.getByRole("button", { name: /Auswertungsmodus/ }));
    mockRects(container);
    fireEvent.pointerDown(chart, { button: 0, clientX: 100, pointerId: 2 });
    fireEvent.pointerMove(chart, { clientX: 300, pointerId: 2 });
    fireEvent.pointerUp(chart, { clientX: 300, pointerId: 2 });
    expect(last()).toMatchObject({ from: 10, to: 30 });
    expect(screen.getByText(/101 Originalmesspunkte/)).toBeTruthy();
  });

  it("Klick ohne Mindestbewegung zoomt nicht; Navigator synchronisiert", () => {
    const { container } = render(<CurveViewer dataset={ds} />);
    mockRects(container);
    const chart = screen.getByTestId("curve-main-chart");
    fireEvent.pointerDown(chart, { button: 0, clientX: 200, pointerId: 1 });
    fireEvent.pointerUp(chart, { clientX: 202, pointerId: 1 });
    expect(screen.getByText(/101 Originalmesspunkte/)).toBeTruthy();

    // Navigator: Fenster rechts von 1000 auf 500 px ziehen => 0..50
    const nav = screen.getByTestId("curve-navigator");
    fireEvent.pointerDown(nav, { button: 0, clientX: 1000, pointerId: 3 });
    fireEvent.pointerMove(nav, { clientX: 500, pointerId: 3 });
    fireEvent.pointerUp(nav, { clientX: 500, pointerId: 3 });
    expect(screen.getByText(/51 Originalmesspunkte/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Zoom zurücksetzen/ }));
    expect(screen.getByText(/101 Originalmesspunkte/)).toBeTruthy();
  });
});
