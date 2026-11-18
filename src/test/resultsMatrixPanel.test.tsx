import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ResultsMatrixTable from "@/components/results/ResultsMatrixTable";
import { matrixNavItems, matrixRowSelection } from "@/lib/resultsMatrix";
import { groupRecordsByOrder } from "@/lib/results/orderGroups";
import { groupRecordsBySample, type SampleMeasurementRecord } from "@/lib/results/sampleResultsAggregation";
import { emptyPrecisionDefinitions } from "@/lib/resultDisplayPrecision";
import type { ResultRecord } from "@/hooks/useResultsDatabase";

// Keine Datenbank-/Übersetzungs-Abhängigkeiten in diesem Test.
vi.mock("@/hooks/useResultDisplayPrecision", () => ({ useResultDisplayPrecision: () => emptyPrecisionDefinitions }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock("@/components/results/RequesterConditionsPanel", () => ({ default: () => null }));

// jsdom kennt ResizeObserver nicht (HorizontalScrollArea).
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const out = (label: string, value: number) => ({
  id: label + value, result_name: `form:f:${label}`, display_label: label, value, unit: "%", remarks: null,
  is_official: true, temperature_range_from: null, temperature_range_to: null, temperature_unit: null,
  instance_key: null, instance_label: null, instance_context: null,
});
const rec = (o: Partial<ResultRecord> & { measurementId: string; sampleId: string | null; orderId: string }): ResultRecord =>
  ({
    measurementNumber: "M1", orderNumber: "A1", serviceId: "svc", serviceName: "RFA", sampleNumber: o.sampleId ?? "–",
    sampleName: "", originalSampleNumber: null, completedAt: null, outputResults: [out("SiO2", 5)], instanceKey: null,
    ...o,
  }) as unknown as ResultRecord;

describe("Matrixzeile -> Seitenleiste", () => {
  it("Auswahlschlüssel stimmen mit den Gruppen der Probenübersicht überein", () => {
    const r = rec({ measurementId: "m1", sampleId: "s1", orderId: "o1" });
    const withoutSample = rec({ measurementId: "m2", sampleId: null, orderId: "o2" });
    const asSampleRecord = (x: ResultRecord) =>
      ({ ...x, orderDisplayNumber: "A1", projectName: "", createdAt: "2026-11-01T00:00:00Z", results: [] }) as unknown as SampleMeasurementRecord;
    const recs = [asSampleRecord(r), asSampleRecord(withoutSample)];
    const orders = groupRecordsByOrder(recs);
    const samples = groupRecordsBySample(recs);
    for (const x of [r, withoutSample]) {
      const sel = matrixRowSelection(x);
      const order = orders.find((o) => o.orderKey === sel.orderKey);
      expect(order, "Auftrag gefunden").toBeTruthy();
      expect(order!.samples.some((s) => s.sampleKey === sel.sampleKey), "Probe im Auftrag gefunden").toBe(true);
      expect(samples.some((s) => s.sampleKey === sel.sampleKey)).toBe(true);
    }
  });

  it("Pfeiltasten-Reihenfolge: Proben in Zeilenreihenfolge, direkt aufeinanderfolgende Zeilen derselben Probe einmal", () => {
    const rows = [
      rec({ measurementId: "m1", sampleId: "s1", orderId: "o1" }),
      rec({ measurementId: "m2", sampleId: "s1", orderId: "o1" }),
      rec({ measurementId: "m3", sampleId: "s2", orderId: "o1" }),
    ];
    expect(matrixNavItems(rows).map((i) => i.sampleKey)).toEqual(["s1", "s2"]);
  });
});

describe("ResultsMatrixTable: Zeilenklick", () => {
  const columns = [{ key: "sio2", label: "SiO2", unit: "%", group: null }];
  const rows = [
    rec({ measurementId: "m1", sampleId: "s1", orderId: "o1", sampleNumber: "P1", measurementNumber: "M1" }),
    rec({ measurementId: "m2", sampleId: "s2", orderId: "o1", sampleNumber: "P2", measurementNumber: "M2" }),
  ];

  it("Klick auf eine Zeile ruft den Handler mit der Zeile auf, markierte Zeile ist gekennzeichnet", () => {
    const onRowClick = vi.fn();
    render(
      <ResultsMatrixTable
        records={rows} columns={columns} onRowClick={onRowClick}
        isRowSelected={(r) => r.measurementId === "m2"}
      />,
    );
    fireEvent.click(screen.getByText("P1"));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0][0].measurementId).toBe("m1");
    const selectedRows = document.querySelectorAll("tr[data-selected-row='true']");
    expect(selectedRows).toHaveLength(1);
    expect(selectedRows[0].textContent).toContain("P2");
  });

  it("das Symbol für die Auftraggeber-Vorgaben löst keinen Zeilenklick aus", () => {
    const onRowClick = vi.fn();
    render(<ResultsMatrixTable records={rows} columns={columns} onRowClick={onRowClick} />);
    fireEvent.click(screen.getAllByLabelText("Auftraggeber-Vorgaben anzeigen")[0]);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("ohne Handler bleibt die Tabelle wie bisher (nicht klickbar)", () => {
    render(<ResultsMatrixTable records={rows} columns={columns} />);
    expect(document.querySelectorAll("tr.cursor-pointer")).toHaveLength(0);
  });
});
