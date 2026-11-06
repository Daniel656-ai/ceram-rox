import { describe, it, expect, beforeEach } from "vitest";
import { defaultDraft, defaultLayout, moveModule, sanitizeDraft, updateModule, visibleModules } from "../config";
import { deleteTemplate, loadTemplates, renameTemplate, saveTemplate, templateStorageKey } from "../templates";
import { buildReport } from "../build";
import { columnWidths, createReportPdf } from "../pdf";

const orderA = {
  id: "A", order_number: "SW-260001", customer_name: "Kunde A",
  projects: { project_number: "P1", project_name: "Projekt A" },
  order_samples: [{ samples: { id: "s1", sample_number: "P260001", sample_name: "Wabe A", description: "" } }],
  order_measurements: [{
    measurement_services: { service_name: "RFA" }, samples: { sample_number: "P260001" },
    measurement_parameters: [
      { parameter_name: "Temperatur", parameter_value: "350", unit: "°C" },
      { parameter_name: "Leer", parameter_value: "", unit: null },
      { parameter_name: "Trocknen", parameter_value: "true", unit: null },
    ],
  }],
};
const orderB = { ...orderA, id: "B", order_number: "SW-260002", customer_name: "Kunde B", order_samples: [{ samples: { id: "s9", sample_number: "P260009", sample_name: "Wabe B" } }], order_measurements: [] };

const rows: any[] = [
  {
    id: "m1", sample_id: "s1", service_id: "rfa", status: "completed", measurement_services: { service_name: "RFA" },
    samples: { sample_number: "P260001", sample_name: "Wabe A" },
    measurement_results: [
      { id: "r1", result_name: "V2O5", value: 0, unit: "%", is_official: true },
      { id: "r2", result_name: "TiO2", value: "81.5", unit: "%", is_official: true },
      { id: "r3", result_name: "WO3", value: "9.9", unit: "%", is_official: false },
      { id: "r4", result_name: "MoO3", value: null, unit: "%", is_official: true },
    ],
  },
  {
    id: "m2", sample_id: "s1", service_id: "nox", status: "completed", measurement_services: { service_name: "NOx Aktivität" },
    samples: { sample_number: "P260001", sample_name: "Wabe A" },
    measurement_results: [{ id: "r5", result_name: "Umsatz", value: "92.1", unit: "%", is_official: true }],
  },
];

const section = (r: ReturnType<typeof buildReport>, key: string) => r.sections.find((s) => s.key === key)!;

beforeEach(() => localStorage.clear());

describe("persönliche Vorlagen", () => {
  it("speichert und lädt", () => {
    const layout = updateModule(defaultLayout(), "objective", { standardText: { de: "Ziel", en: "Objective" } });
    saveTemplate("u1", "Sales", layout);
    const list = loadTemplates("u1");
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Sales");
    expect(list[0].layout.modules.find((m) => m.key === "objective")!.standardText).toEqual({ de: "Ziel", en: "Objective" });
  });
  it("trennt Benutzer", () => {
    saveTemplate("u1", "A", defaultLayout());
    expect(loadTemplates("u2")).toEqual([]);
    expect(loadTemplates(null)).toEqual([]);
  });
  it("umbenennen und löschen", () => {
    const [t] = saveTemplate("u1", "A", defaultLayout());
    expect(renameTemplate("u1", t.id, "B")[0].name).toBe("B");
    expect(deleteTemplate("u1", t.id)).toEqual([]);
  });
  it("enthält keine Auftrags- oder Messdaten, auch nicht bei verunreinigter Eingabe", () => {
    const dirty: any = { ...defaultLayout(), orderNumber: "SW-1", results: [1], modules: defaultLayout().modules.map((m) => ({ ...m, value: 42, customer: "X" })) };
    saveTemplate("u1", "A", dirty);
    const stored = localStorage.getItem(templateStorageKey("u1"))!;
    expect(stored).not.toMatch(/SW-1|results|"value"|customer|orderTexts|author/);
  });
  it("Vorlage in anderem Auftrag lädt dessen aktuelle Daten", () => {
    const [tpl] = saveTemplate("u1", "A", defaultLayout());
    const draft = { ...defaultDraft(), layout: tpl.layout };
    const r = buildReport({ order: orderB, resultRows: [], draft });
    const cover = section(r, "cover").fields.map((f) => f.value).join("|");
    expect(cover).toContain("SW-260002");
    expect(cover).not.toContain("SW-260001");
    expect(section(r, "chemical").tables).toEqual([]);
  });
});

