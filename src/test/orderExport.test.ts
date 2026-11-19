import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { buildOrderExport, exportFileName, uniqueSheetName, type ExportSheet } from "@/lib/orderExport/buildOrderExport";
import { columnWidths, toWorkbook } from "@/lib/orderExport/toWorkbook";
import { emptyPrecisionDefinitions, type PrecisionDefinitions } from "@/lib/resultDisplayPrecision";
import type { SampleMeasurementRecord, SampleResultValue } from "@/lib/results/sampleResultsAggregation";

const res = (label: string, value: number | null, o: Partial<SampleResultValue> = {}): SampleResultValue => ({
  id: crypto.randomUUID(), result_name: label.toLowerCase(), value, unit: "%", temperature_range_from: null,
  temperature_range_to: null, temperature_unit: null, remarks: null, measured_at: null, display_label: label,
  is_official: true, instance_key: null, instance_label: null, instance_context: null, ...o,
});

const rec = (
  sample: { id: string | null; no: string; name?: string },
  service: string,
  results: SampleResultValue[],
  o: Partial<SampleMeasurementRecord> = {},
): SampleMeasurementRecord =>
  ({
    measurementId: crypto.randomUUID(), measurementNumber: "M1", orderId: "o1", orderNumber: "MWI260003",
    orderDisplayNumber: "MWI260003", orderType: "customer", projectNumber: "", projectName: "", sampleId: sample.id,
    sampleNumber: sample.no, sampleName: sample.name ?? "", originalSampleNumber: null, serviceId: `svc-${service}`,
    serviceName: service, serviceCategory: "", assignedToId: null, assignedToName: "Erika Beispiel",
    createdById: "u", createdByName: "Max Muster", status: "completed", completedAt: "2026-11-10T09:00:00Z",
    createdAt: "2026-11-01T09:00:00Z", remarks: "", results, orderStatus: "completed", orderWorkflowStatus: null,
    orderCreatedAt: "2026-10-28T08:00:00Z", ...o,
  }) as SampleMeasurementRecord;

const EXPORT_DATE = new Date("2026-11-18T12:00:00Z");
const run = (extra: Partial<Parameters<typeof buildOrderExport>[0]> = {}, records?: SampleMeasurementRecord[]) =>
  buildOrderExport({
    records: records ?? defaultRecords(),
    statusLabel: "Abgeschlossen",
    precision: emptyPrecisionDefinitions,
    exportDate: EXPORT_DATE,
    ...extra,
  })!;

function defaultRecords(): SampleMeasurementRecord[] {
  return [
    // P260039: RFA mit drei Durchläufen (Lauf 1–3), BET mit einem Wert, ein vorläufiger Wert
    rec({ id: "s1", no: "P260039", name: "Fliese weiß" }, "RFA", [
      res("SiO2", 7.18, { instance_key: "a", instance_label: "Lauf 1" }),
      res("SiO2", 7.3, { instance_key: "b", instance_label: "Lauf 2" }),
      res("SiO2", 6.34, { instance_key: "c", instance_label: "Lauf 3" }),
      res("Al2O3", 1, { instance_key: "a", instance_label: "Lauf 1" }),
      res("Al2O3", 2, { instance_key: "b", instance_label: "Lauf 2" }),
      res("Al2O3", 3, { instance_key: "c", instance_label: "Lauf 3" }),
    ]),
    rec({ id: "s1", no: "P260039", name: "Fliese weiß" }, "DIL", [res("Vorläufig", 99, { is_official: false })]),
    rec({ id: "s1", no: "P260039", name: "Fliese weiß" }, "BET", [
      res("Spezifische Oberfläche - BET", 12.3456, { unit: "m²/g" }),
    ]),
    // P260042: nur vorläufige Werte
    rec({ id: "s2", no: "P260042", name: "Glasur A" }, "RFA", [res("SiO2", 5, { is_official: false })]),
  ];
}

const sheetByName = (sheets: ExportSheet[], name: string) => sheets.find((s) => s.name === name)!;
const cellText = (sheet: ExportSheet) => sheet.rows.flat().map((c) => c.v).filter((v) => typeof v === "string") as string[];

