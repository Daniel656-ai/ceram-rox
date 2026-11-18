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

import { describeOrderDeletion } from "../orderDeleteSummary";

describe("describeOrderDeletion (Löschdialog eines ganzen Auftrags)", () => {
  it("leer ohne Daten; alte Antwort ohne neue Felder erzeugt keine Sperrgründe", () => {
    expect(describeOrderDeletion(null)).toEqual({ blockers: [], removed: [], released: [], kept: [] });
    expect(describeOrderDeletion({ documents: [], reports: 0 }).blockers).toEqual([]);
  });

  it("trennt: mitgelöscht, gelöst, bleibt bestehen", () => {
    const d = describeOrderDeletion({
      documents: ["a.pdf"], upload_files: ["b.png"], prefilled_values: 3, reports: 1, m3_requests: 1, audit_entries: 4,
      production_releases: ["FR-1"], process_links: 1, samples: 2,
      sample_plan: [
        { name: "P-NEU", deletable: true, reason: null },
        { name: "P-ALT", deletable: false, reason: "an einem weiteren Auftrag" },
      ],
      blockers: [],
    });
    expect(d.removed).toEqual([
      "2 Datei(en): a.pdf, b.png",
      "3 vorläufige Formularwert(e) vom Anlegen",
      "1 automatisch angelegte(r) Bericht(e) ohne Inhalt",
      "1 m³-Listen-Anfrage(n)",
      "4 Eintrag/Einträge im Änderungsprotokoll des Auftrags (bleiben im Löschprotokoll gesichert)",
      "1 Probe(n), die nur für diesen Auftrag angelegt wurden: P-NEU",
    ]);
    expect(d.released).toEqual([
      "Fertigungsfreigabe FR-1 (bleibt bestehen, wird vom Auftrag gelöst)",
      "1 Prozess-Verknüpfung(en) (der Prozessauftrag bleibt bestehen)",
      "2 Probenzuordnung(en) werden gelöst",
    ]);
    expect(d.kept).toEqual(["Probe P-ALT bleibt bestehen (an einem weiteren Auftrag)"]);
  });

  it("Sperrgründe werden unverändert durchgereicht", () => {
    const d = describeOrderDeletion({ blockers: ["Auftrag enthält Messergebnisse, Rohdaten oder Korrekturen und darf nicht gelöscht werden."] });
    expect(d.blockers).toHaveLength(1);
  });
});