describe("Konfiguration", () => {
  it("Reihenfolge und Sichtbarkeit bestimmen die Abschnitte", () => {
    let l = moveModule(defaultLayout(), 7, 0);
    l = updateModule(l, "samples", { visible: false });
    const r = buildReport({ order: orderA, resultRows: rows, draft: { ...defaultDraft(), layout: l } });
    expect(r.sections[0].key).toBe("assessment");
    expect(r.sections.map((s) => s.key)).not.toContain("samples");
    expect(visibleModules(l)).toHaveLength(7);
  });
  it("Entwurf wird bereinigt", () => {
    const d = sanitizeDraft({ lang: "en", orderTexts: { objective: "x", bogus: "y" }, values: [1] });
    expect(d.lang).toBe("en");
    expect(d.orderTexts).toEqual({ objective: "x" });
    expect((d as any).values).toBeUndefined();
  });
});

describe("Sprache", () => {
  const layout = updateModule(defaultLayout(), "objective", { standardText: { de: "Zielsetzung DE", en: "" } });
  it("getrennte Standardtexte – keine Übernahme der deutschen Fassung", () => {
    const de = buildReport({ order: orderA, resultRows: [], draft: { ...defaultDraft(), lang: "de", layout } });
    const en = buildReport({ order: orderA, resultRows: [], draft: { ...defaultDraft(), lang: "en", layout } });
    expect(section(de, "objective").standardText).toBe("Zielsetzung DE");
    expect(section(en, "objective").standardText).toBe("");
  });
  it("auftragsspezifische Texte unverändert", () => {
    const draft = { ...defaultDraft(), lang: "en" as const, orderTexts: { assessment: "Deutscher Text bleibt." } };
    expect(section(buildReport({ order: orderA, resultRows: [], draft }), "assessment").orderText).toBe("Deutscher Text bleibt.");
  });
  it("statische Elemente übersetzt", () => {
    const de = buildReport({ order: orderA, resultRows: rows, draft: { ...defaultDraft(), lang: "de" } });
    const en = buildReport({ order: orderA, resultRows: rows, draft: { ...defaultDraft(), lang: "en" } });
    expect(section(de, "chemical").heading).toBe("Chemische Analyse / RFA");
    expect(section(en, "chemical").heading).toBe("Chemical Analysis / XRF");
    expect(section(en, "chemical").tables[0].columns).toContain("Unit");
    expect(section(en, "requester_specs").tables[0].rows.find((r) => r[2] === "Trocknen")![3]).toBe("Yes");
    expect(en.title).toBe("Test Report");
  });
});

describe("Ergebnisdaten", () => {
  const r = buildReport({ order: orderA, resultRows: rows, draft: defaultDraft() });
  const chem = section(r, "chemical").tables[0].rows;
  it("nur is_official === true", () => {
    expect(chem.map((x) => x[2])).not.toContain("WO3");
  });
  it("0 ist gültig", () => {
    expect(chem.find((x) => x[2] === "V2O5")![3]).toBe("0");
  });
  it("fehlender Wert bleibt leer", () => {
    expect(chem.find((x) => x[2] === "MoO3")![3]).toBe("");
  });
  it("Zuordnung Aktivität / leere Module", () => {
    expect(section(r, "activity").tables[0].rows[0][2]).toBe("Umsatz");
    expect(section(r, "optical").empty).toBe(true);
  });
  it("leere Vorgaben werden nicht ausgegeben", () => {
    expect(section(r, "requester_specs").tables[0].rows.map((x) => x[2])).not.toContain("Leer");
  });
});

describe("PDF", () => {
  it("Spaltenbreiten füllen die Inhaltsbreite", () => {
    const w = columnWidths({ columns: ["a", "b", "c"], rows: [["x".repeat(80), "y", "z"]] }, 500);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(500);
    expect(Math.min(...w)).toBeGreaterThan(50);
  });
  it("lange Tabellen erzeugen Seitenumbrüche (DE und EN)", async () => {
    const many = [{ ...rows[0], measurement_results: Array.from({ length: 150 }, (_, i) => ({ id: `x${i}`, result_name: `E${i}`, value: i, unit: "%", is_official: true })) }];
    for (const lang of ["de", "en"] as const) {
      const report = buildReport({ order: orderA, resultRows: many, draft: { ...defaultDraft(), lang } });
      const pdf = await createReportPdf(report);
      expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
    }
  });
});
