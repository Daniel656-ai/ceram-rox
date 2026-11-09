import { describe, it, expect } from "vitest";
import { resolveBilled, billedForCreate, canEditBilled } from "@/lib/orders/billing";

describe("billing", () => {
  it("neuer Kundenauftrag ohne Auswahl = Nein", () => expect(billedForCreate("customer", false)).toBe(false));
  it("Kundenauftrag mit Ja speicherbar", () => expect(billedForCreate("customer", true)).toBe(true));
  it("Wechsel auf andere Auftragsart speichert Nein", () => {
    expect(billedForCreate("rnd", true)).toBe(false);
    expect(billedForCreate("production", true)).toBe(false);
  });
  it("andere Auftragsarten ohne Anzeige", () => {
    expect(resolveBilled({ order_type: "rnd", is_billed: true })).toBeNull();
    expect(resolveBilled({ order_type: "production", is_billed: false })).toBeNull();
  });
  it("fehlender/null Status = Nein", () => {
    expect(resolveBilled({ order_type: "customer" })).toBe(false);
    expect(resolveBilled({ order_type: "customer", is_billed: null })).toBe(false);
  });
  it("Ja wird als Ja aufgelöst", () => expect(resolveBilled({ order_type: "customer", is_billed: true })).toBe(true));
  it("Ersteller darf ändern", () => expect(canEditBilled({ created_by: "u1" }, "u1", false)).toBe(true));
  it("Master darf ändern", () => expect(canEditBilled({ created_by: "u1" }, "u2", true)).toBe(true));
  it("andere Benutzer nicht", () => {
    expect(canEditBilled({ created_by: "u1" }, "u2", false)).toBe(false);
    expect(canEditBilled({ created_by: "u1" }, null, false)).toBe(false);
  });
});

describe("billing – Wechsel der Auftragsart", () => {
  it("gespeicherter Wert bleibt erhalten und erscheint bei Kundenauftrag wieder", () => {
    const stored = { is_billed: true };
    expect(resolveBilled({ ...stored, order_type: "rnd" })).toBeNull();
    expect(resolveBilled({ ...stored, order_type: "customer" })).toBe(true);
  });
});
