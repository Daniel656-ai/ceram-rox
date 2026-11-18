import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { analyzeStructured, humanizeKey, labelFromPath, parseStructuredText } from "@/lib/results/structuredValues";
import {
  classifyInternalResult,
  expandStructuredResult,
  prepareDisplayResults,
  splitInternalResults,
} from "@/lib/results/internalResults";
import { buildOrderComparison, type OrderGroup } from "@/lib/results/orderGroups";
import { groupRecordsBySample } from "@/lib/results/sampleResultsAggregation";
import type { SampleGroup, SampleMeasurementRecord, SampleResultValue } from "@/lib/results/sampleResultsAggregation";
import { SampleMeasurementResultsTable } from "@/components/results/SampleResultsView";

vi.mock("@/components/CompletedResultForm", () => ({ default: () => null }));
vi.mock("@/components/results/RequesterConditionsPanel", () => ({ default: () => null }));
vi.mock("@/components/results/CorrectionHistoryDialog", () => ({ default: () => null }));
vi.mock("@/components/results/ResultCorrectionDialog", () => ({ default: () => null }));
vi.mock("@/hooks/useResultCorrections", () => ({ useCanCorrectResults: () => false }));
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const val = (o: Partial<SampleResultValue>): SampleResultValue => ({
  id: o.id ?? crypto.randomUUID(), result_name: "form:f:aktivitaetsmessblock", value: null, unit: null,
  temperature_range_from: null, temperature_range_to: null, temperature_unit: null, remarks: null, measured_at: null,
  display_label: "Aktivitätsmessblock", is_official: false, instance_key: null, instance_label: null, instance_context: null,
  ...o,
});

// Der Fall aus der Praxis: Block mit Einstellungs-Objekt, alles null
const emptyBlock = JSON.stringify([
  { gas_einstellungen: { fr_trocken: null, h_2_o_umrechnung: null, k_wert: null } },
]);
// Block mit Messwerten und Einstellungen
const filledBlock = JSON.stringify([
  {
    __instance_id: "i1",
    aktivitaet_bq: 12.5,
    masse_g: "3,4",
    bemerkung: "ok",
    leer: "",
    gas_einstellungen: { fr_trocken: true, h_2_o_umrechnung: false, k_wert: 1.2 },
  },
]);

describe("allgemeine Aufbereitung strukturierter Werte", () => {
  it("lesbare Bezeichnungen", () => {
    expect(humanizeKey("fr_trocken")).toBe("Fr trocken");
    expect(humanizeKey("sio_2")).toBe("SiO₂");
    expect(humanizeKey("al_2_o_3")).toBe("Al₂O₃");
    expect(labelFromPath(["gas_einstellungen", "k_wert"])).toBe("K wert");
    expect(labelFromPath(["werte", "2"])).toBe("Werte 2");
  });

  it("leerer Block (alles null) -> keine Werte, keine Einstellungen", () => {
    const a = analyzeStructured(parseStructuredText(emptyBlock));
    expect(a.values).toHaveLength(0);
    expect(a.config).toHaveLength(0);
    expect(classifyInternalResult(val({ remarks: emptyBlock }))).toBe("empty");
  });

  it("Einstellungen/Schalter sind keine Messwerte, echte Werte schon", () => {
    const a = analyzeStructured(parseStructuredText(filledBlock));
    expect(a.values.map((l) => l.path.join("."))).toEqual(["aktivitaet_bq", "masse_g", "bemerkung"]);
    expect(a.config.map((l) => l.path.join("."))).toEqual([
      "gas_einstellungen.fr_trocken", "gas_einstellungen.h_2_o_umrechnung", "gas_einstellungen.k_wert",
    ]);
  });

  it("Zeilen statt Rohtext: Zahlen als Zahl, Text als Text, Leeres entfällt", () => {
    const r = val({ id: "b", remarks: filledBlock });
    const { visible, details } = prepareDisplayResults([r]);
    const by = Object.fromEntries(visible.map((x) => [x.result_name, x]));
    expect(by.aktivitaet_bq.value).toBe(12.5);
    expect(by.masse_g.value).toBe(3.4);
    expect(by.bemerkung.remarks).toBe("ok");
    expect(by.leer).toBeUndefined();
    expect(visible.every((x) => !(x.remarks ?? "").includes(":") && !(x.remarks ?? "").startsWith("{"))).toBe(true);
    expect(details.map((d) => d.value).sort()).toEqual(["1.2", "ja", "nein"].sort());
  });

  it("Einheiten kommen aus dem Importprotokoll, falls vorhanden", () => {
    const proto = JSON.stringify({ imported_at: "2026-11-01T00:00:00Z", profile: "RFA", units: { sio_2: "%" } });
    const r = val({ remarks: JSON.stringify([{ sio_2: 5.1, messdatenimport_2: proto }]) });
    const [row] = expandStructuredResult(r, [r])!.rows;
    expect(row.unit).toBe("%");
    expect(row.display_label).toBe("SiO₂");
  });

  it("mehrere Einträge werden zu Durchläufen", () => {
    const r = val({ remarks: JSON.stringify([{ a: 1 }, { a: 2 }]) });
    const rows = expandStructuredResult(r, [r])!.rows;
    expect(rows.map((x) => [x.instance_key, x.instance_label, x.value])).toEqual([
      ["__entry1", "Eintrag 1", 1],
      ["__entry2", "Eintrag 2", 2],
    ]);
  });

  it("verschachtelte JSON-Texte, einfache Listen und Objekte werden nie roh gezeigt", () => {
    const inner = JSON.stringify({ x: 1, y: null });
    const r = val({ remarks: JSON.stringify({ gruppe: inner, tags: ["a", "b"] }) });
    const rows = expandStructuredResult(r, [r])!.rows;
    expect(rows.map((x) => [x.result_name, x.value ?? x.remarks])).toEqual([["gruppe.x", 1], ["tags", "a, b"]]);
  });

  it("zählt leere/Einstellungs-Blöcke nicht als Messwerte und verliert keinen Datensatz", () => {
    const rs = [val({ id: "e", remarks: emptyBlock }), val({ id: "v", remarks: filledBlock }), val({ id: "n", value: 3 })];
    const { visible, hiddenOther } = splitInternalResults(rs);
    expect(visible.map((x) => x.id)).toEqual(["v", "n"]);
    expect(hiddenOther.map((x) => x.id)).toEqual(["e"]);
    const rec = {
      measurementId: "m", orderId: "o", orderNumber: "A", orderDisplayNumber: "A", sampleId: "s", sampleNumber: "P",
      sampleName: "", originalSampleNumber: null, projectName: "", createdAt: "2026-11-01T00:00:00Z", completedAt: null,
      results: rs,
    } as unknown as SampleMeasurementRecord;
    const [g] = groupRecordsBySample([rec]);
    expect(g.interimCount).toBe(2); // gefüllter Block + Zahlenwert
  });
});

