import { describe, it, expect } from "vitest";
import { describeReassignment } from "./reassignmentEvent";

const names: Record<string, string> = { a: "Anna A", b: "Bert B" };
const name = (id?: string | null) => (id ? names[id] ?? "?" : "–");

describe("describeReassignment", () => {
  it("shows previous and new assignee, mode and reason", () => {
    const t = describeReassignment(
      { from_user_id: "a", to_user_id: "b", mode: "project_lead", reason: "Urlaub", measurement_number: "M260001" },
      name,
    );
    expect(t).toContain("M260001");
    expect(t).toContain("Anna A → Bert B");
    expect(t).toContain("Projektleitung");
    expect(t).toContain("Urlaub");
  });
  it("handles previously unassigned tasks", () => {
    expect(describeReassignment({ from_user_id: null, to_user_id: "b", mode: "handover" }, name))
      .toContain("nicht zugewiesen → Bert B");
  });
});

describe("describeReassignment – Entfernung", () => {
  it("shows removed assignment with previous person, actor mode and reason", () => {
    const t = describeReassignment(
      { from_user_id: "a", to_user_id: null, action: "unassigned", mode: "master", reason: "Krank", measurement_number: "M260002" },
      name,
    );
    expect(t).toBe('Zuweisung entfernt M260002: Anna A · durch Admin · Grund: „Krank"');
  });
});
