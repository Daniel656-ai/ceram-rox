import { describe, it, expect } from "vitest";
import { canDeleteM3, describeM3Delete, type M3DeletePlan } from "../m3Delete";

describe("canDeleteM3", () => {
  it("Master immer", () => expect(canDeleteM3({ requested_by: "a" }, { id: "b" }, "master")).toBe(true));
  it("Ersteller", () => expect(canDeleteM3({ requested_by: "a" }, { id: "a" }, "auftraggeber")).toBe(true));
  it("andere nicht", () => expect(canDeleteM3({ requested_by: "a" }, { id: "b" }, "auftraggeber")).toBe(false));
  it("ohne Ersteller/ohne Benutzer nicht", () => {
    expect(canDeleteM3({ requested_by: null }, { id: "b" }, "x")).toBe(false);
    expect(canDeleteM3({ requested_by: "a" }, null, "x")).toBe(false);
  });
});

describe("describeM3Delete", () => {
  it("ohne Auftrag nur Freigabe-Hinweis", () => {
    const l = describeM3Delete({ order_id: null, blocked_reason: null, has_results: false, samples: [], attachments: {} });
    expect(l).toEqual([{ kind: "info", text: "Die Fertigungsfreigabe bleibt immer erhalten." }]);
  });
  it("mit Auftrag: Auftrag, Dateien, Proben löschen/behalten", () => {
    const plan: M3DeletePlan = {
      order_id: "o",
      order_number: "TTB1",
      blocked_reason: null,
      has_results: false,
      samples: [
        { name: "A-1", deletable: true, reason: null },
        { name: "A-2", deletable: false, reason: "Probendokumente vorhanden" },
      ],
      attachments: { documents: ["x.pdf"] },
    };
    const l = describeM3Delete(plan);
    expect(l[0].text).toContain("TTB1");
    expect(l.some((x) => x.kind === "delete" && x.text.includes("1 Datei(en): x.pdf"))).toBe(true);
    expect(l.some((x) => x.kind === "delete" && x.text.includes("A-1"))).toBe(true);
    expect(l.some((x) => x.kind === "keep" && x.text.includes("A-2") && x.text.includes("Probendokumente"))).toBe(true);
  });
});
