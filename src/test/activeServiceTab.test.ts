import { describe, it, expect } from "vitest";
import { nextActiveServiceTab, EMPTY_ACTIVE_TAB } from "@/lib/orderCreation/activeServiceTab";

describe("Aktiver Dienstleistungsreiter", () => {
  it("neu ausgewählte Checkbox aktiviert sofort den zugehörigen Reiter", () => {
    const s = nextActiveServiceTab({ prev: EMPTY_ACTIVE_TAB, visibleUids: ["a"], addedUids: ["a"] });
    expect(s.active).toBe("a");
    expect(s.order).toEqual(["a"]);
  });

  it("Auswahl einer weiteren Dienstleistung wechselt automatisch auf diese", () => {
    const s1 = nextActiveServiceTab({ prev: EMPTY_ACTIVE_TAB, visibleUids: ["a"], addedUids: ["a"] });
    const s2 = nextActiveServiceTab({ prev: s1, visibleUids: ["a", "b"], addedUids: ["b"] });
    expect(s2.active).toBe("b");
    expect(s2.order).toEqual(["a", "b"]);
  });

  it("es wird niemals automatisch der erste Reiter geöffnet", () => {
    const s1 = nextActiveServiceTab({ prev: EMPTY_ACTIVE_TAB, visibleUids: ["a", "b"], addedUids: ["b"] });
    expect(s1.active).toBe("b");
  });

  it("bewusst angeklickter Reiter wird aktiv und als zuletzt gewählt geführt", () => {
    const s1 = nextActiveServiceTab({ prev: EMPTY_ACTIVE_TAB, visibleUids: ["a", "b"], addedUids: ["a", "b"] });
    const s2 = nextActiveServiceTab({ prev: s1, visibleUids: ["a", "b"], clickedUid: "a" });
    expect(s2.active).toBe("a");
    expect(s2.order).toEqual(["b", "a"]);
  });

  it("Abwahl des aktiven Reiters aktiviert die zuletzt verbliebene Auswahl", () => {
    let s = nextActiveServiceTab({ prev: EMPTY_ACTIVE_TAB, visibleUids: ["a"], addedUids: ["a"] });
    s = nextActiveServiceTab({ prev: s, visibleUids: ["a", "b"], addedUids: ["b"] });
    s = nextActiveServiceTab({ prev: s, visibleUids: ["a", "b"], clickedUid: "a" });
    // „a“ (aktiv) wird abgewählt → „b“ ist die zuletzt verbliebene Auswahl.
    const s2 = nextActiveServiceTab({ prev: s, visibleUids: ["b"] });
    expect(s2.active).toBe("b");
    expect(s2.order).toEqual(["b"]);
  });

  it("ohne verbliebene Auswahl ist kein Reiter aktiv", () => {
    const s1 = nextActiveServiceTab({ prev: EMPTY_ACTIVE_TAB, visibleUids: ["a"], addedUids: ["a"] });
    const s2 = nextActiveServiceTab({ prev: s1, visibleUids: [] });
    expect(s2.active).toBeNull();
    expect(s2.order).toEqual([]);
  });

  it("mehrere Positionen derselben Dienstleistung werden über ihre uid unterschieden", () => {
    let s = nextActiveServiceTab({ prev: EMPTY_ACTIVE_TAB, visibleUids: ["k1"], addedUids: ["k1"] });
    s = nextActiveServiceTab({ prev: s, visibleUids: ["k1", "k2"], addedUids: ["k2"] });
    expect(s.active).toBe("k2");
    s = nextActiveServiceTab({ prev: s, visibleUids: ["k1", "k2"], clickedUid: "k1" });
    expect(s.active).toBe("k1");
    expect(s.order).toEqual(["k2", "k1"]);
  });

  it("erneute Auswahl einer abgewählten Dienstleistung aktiviert sie wieder", () => {
    let s = nextActiveServiceTab({ prev: EMPTY_ACTIVE_TAB, visibleUids: ["a", "b"], addedUids: ["a", "b"] });
    s = nextActiveServiceTab({ prev: s, visibleUids: ["a"] }); // b abgewählt
    expect(s.active).toBe("a");
    s = nextActiveServiceTab({ prev: s, visibleUids: ["a", "b2"], addedUids: ["b2"] });
    expect(s.active).toBe("b2");
  });

  it("Regel-Positionen ohne addedUids ändern den aktiven Reiter nicht", () => {
    let s = nextActiveServiceTab({ prev: EMPTY_ACTIVE_TAB, visibleUids: ["a"], addedUids: ["a"] });
    s = nextActiveServiceTab({ prev: s, visibleUids: ["a", "r1"] });
    expect(s.active).toBe("a");
    expect(s.order).toEqual(["a"]);
  });
});