describe("Wertetabelle", () => {
  const measurement = (results: SampleResultValue[]) =>
    ({ measurementId: "m", serviceName: "Aktivitätsmessung", measurementNumber: "M1", results }) as unknown as SampleMeasurementRecord;

  it("leerer Block: kurze graue Zeile statt Rohtext", () => {
    const { container } = render(
      <TooltipProvider><SampleMeasurementResultsTable measurement={measurement([val({ remarks: emptyBlock })])} /></TooltipProvider>,
    );
    expect(screen.getByText(/keine Werte erfasst/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/gas_einstellungen|fr_trocken|k_wert: null/);
  });

  it("gefüllter Block: Zeilen mit Bezeichnung, Einstellungen nur unter Details", () => {
    const { container } = render(
      <TooltipProvider><SampleMeasurementResultsTable measurement={measurement([val({ remarks: filledBlock })])} /></TooltipProvider>,
    );
    expect(screen.getByText("Aktivitaet bq")).toBeTruthy();
    expect(screen.getByText("12,5")).toBeTruthy();
    expect(container.textContent).not.toMatch(/gas_einstellungen|fr_trocken/);
    fireEvent.click(screen.getByText(/Einstellungen \(3\)/));
    expect(screen.getByText(/Fr trocken/)).toBeTruthy();
    expect(screen.getByText("ja")).toBeTruthy();
  });
});

describe("Ergebnisübersicht", () => {
  it("offizieller Block wird in einzelne Werte zerlegt, leere Blöcke zählen nicht als Werte", () => {
    const sample = {
      sampleKey: "P", sampleNumber: "P", sampleName: "",
      measurements: [
        {
          measurementId: "m", serviceName: "Aktivität",
          results: [
            val({ remarks: filledBlock, is_official: true }),
            val({ id: "x", remarks: emptyBlock, is_official: true }),
          ],
        },
      ],
    } as unknown as SampleGroup;
    const order = { orderKey: "o", orderId: "o", displayNumber: "A", projectNames: [], samples: [sample] } as unknown as OrderGroup;
    const [sec] = buildOrderComparison(order);
    expect(sec.columns.map((c) => c.label)).toEqual(["Aktivitaet bq", "Masse g", "Bemerkung"]);
    expect(sec.officialCount).toBe(3);
    const cell = sec.rows[0].runs[0].cells;
    expect(Object.values(cell).flat()).toEqual([12.5, 3.4, "ok"]);
  });
});

describe("Bezeichnungen: Formel nur bei echten chemischen Schlüsseln", () => {
  it.each(["lauf_1", "messung_2", "probe_2", "gas_2", "fr_trocken", "k_wert", "h_2_o_umrechnung"])(
    "%s bleibt ein normales Wort",
    (key) => {
      expect(humanizeKey(key)).toMatch(/^[A-ZÄÖÜ][a-zäöüß0-9 ]+$/);
    },
  );
});
