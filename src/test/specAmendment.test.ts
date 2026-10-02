import { describe, it, expect } from "vitest";
import { describeSpecChange, groupSpecChanges, specChangeBadgeText } from "@/components/order/SpecAmendment";

const ev = (id: string, pid: string, at: string, meta: any) => ({
  id, event_type: "order_spec_updated", created_at: at, actor_user_id: "u1",
  metadata: { parameter_id: pid, ...meta },
});

describe("Nachträgliche Vorgabenänderungen (Anzeige)", () => {
  it("behält mehrere Änderungen chronologisch je Parameter", () => {
    const g = groupSpecChanges([
      ev("2", "p1", "2026-10-02T12:00:00Z", { old_value: "500", new_value: "520" }),
      ev("1", "p1", "2026-10-02T11:00:00Z", { old_value: "450", new_value: "500" }),
      ev("3", "p1", "2026-10-02T13:00:00Z", { old_value: "520", new_value: "500" }),
      { id: "x", event_type: "order_created", created_at: "2026-10-01", metadata: {} },
    ]);
    expect(g.get("p1")!.map((e) => e.id)).toEqual(["1", "2", "3"]);
    expect(g.size).toBe(1);
  });

  it("beschreibt Skalaränderung mit Einheit", () => {
    expect(describeSpecChange({ parameter_name: "Temperatur", unit: "°C", old_value: "450", new_value: "500" }))
      .toEqual(["450 °C → 500 °C"]);
  });

  it("beschreibt ergänzte, geänderte und entfernte Repeater-Einträge", () => {
    const lines = describeSpecChange({
      parameter_name: "repeat:Mundstücke",
      items: [
        { change: "added", item_id: "c", new: { __id: "c", typ: "M3" } },
        { change: "modified", item_id: "a", old: { __id: "a", typ: "M1" }, new: { __id: "a", typ: "M1b" } },
        { change: "removed", item_id: "b", old: { __id: "b", typ: "M2" } },
      ],
    });
    expect(lines).toEqual([
      "Eintrag ergänzt: typ: M3",
      "Eintrag geändert: typ: M1 → typ: M1b",
      "Eintrag entfernt: typ: M2",
    ]);
  });

  it("Badge „ergänzt“ nur bei reinen Ergänzungen", () => {
    expect(specChangeBadgeText([{ metadata: { change_type: "item_added" } }])).toBe("Nachträglich ergänzt");
    expect(specChangeBadgeText([{ metadata: { change_type: "modified" } }])).toBe("Nachträglich geändert");
  });
});
