import { describe, expect, it } from "vitest";
import { sanitizeDraftPayload } from "@/lib/api/orderDrafts";
import { draftPositionEdited, missingDraftFiles } from "@/lib/orderDraftSafety";
import { planServiceSync } from "@/lib/orderServiceSelection";

describe("draft value roundtrip", () => {
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
