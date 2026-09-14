import { describe, it, expect } from "vitest";
import { readValueSource, isLinkedFormLink, isSameFormLink, resolveLinkedValue } from "@/lib/fieldLinks";

const field = (ds: unknown) => ({ id: "f1", data_source: ds }) as any;

describe("Wertquelle: Wert aus verknüpftem Formular", () => {
  it("liest Quellformular und Quellfeld", () => {
    const vs = readValueSource(
      field({ mode: "copy", source: { kind: "linked_form", form_id: "geo", field_key: "ap", label: "Geometrievermessung → AP" } })
    );
    expect(isLinkedFormLink(vs)).toBe(true);
    expect(isSameFormLink(vs)).toBe(false);
    expect(vs?.source.form_id).toBe("geo");
    expect(vs?.source.field_key).toBe("ap");
  });

  it("löst den aktuellen Wert des Quellformulars auf", () => {
    const vs = readValueSource(field({ mode: "copy", source: { kind: "linked_form", form_id: "geo", field_key: "epsilon" } }));
    expect(resolveLinkedValue(vs, { formData: { geo: { epsilon: 0.72 } } })).toBe(0.72);
    // Zwei Zielformulare (z. B. BENCH NOx und BENCH SOx) lesen dieselbe Quelle.
    expect(resolveLinkedValue(vs, { formData: { geo: { epsilon: 0.81 } } })).toBe(0.81);
  });

  it("liefert null statt Ersatzwert, wenn die Quelle keinen Wert hat", () => {
    const vs = readValueSource(field({ mode: "copy", source: { kind: "linked_form", form_id: "geo", field_key: "ap" } }));
    expect(resolveLinkedValue(vs, { formData: {} })).toBeNull();
    expect(resolveLinkedValue(vs, { formData: { geo: { ap: "" } } })).toBeNull();
  });

  it("lässt bestehende Wertquellen unverändert", () => {
    const same = readValueSource(field({ mode: "copy", source: { kind: "form_field", field_key: "a" } }));
    expect(isSameFormLink(same)).toBe(true);
    const step = readValueSource(field({ mode: "copy", source: { kind: "workflow_step", step_key: "s1", field_key: "x" } }));
    expect(resolveLinkedValue(step, { stepData: { s1: { x: 5 } } })).toBe(5);
    expect(readValueSource(field(null))).toBeNull();
  });
});
