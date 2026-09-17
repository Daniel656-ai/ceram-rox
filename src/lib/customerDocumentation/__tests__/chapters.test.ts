import { describe, expect, it } from "vitest";
import { buildCustomerDocumentation, currentRelease } from "../chapters";
import { detectAnalysisKey, chapterForService } from "../serviceChapters";
import { customerDocumentationCsv } from "../export";

const order = {
  order_number: "M250001",
  customer_name: "Muster GmbH",
  reference_number: "CERAM-4711",
  created_at: "2026-02-01T08:00:00Z",
  projects: { project_number: "P-1", project_name: "Anlage Nord" },
  order_measurements: [],
};

function resultRow(serviceName: string, sampleNumber: string, official = true) {
  return {
    id: `m-${serviceName}-${sampleNumber}`,
    sample_id: `s-${sampleNumber}`,
    service_id: `svc-${serviceName}`,
    status: "completed",
    measurement_services: { id: `svc-${serviceName}`, service_name: serviceName },
    samples: { id: `s-${sampleNumber}`, sample_number: sampleNumber, sample_name: "Probe" },
    measurement_results: [
      { id: `r-${serviceName}-${sampleNumber}`, result_name: "act", display_label: "Aktivität", value: 12.5, unit: "m/h", is_official: official },
    ],
  } as never;
}

const base = {
  order,
  resultRows: [],
  geometry: [],
  releases: [],
  m3Values: null,
  documents: [],
  locale: "de-AT",
};

describe("Analyseerkennung", () => {
  it("unterscheidet BENCH NOx von NOx", () => {
    expect(detectAnalysisKey("BENCH NOx")).toBe("bench_nox");
    expect(detectAnalysisKey("NOx-Messung")).toBe("nox");
    expect(detectAnalysisKey("Bench SOx")).toBe("bench_sox");
    expect(detectAnalysisKey("BET-Oberfläche")).toBe("bet");
    expect(detectAnalysisKey("RFA")).toBe("rfa");
  });

  it("ordnet Dienstleistungen zentral einem Kapitel zu", () => {
    expect(chapterForService("BENCH NOx")).toBe("activity_conversion");
    expect(chapterForService("BET")).toBe("physical_properties");
  });
});

describe("Kapitelaufbau", () => {
  it("erzeugt keine leeren Kapitel ohne Daten", () => {
    const doc = buildCustomerDocumentation(base);
    expect(doc.chapters).toHaveLength(0);
    expect(doc.header.map((f) => f.labelKey)).toContain("order_number");
  });

  it("nimmt nur offizielle Ergebnisse auf", () => {
    const doc = buildCustomerDocumentation({ ...base, resultRows: [resultRow("BENCH NOx", "P1", false)] });
    expect(doc.chapters).toHaveLength(0);
  });

  it("bildet mehrere Dienstleistungen in den passenden Kapiteln ab", () => {
    const doc = buildCustomerDocumentation({
      ...base,
      resultRows: [resultRow("BENCH NOx", "P1"), resultRow("BENCH SOx", "P1"), resultRow("BET", "P2")],
    });
    const keys = doc.chapters.map((c) => c.key);
    expect(keys).toContain("activity_conversion");
    expect(keys).toContain("physical_properties");
    const activity = doc.chapters.find((c) => c.key === "activity_conversion")!;
    expect(activity.tables).toHaveLength(2);
  });

  it("stellt Geometrie aus der bestehenden Geometriehaltung dar", () => {
    const doc = buildCustomerDocumentation({
      ...base,
      geometry: [{ sampleNumber: "P1", geometryKind: "wabe", data: { L: 998, D: 150, ti: 0.9 } }],
    });
    const geo = doc.chapters.find((c) => c.key === "geometry")!;
    expect(geo.tables[0].rows.map((r) => r.label)).toEqual(["L", "D", "ti"]);
  });

  it("zeigt Ersatzelemente nur bei vorhandener Menge", () => {
    expect(buildCustomerDocumentation({ ...base, m3Values: { spare_elements: 0 } }).chapters).toHaveLength(0);
    const doc = buildCustomerDocumentation({ ...base, m3Values: { spare_elements: 5 } });
    expect(doc.chapters.find((c) => c.key === "spare_elements")).toBeTruthy();
  });

  it("referenziert die aktuell gültige Freigabe-Revision", () => {
    const releases = [
      { id: "a", release_number: "FF-1", revision_number: 1, is_current: false, source_document_name: "rev1.pdf" },
      { id: "b", release_number: "FF-1", revision_number: 2, is_current: true, source_document_name: "rev2.pdf" },
    ];
    expect(currentRelease(releases)?.id).toBe("b");
    const doc = buildCustomerDocumentation({ ...base, releases });
    const att = doc.chapters.find((c) => c.key === "attachments")!;
    expect(att.documents).toHaveLength(1);
    expect(att.documents[0].name).toBe("rev2.pdf");
  });
});

describe("CSV-Export", () => {
  it("liefert Kapitel, Parameter, Wert und Einheit in der Dokumentsprache", () => {
    const doc = buildCustomerDocumentation({ ...base, resultRows: [resultRow("BENCH NOx", "P1")] });
    const csvDe = customerDocumentationCsv(doc, "de");
    const csvEn = customerDocumentationCsv(doc, "en");
    expect(csvDe.split("\n")[0]).toBe("Kapitel;Abschnitt;Parameter;Wert;Einheit");
    expect(csvEn.split("\n")[0]).toBe("Chapter;Section;Parameter;Value;Unit");
    // Messwerte und Einheiten bleiben in jeder Sprache identisch.
    expect(csvDe).toContain("m/h");
    expect(csvEn).toContain("m/h");
  });
});
