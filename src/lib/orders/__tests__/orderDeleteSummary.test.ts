import { describe, it, expect } from "vitest";
import { describeOrderAttachments } from "../orderDeleteSummary";

describe("describeOrderAttachments", () => {
  it("leer, wenn nichts angehängt", () => {
    expect(describeOrderAttachments(null)).toEqual([]);
    expect(describeOrderAttachments({ documents: [], upload_files: [], reports: 0, production_releases: [], m3_requests: 0, samples: 0 })).toEqual([]);
  });
  it("zählt Dateien (Dokumente + Uploads) und nennt Namen", () => {
    const l = describeOrderAttachments({ documents: ["a.pdf"], upload_files: ["b.xlsx"] });
    expect(l).toEqual(["2 Datei(en): a.pdf, b.xlsx"]);
  });
  it("kürzt lange Namenslisten", () => {
    const l = describeOrderAttachments({ documents: ["1", "2", "3", "4", "5", "6", "7"] });
    expect(l[0]).toBe("7 Datei(en): 1, 2, 3, 4, 5 und 2 weitere");
  });
  it("Berichte, Freigaben, m³-Anfragen, Proben", () => {
    const l = describeOrderAttachments({ reports: 1, production_releases: ["FF-1"], m3_requests: 1, samples: 3 });
    expect(l).toHaveLength(4);
    expect(l[1]).toContain("FF-1");
    expect(l[3]).toContain("bleiben bestehen");
  });
});
