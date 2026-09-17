import { describe, it, expect } from "vitest";
import { currentReleaseByOrder, planCustomerDocumentationSync } from "../releaseSync";

const rel = (id: string, order_id: string | null, revision_number: number, is_current = false) => ({
  id, order_id, revision_number, is_current,
});

describe("Kundendoku-Abgleich", () => {
  it("Rev. 1 → genau eine Kundendoku", () => {
    const plan = planCustomerDocumentationSync([rel("r1", "o1", 1, true)], []);
    expect(plan.creates).toEqual([{ orderId: "o1", releaseId: "r1" }]);
    expect(plan.updates).toHaveLength(0);
  });

  it("Rev. 2 → Aktualisierung statt zweiter Doku", () => {
    const plan = planCustomerDocumentationSync(
      [rel("r1", "o1", 1), rel("r2", "o1", 2, true)],
      [{ id: "d1", order_id: "o1", based_on_release_id: "r1" }]
    );
    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toEqual([{ id: "d1", releaseId: "r2" }]);
  });

  it("gleicher Stand → keine Änderung", () => {
    const plan = planCustomerDocumentationSync(
      [rel("r2", "o1", 2, true)],
      [{ id: "d1", order_id: "o1", based_on_release_id: "r2" }]
    );
    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toHaveLength(0);
  });

  it("mehrere Revisionen → nur ein Dokument", () => {
    const plan = planCustomerDocumentationSync(
      [rel("r1", "o1", 1), rel("r2", "o1", 2), rel("r3", "o1", 3, true)],
      []
    );
    expect(plan.creates).toEqual([{ orderId: "o1", releaseId: "r3" }]);
  });

  it("ohne is_current gewinnt die höchste Revisionsnummer", () => {
    expect(currentReleaseByOrder([rel("r1", "o1", 1), rel("r5", "o1", 5)]).get("o1")).toBe("r5");
  });

  it("Freigabe ohne Auftrag erzeugt keine Doku", () => {
    expect(planCustomerDocumentationSync([rel("r1", null, 1, true)], []).creates).toHaveLength(0);
  });

  it("mehrere Aufträge → je eine Doku", () => {
    const plan = planCustomerDocumentationSync([rel("r1", "o1", 1, true), rel("r2", "o2", 1, true)], []);
    expect(plan.creates).toHaveLength(2);
  });
});