describe("Auftrags-Excel: Aufbau", () => {
  it("Blatt Übersicht zuerst, danach je Probe ein Blatt mit der Probennummer; keine Messart-Blätter", () => {
    const { sheets } = run();
    expect(sheets.map((s) => s.name)).toEqual(["Übersicht", "P260039", "P260042"]);
  });

  it("Übersicht: Auftrags-, Status-, Datums- und Bemerkungszeilen, Projekt nur wenn vorhanden", () => {
    const ov = sheetByName(run().sheets, "Übersicht");
    const kv = Object.fromEntries(ov.rows.slice(0, 9).filter((r) => r.length >= 2).map((r) => [String(r[0].v), r[1]]));
    expect(kv["Auftrag"].v).toBe("MWI260003");
    expect(kv["Projekt"]).toBeUndefined();
    expect(kv["Auftraggeber"].v).toBe("Max Muster");
    expect(kv["Messdienstleister"].v).toBe("Erika Beispiel");
    expect(kv["Auftragsdatum"].v).toBeInstanceOf(Date);
    expect(kv["Auftragsstatus"].v).toBe("Abgeschlossen");
    expect(kv["Bemerkung"].v).toBe("–");
    expect(String(kv["Hinweis"].v)).toMatch(/vorläufige Werte/);

    const withProject = run({}, defaultRecords().map((r) => ({ ...r, projectName: "Projekt X", remarks: "Eilig" })));
    const ov2 = sheetByName(withProject.sheets, "Übersicht");
    expect(ov2.rows.some((r) => r[0]?.v === "Projekt" && r[1]?.v === "Projekt X")).toBe(true);
    expect(ov2.rows.some((r) => r[0]?.v === "Bemerkung" && r[1]?.v === "Eilig")).toBe(true);
  });

  it("Übersicht: Probenliste mit Anzahl Werte je Messart, Probe mit nur vorläufigen Werten wird mitgezählt", () => {
    const ov = sheetByName(run().sheets, "Übersicht");
    const headerIdx = ov.rows.findIndex((r) => r[0]?.v === "Probenbezeichnung");
    const header = ov.rows[headerIdx].map((c) => c.v);
    expect(header.slice(0, 3)).toEqual(["Probenbezeichnung", "Probennummer", "Abgeschlossen am"]);
    expect(header.slice(3)).toEqual(["BET (Anzahl Werte)", "DIL (Anzahl Werte)", "RFA (Anzahl Werte)"]);
    const p1 = ov.rows[headerIdx + 1].map((c) => c.v);
    expect(p1[0]).toBe("Fliese weiß");
    expect(p1.slice(3)).toEqual([1, 1, 6]);
    const p2 = ov.rows[headerIdx + 2].map((c) => c.v);
    expect(p2[0]).toBe("Glasur A");
    expect(p2.slice(3)).toEqual(["–", "–", 1]);
  });

  it("Probe mit nur vorläufigen Werten bekommt ein Blatt mit Status „vorläufig“", () => {
    const sh = sheetByName(run().sheets, "P260042");
    expect(cellText(sh)).toContain("vorläufig");
  });

  it("Probe ganz ohne Werte bekommt trotzdem ein Blatt mit Hinweis", () => {
    const recs = [rec({ id: "s3", no: "P3" }, "RFA", [])];
    const sh = sheetByName(run({}, recs).sheets, "P3");
    expect(cellText(sh)).toContain("keine Werte");
  });

  it("Dateiname: Auftragsnummer_Ergebnisse_Datum.xlsx", () => {
    expect(run().fileName).toBe("MWI260003_Ergebnisse_2026-11-18.xlsx");
    expect(exportFileName("FG 26/01", EXPORT_DATE)).toBe("FG_26-01_Ergebnisse_2026-11-18.xlsx");
  });

  it("Blattnamen: gültig (≤31 Zeichen, keine Sonderzeichen) und eindeutig", () => {
    const used = new Set<string>(["übersicht"]);
    expect(uniqueSheetName("P1/2:[x]*?", used)).toBe("P1-2--x---");
    expect(uniqueSheetName("P1/2:[x]*?", used)).toBe("P1-2--x--- (2)");
    expect(uniqueSheetName("Übersicht", used)).toBe("Übersicht (2)");
    const long = uniqueSheetName("A".repeat(50), used);
    expect(long.length).toBeLessThanOrEqual(31);
    expect(uniqueSheetName("A".repeat(50), used).length).toBeLessThanOrEqual(31);
  });
});

