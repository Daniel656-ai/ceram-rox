import { describe, it, expect, vi } from "vitest";
const textSpy = vi.hoisted(() => vi.fn());
vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf")>();
  return {
    ...actual,
    jsPDF: class extends actual.jsPDF {
      constructor() {
        super({ unit: "mm", format: "a4" });
        const original = this.text;
        this.text = vi.fn((...args: Parameters<typeof this.text>) => {
          textSpy(...args);
          return Reflect.apply(original, this, args);
        });
      }
    },
  };
});
import { buildM3PdfModel, renderM3Pdf } from "../pdfExport";

const values = (n: number) => ({
  release_label: "FF-1 · Rev1",
  order_number: "A123",
  lab_tests: "Geo, NOx, Bench NOx",
  regular_element_total: 430,
  bench_extra_pieces: 1,
  total_element_count: 431,
  m3_rows: Array.from({ length: n }, (_, i) => ({ volume_m3: i + 1, element_count: 10 * (i + 1), row_labor_kat: 2 })),
});

describe("m³-PDF", () => {
  it("enthält alle Zeilen, Mengen, TEST und Original-Hinweis", () => {
    const m = buildM3PdfModel(values(3), { notices: ["n1"], testRowIndex: 1 });
    expect(m.rows).toHaveLength(3);
    expect(m.rows[1].test).toBe(true);
    expect(m.rows[0].pieces).toBe("00010");
    expect(m.totals).toBe("Reguläre Elementanzahl: 430 Stk · Bench-Zusatz: 1 Stk");
    expect(m.testNotice).toContain("m³-Zeile 2");
    expect(m.originalNote).toContain("Originalversion");
    expect(m.header.find(([k]) => k === "Auftrag")?.[1]).toBe("A123");
  });
  it("mehrseitig ohne Zeilenverlust", () => {
    const doc = renderM3Pdf(buildM3PdfModel(values(120), { notices: [], testRowIndex: null }));
    expect(doc.getNumberOfPages()).toBeGreaterThan(2);
  });
  it("tatsächliches PDF enthält führende Nullen, Elementnummer und aktive Chargenfarben", () => {
    const m = buildM3PdfModel({ m3_rows: [{ element_count: 970, row_responsible: "AB" }] }, { notices: [], testRowIndex: 0 });
    expect(m.rows[0].pieces).toBe("00970");
    const pdf = renderM3Pdf(m).output();
    expect(pdf).toContain("00970");
    const renderedText = Array.from(pdf.matchAll(/\(([^()]*)\) Tj/g), (match) => match[1]).join("");
    expect(renderedText).toContain("Elementnummer");
    expect(pdf).toContain("Gesamte Charge");
    expect(pdf).toContain("1. 0.92 0.23 rg");
    expect(pdf).toContain("0.827 0.184 0.184 rg");
  });
  it.each(["links", "rechts"])("zweispaltiger Kopf mit längerer Spalte %s: echte X/Y-Geometrie", (longer) => {
    const m = buildM3PdfModel(values(2), { notices: [], testRowIndices: [0, 1] });
    // Kurze/mehrzeilige Inhalte erzwingen beide Varianten der längeren Kopfspalte.
    m.header = [["Links", longer === "links" ? "L1\nL2\nL3\nL4\nL5\nL6\nL7\nL8" : "L1"]];
    m.calc = [["Rechts", longer === "rechts" ? "R1\nR2\nR3\nR4\nR5\nR6\nR7\nR8" : "R1"]];
    m.labTests = "Labor-Ende";
    textSpy.mockClear();
    const pdf = renderM3Pdf(m).output();
    const renderedText = Array.from(pdf.matchAll(/\(([^()]*)\) Tj/g), (match) => match[1]).join("");
    expect(renderedText).toContain("Auftragsdetails");
    expect(renderedText).toContain("Berechnungen");
    expect(renderedText).toContain("Labormessungen");
    // Reihenfolge im Kopf: Berechnungen vor Labormessungen; Tabelle erst nach dem Kopf.
    expect(renderedText.indexOf("Berechnungen")).toBeLessThan(renderedText.indexOf("Labormessungen"));
    expect(renderedText.indexOf("Labormessungen")).toBeLessThan(renderedText.indexOf("m³-Tabelle"));
    // Mehrfach-TEST-Hinweis im Chargenblock.
    expect(m.testNotice).toContain("m³-Zeilen 1 und 2");
    expect(pdf).toContain("Gesamte Charge");
    const calls = textSpy.mock.calls.map(([text, x, y]) => ({
      text: Array.isArray(text) ? text.join("\n") : String(text), x: Number(x), y: Number(y),
      lines: Array.isArray(text) ? text.length : 1,
    }));
    const find = (label: string) => {
      const call = calls.find((c) => c.text.startsWith(label));
      if (!call) throw new Error(`Fehlender Zeichenaufruf: ${label}`);
      return call;
    };
    const left = find("Auftragsdetails"), right = find("Berechnungen");
    expect(left.x).toBe(14);
    expect(right.x).toBe(116);
    expect(left.y).toBe(right.y);
    const leftValue = find("L1"), rightEnd = find("Labor-Ende");
    // colPairs verwendet 5 mm pro Textzeile; Grundlinie liegt 4 mm unter cy.
    const leftBottom = leftValue.y - 4 + leftValue.lines * 5;
    const rightBottom = rightEnd.y - 4 + rightEnd.lines * 5;
    expect(longer === "links" ? leftBottom > rightBottom : rightBottom > leftBottom).toBe(true);
    const charge = find("Gesamte Charge");
    // 3 mm Abstand zum längeren Kopf, 2 mm Zellrand und 12 pt * 0.35 Grundlinienversatz.
    expect(charge.y).toBeCloseTo(Math.max(leftBottom, rightBottom) + 3 + 2 + 12 * 0.35);
    expect(charge.y).toBeGreaterThan(Math.max(leftBottom, rightBottom));
    expect(find("m³-Tabelle").y).toBeGreaterThan(charge.y);
    expect(find(m.totals).y).toBeGreaterThan(find("m³-Tabelle").y);
    expect(find(m.originalNote.slice(0, 20)).y).toBeGreaterThan(find(m.totals).y);
  });
  it("neutrales PDF enthält keine aktive Chargenfüllung und keine ungültige Nummer", () => {
    const m = buildM3PdfModel({ m3_rows: [{ element_count: -1 }, { element_count: 970, element_number: null }] }, { notices: [], testRowIndex: null });
    expect(m.rows.map((r) => r.pieces)).toEqual(["—", "—"]);
    expect(renderM3Pdf(m).output()).not.toContain("1. 0.92 0.23 rg");
  });
});
