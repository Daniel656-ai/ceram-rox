import { describe, expect, it } from "vitest";
import {
  currentReleaseByOrder,
  planCustomerDocumentationSync,
  type ExistingDoc,
  type ReleaseAssignment,
} from "../releaseSync";

const rel = (
  id: string,
  order_id: string | null,
  revision_number: number,
  is_current: boolean
): ReleaseAssignment => ({ id, order_id, revision_number, is_current });

describe("Kundendokumentation – Zuordnung zu Fertigungsfreigaben", () => {
  it("Auftrag mit Rev. 1 erhält genau eine Kundendoku", () => {
    const plan = planCustomerDocumentationSync([rel("r1", "o1", 1, true)], []);
    expect(plan.creates).toEqual([{ orderId: "o1", releaseId: "r1" }]);
    expect(plan.updates).toHaveLength(0);
  });

  it("neue Rev. 2 erzeugt keine zweite Kundendoku, sondern führt die Grundlage nach", () => {
    const existing: ExistingDoc[] = [{ id: "d1", order_id: "o1", based_on_release_id: "r1" }];
    const plan = planCustomerDocumentationSync(
      [rel("r1", "o1", 1, false), rel("r2", "o1", 2, true)],
      existing
    );
    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toEqual([{ id: "d1", releaseId: "r2" }]);
  });

  it("erneutes Öffnen ohne Änderung bewirkt nichts", () => {
    const existing: ExistingDoc[] = [{ id: "d1", order_id: "o1", based_on_release_id: "r2" }];
    const plan = planCustomerDocumentationSync(
      [rel("r1", "o1", 1, false), rel("r2", "o1", 2, true)],
      existing
    );
    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toHaveLength(0);
  });

  it("mehrere Freigaben/Revisionen desselben Auftrags ergeben nur ein Dokument", () => {
    const plan = planCustomerDocumentationSync(
      [
        rel("a1", "o1", 1, false),
        rel("a2", "o1", 2, false),
        rel("b1", "o1", 3, true),
      ],
      []
    );
    expect(plan.creates).toEqual([{ orderId: "o1", releaseId: "b1" }]);
  });

  it("ohne gültig markierte Revision gewinnt die höchste Revisionsnummer", () => {
    expect(currentReleaseByOrder([rel("r1", "o1", 1, false), rel("r2", "o1", 2, false)]).get("o1")).toBe("r2");
  });

  it("Freigaben ohne Auftrag erzeugen keine Kundendoku", () => {
    const plan = planCustomerDocumentationSync([rel("r1", null, 1, true)], []);
    expect(plan.creates).toHaveLength(0);
  });

  it("mehrere Aufträge erhalten je genau eine Kundendoku", () => {
    const plan = planCustomerDocumentationSync(
      [rel("r1", "o1", 1, true), rel("r2", "o2", 1, true)],
      [{ id: "d1", order_id: "o1", based_on_release_id: "r1" }]
    );
    expect(plan.creates).toEqual([{ orderId: "o2", releaseId: "r2" }]);
    expect(plan.updates).toHaveLength(0);
  });
});