describe("Auftrags-Excel: Probenblatt", () => {
  const p1 = () => sheetByName(run().sheets, "P260039");

  it("Kopf mit Probe, Bezeichnung und Auftrag", () => {
    const rows = p1().rows;
    expect(rows[0].map((c) => c.v)).toEqual(["Probenbezeichnung", "Fliese weiß"]);
    expect(rows[1].map((c) => c.v)).toEqual(["Probennummer", "P260039"]);
    expect(rows[2].map((c) => c.v)).toEqual(["Auftrag", "MWI260003"]);
  });

  it("je Messart eine Tabelle untereinander; Einheit im Spaltenkopf; Durchläufe als eigene Zeilen; Ø als feste Zahl", () => {
    const rows = p1().rows.map((r) => r.map((c) => c.v));
    const rfa = rows.findIndex((r) => r[0] === "RFA");
    expect(rows[rfa + 1]).toEqual(["Lauf", "SiO₂ [%]", "Al₂O₃ [%]", "Status"]);
    expect(rows.slice(rfa + 2, rfa + 5)).toEqual([
      ["Lauf 1", 7.18, 1, "offiziell"],
      ["Lauf 2", 7.3, 2, "offiziell"],
      ["Lauf 3", 6.34, 3, "offiziell"],
    ]);
    const mean = rows[rfa + 5];
    expect(mean[0]).toBe("Ø (n=3)");
    expect(mean[1]).toBeCloseTo((7.18 + 7.3 + 6.34) / 3, 10);
    expect(mean[2]).toBeCloseTo(2, 10);
    const bet = rows.findIndex((r) => r[0] === "BET");
    expect(bet).toBeLessThan(rfa); // Messarten alphabetisch (BET vor RFA)
    expect(rows[bet + 1]).toEqual(["Lauf", "Spezifische Oberfläche - BET [m²/g]", "Status"]);
    expect(rows[bet + 2]).toEqual(["1", 12.3456, "offiziell"]);
    // einzelner Durchlauf: kein Mittelwert (nächste Zeile ist leer, danach beginnt DIL)
    expect(rows[bet + 3].every((v) => v === null || v === undefined)).toBe(true);
    expect(rows[bet + 4][0]).toBe("DIL");
  });

  it("vorläufige Werte erscheinen mit Status „vorläufig“", () => {
    const rows = p1().rows.map((r) => r.map((c) => c.v));
    const dil = rows.findIndex((r) => r[0] === "DIL");
    expect(rows[dil + 1]).toEqual(["Lauf", "Vorläufig [%]", "Status"]);
    expect(rows[dil + 2]).toEqual(["1", 99, "vorläufig"]);
  });

  it("kein Mittelwert, wenn die Durchläufe keine Wiederholungen sind (unterschiedlicher Kontext)", () => {
    const recs = [
      rec({ id: "s1", no: "P1" }, "RFA", [
        res("SiO2", 1, { instance_key: "a", instance_context: { Messstelle: "A" } }),
        res("SiO2", 2, { instance_key: "b", instance_context: { Messstelle: "B" } }),
      ]),
    ];
    const rows = sheetByName(run({}, recs).sheets, "P1").rows.map((r) => r.map((c) => c.v));
    expect(rows.some((r) => String(r[0]).startsWith("Ø"))).toBe(false);
    // Messkontext als Spalte
    const rfa = rows.findIndex((r) => r[0] === "RFA");
    expect(rows[rfa + 1]).toEqual(["Lauf", "Messkontext", "SiO₂ [%]", "Status"]);
    expect(rows[rfa + 2][1]).toBe("Messstelle: A");
  });

  it("mehrere Werte derselben Spalte ohne Durchlauf-Kennung werden Zeilen (kein „/“ in Zellen)", () => {
    const recs = [rec({ id: "s1", no: "P1" }, "RFA", [res("SiO2", 7.18), res("SiO2", 7.3), res("SiO2", 6.34)])];
    const rows = sheetByName(run({}, recs).sheets, "P1").rows.map((r) => r.map((c) => c.v));
    const rfa = rows.findIndex((r) => r[0] === "RFA");
    expect(rows.slice(rfa + 2, rfa + 5).map((r) => r[1])).toEqual([7.18, 7.3, 6.34]);
    expect(rows.flat().some((v) => typeof v === "string" && v.includes(" / "))).toBe(false);
  });
});

