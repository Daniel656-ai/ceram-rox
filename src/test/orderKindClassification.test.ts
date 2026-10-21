import { describe, it, expect } from "vitest";
import { resolveOrderKind, matchesOrderKindFilter } from "@/lib/orders/orderKind";

const svc = (...cats: string[]) => cats.map((category) => ({ measurement_services: { category } }));
const dga = { order_number: "DGA260005", order_kind: "legacy", order_measurements: svc("labor", "labor", "labor", "pilot_plant") };

describe("resolveOrderKind", () => {
  it("historisch nur Labor → Labor", () => {
    expect(resolveOrderKind({ order_kind: "legacy", order_measurements: svc("labor", "labor") })).toBe("labor");
  });
  it("historisch nur Pilot Plant → Pilot Plant", () => {
    expect(resolveOrderKind({ order_kind: "legacy", order_measurements: svc("pilot_plant") })).toBe("pilot_plant");
  });
  it("DGA260005 (gemischt) → Klassisch", () => {
    expect(resolveOrderKind(dga)).toBe("legacy");
  });
  it("historisch ohne Dienstleistungen → Klassisch", () => {
    expect(resolveOrderKind({ order_kind: "legacy", order_measurements: [] })).toBe("legacy");
  });
  it("explizit gepflegte Werte bleiben unverändert", () => {
    expect(resolveOrderKind({ order_kind: "labor", order_measurements: svc("pilot_plant") })).toBe("labor");
    expect(resolveOrderKind({ order_kind: "pilot_plant", order_measurements: svc("labor") })).toBe("pilot_plant");
  });
});

describe("matchesOrderKindFilter", () => {
  it("Klassisch wird bei Labor und Pilot Plant ausgeschlossen", () => {
    expect(matchesOrderKindFilter(dga, "labor")).toBe(false);
    expect(matchesOrderKindFilter(dga, "pilot_plant")).toBe(false);
  });
  it("Klassisch erscheint bei Alle Auftragsarten", () => {
    expect(matchesOrderKindFilter(dga, "all")).toBe(true);
  });
});
