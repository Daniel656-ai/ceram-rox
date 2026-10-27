import { describe, expect, it } from "vitest";
import { sanitizeDraftPayload } from "@/lib/api/orderDrafts";
import { draftPositionEdited, missingDraftFiles, normalizeRestoredDraft } from "@/lib/orderDraftSafety";
import { planServiceSync } from "@/lib/orderServiceSelection";

describe("draft value roundtrip", () => {
  it("normalizes a sparse stored draft into the exact form baseline without losing provenance", () => {
    const position = { uid: "original", service_id: "s", service_name: "S", origin: "rule" as const, rule_id: "rule", rule_source_uid: "parent", selection_token: "token" };
    const restored = normalizeRestoredDraft({ measurements: [position], notes: "014" });
    expect(restored.measurements?.[0]).toEqual(position);
    expect(restored.measurementParams).toEqual({});
    expect(restored.processTemplateId).toBe("__none__");
    expect(restored.dynamicFormId).toBeNull();
  });
  it("preserves 0, false, repeated references, nested repeaters and position identities", () => {
    const entry = { temperature: 0, enabled: false, text: "014" };
    const payload = { measurements: [{ uid: "original", service_id: "s", service_name: "S", origin: "template", selection_token: "S" }], measurementFormValues: { original: { runs: [{ points: [entry, entry] }] } } };
    expect(JSON.parse(JSON.stringify(sanitizeDraftPayload(payload)))).toEqual(payload);
  });
  it("keeps saved references and marks local files without serializing blob previews", () => {
    const payload = { files: [{ __id: "local", pendingFile: new File(["abc"], "a.pdf"), previewUrl: "blob:old" }, { storagePath: "saved/a.pdf", templateId: "template" }] };
    const saved = sanitizeDraftPayload(payload);
    expect(saved.files[0]).not.toHaveProperty("previewUrl");
    expect(saved.files[1]).toEqual(payload.files[1]);
    expect(missingDraftFiles(saved)).toEqual(["a.pdf"]);
  });
  it("refuses circular values instead of silently dropping data", () => {
    const value: Record<string, unknown> = {}; value.self = value;
    expect(() => sanitizeDraftPayload(value)).toThrow("Circular");
  });
  it("automatic selection removal keeps an edited position including false and zero", () => {
    const payload = { measurementFormValues: { zero: { v: 0 }, no: { v: false } } };
    const plan = planServiceSync({ selection: [], services: [], measurements: ["zero", "no"].map(uid => ({ uid, service_id: "s", service_name: "S", origin: "template" })), isEdited: uid => draftPositionEdited(payload, uid) });
    expect(plan.remove).toEqual([]); expect(plan.keep).toEqual(["zero", "no"]);
  });
});