describe("Auftrags-Excel: keine Rohtexte, nur lesen", () => {
  it("Blöcke werden zu Werten, Import-Protokolle, Einstellungen und JSON erscheinen nicht", () => {
    const protocol = JSON.stringify({ imported_at: "2026-10-29T08:00:00Z", profile: "RFA", units: { sio_2: "%" } });
    const block = JSON.stringify([{ sio_2: 5.16, messdatenimport_2: protocol, gas_einstellungen: { k_wert: null, fr_trocken: null } }]);
    const settings = JSON.stringify([{ gas_einstellungen: { fr_trocken: true, k_wert: 1.2 } }]);
    const empty = JSON.stringify([{ gas_einstellungen: { fr_trocken: null } }]);
    const recs = [
      rec({ id: "s1", no: "P1" }, "RFA", [
        res("RFA-Block", null, { remarks: block, result_name: "form:f:block" }),
        res("Einstellungen", null, { remarks: settings, result_name: "form:f:settings" }),
        res("Leer", null, { remarks: empty, result_name: "form:f:empty" }),
      ]),
    ];
    const out = run({}, recs);
    const texts = out.sheets.flatMap(cellText);
    expect(texts.join("\n")).not.toMatch(/imported_at|gas_einstellungen|k_wert|fr_trocken|messdatenimport|\{|\[\{/);
    const rows = sheetByName(out.sheets, "P1").rows.map((r) => r.map((c) => c.v));
    expect(rows.some((r) => r.includes(5.16))).toBe(true);
    expect(rows.flat()).not.toContain(1.2);
  });
});

describe("Auftrags-Excel: Zahlen und Format in der echten Datei", () => {
  const precision: PrecisionDefinitions = {
    ...emptyPrecisionDefinitions,
    serviceFields: [{ service_id: "svc-BET", field_key: "spezifische oberfläche - bet", decimal_places: 2 }],
  };

  const roundtrip = (sheets: ExportSheet[]) => {
    const wb = toWorkbook(sheets);
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx", cellDates: true });
    return XLSX.read(buf, { type: "array", cellDates: true, cellNF: true });
  };

  it("Zahlen sind echte Zahlen mit voller Genauigkeit; Anzeige-Nachkommastellen als Zahlenformat", () => {
    const wb = roundtrip(run({ precision }).sheets);
    const ws = wb.Sheets["P260039"];
    const cells = Object.entries(ws).filter(([k]) => !k.startsWith("!")) as [string, XLSX.CellObject][];
    const bet = cells.find(([, c]) => c.v === 12.3456)!;
    expect(bet[1].t).toBe("n");
    expect(bet[1].v).toBe(12.3456);
    expect(bet[1].z).toBe("0.00");
    // RFA ohne hinterlegte Nachkommastellen: keine Formatvorgabe, Zahl bleibt Zahl
    const si = cells.find(([, c]) => c.v === 7.18)!;
    expect(si[1].t).toBe("n");
  });

  it("Datumswerte sind echte Datumszellen; Blattnamen und Reihenfolge bleiben erhalten", () => {
    const wb = roundtrip(run().sheets);
    expect(wb.SheetNames).toEqual(["Übersicht", "P260039", "P260042"]);
    const ov = wb.Sheets["Übersicht"];
    const dates = Object.entries(ov).filter(([k, c]) => !k.startsWith("!") && (c as XLSX.CellObject).t === "d");
    expect(dates.length).toBeGreaterThanOrEqual(2); // Auftragsdatum, Exportdatum (+ Abgeschlossen am)
  });

  it("Spaltenbreiten richten sich nach dem Inhalt (begrenzt)", () => {
    const widths = columnWidths(run().sheets[0].rows);
    expect(widths.every((w) => w >= 8 && w <= 42)).toBe(true);
    const wb = toWorkbook(run().sheets);
    expect(wb.Sheets["Übersicht"]["!cols"]?.length).toBeGreaterThan(0);
  });
});
