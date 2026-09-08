import { describe, it, expect } from "vitest";
import { parseReleaseFileName, decideMatch, identityFromText } from "@/lib/productionRelease/documentIdentity";

const rev0 = { id: "a", release_number: "0075-6106", revision_number: 0 };
const rev1 = { id: "b", release_number: "0075-6106", revision_number: 1 };

describe("Fertigungsfreigabe – Kennung aus Dateiname", () => {
  it("erkennt Variante, Auftrag und fehlende Revisionskennung", () => {
    const id = parseReleaseFileName("0075-6106.pdf");
    expect(id).toMatchObject({
      releaseNumber: "0075-6106", variantCode: "0075", orderNumber: "6106",
      revisionNumber: null, hasRevisionTag: false, source: "filename",
    });
  });
  it("erkennt _RevX in verschiedenen Schreibweisen", () => {
    expect(parseReleaseFileName("0075-6106_Rev1.pdf").revisionNumber).toBe(1);
    expect(parseReleaseFileName("0075-6106_Rev2.pdf").revisionNumber).toBe(2);
    expect(parseReleaseFileName("0075-6106_rev_03.PDF").revisionNumber).toBe(3);
    expect(parseReleaseFileName("C:\\Mail\\0075-6106 Rev. 4.pdf").revisionNumber).toBe(4);
    expect(parseReleaseFileName("0075-6106_Revision 5.pdf").hasRevisionTag).toBe(true);
  });
  it("liefert keine Kennung bei unbrauchbarem Dateinamen", () => {
    expect(parseReleaseFileName("scan.pdf").releaseNumber).toBeNull();
    expect(parseReleaseFileName("scan.pdf").source).toBe("none");
  });
  it("Fallback aus Dokumenttext", () => {
    expect(identityFromText("0075-6106", 2)).toMatchObject({ orderNumber: "6106", revisionNumber: 2, source: "text" });
  });
});

describe("Fertigungsfreigabe – Neuanlage vs. Revision", () => {
  it("Test 1: 0075-6106.pdf ohne Bestand → neue Fertigungsfreigabe (Rev. 0)", () => {
    const d = decideMatch(parseReleaseFileName("0075-6106.pdf"), null);
    expect(d).toMatchObject({ state: "new", isRevision: false, revisionNumber: 0, blocker: null });
  });
  it("Test 2: 0075-6106_Rev1.pdf mit Rev. 0 → Revision 1", () => {
    const d = decideMatch(parseReleaseFileName("0075-6106_Rev1.pdf"), rev0);
    expect(d).toMatchObject({ state: "revision", isRevision: true, revisionNumber: 1, blocker: null });
    expect(d.warnings).toHaveLength(0);
  });
  it("Test 3: 0075-6106_Rev2.pdf mit aktuellem Stand Rev. 1 → Revision 2 derselben Freigabe", () => {
    const d = decideMatch(parseReleaseFileName("0075-6106_Rev2.pdf"), rev1);
    expect(d).toMatchObject({ state: "revision", revisionNumber: 2, blocker: null });
  });
  it("Test 4: 0075-6107.pdf ist eine andere Kennung → keine Revision (Suche liefert nichts)", () => {
    const id = parseReleaseFileName("0075-6107.pdf");
    expect(id.releaseNumber).toBe("0075-6107");
    expect(id.releaseNumber).not.toBe(rev0.release_number);
    const d = decideMatch(id, null);
    expect(d.state).toBe("new");
    expect(d.isRevision).toBe(false);
  });
  it("Test 5: _Rev1 ohne auffindbare Freigabe → keine Neuanlage, Zuordnung prüfen", () => {
    const d = decideMatch(parseReleaseFileName("0075-6106_Rev1.pdf"), null);
    expect(d.state).toBe("revision_unmatched");
    expect(d.blocker).toContain("Zuordnung prüfen");
    expect(d.blocker).toContain("REVISION_UNMATCHED");
  });
  it("Rev. 2 bei aktuellem Rev. 0 → Warnung, Vergleich gegen Rev. 0", () => {
    const d = decideMatch(parseReleaseFileName("0075-6106_Rev2.pdf"), rev0);
    expect(d.state).toBe("revision");
    expect(d.revisionNumber).toBe(2);
    expect(d.warnings[0]).toContain("erwartet wäre Rev. 1");
  });
  it("Rev. 1 obwohl Rev. 1 bereits aktuell → blockiert", () => {
    const d = decideMatch(parseReleaseFileName("0075-6106_Rev1.pdf"), rev1);
    expect(d.state).toBe("revision_conflict");
    expect(d.blocker).toContain("REVISION_NOT_NEWER");
  });
  it("gleiche Kennung ohne _RevX → Revision mit Hinweis (nicht stillschweigend)", () => {
    const d = decideMatch(parseReleaseFileName("0075-6106.pdf"), rev0);
    expect(d.state).toBe("revision_without_tag");
    expect(d.revisionNumber).toBe(1);
    expect(d.warnings[0]).toContain("keine Revisionskennung");
  });
});
