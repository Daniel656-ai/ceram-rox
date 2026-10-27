import type { OrderDraftPayload } from "@/lib/api/orderDrafts";

export function normalizeRestoredDraft(p: OrderDraftPayload): OrderDraftPayload {
  return {
    selectedProjectId: p.selectedProjectId ?? "", orderType: p.orderType ?? "", orderKind: p.orderKind === "pilot_plant" ? "pilot_plant" : "labor",
    dueDate: p.dueDate ?? "", notes: p.notes ?? "", measurements: p.measurements ?? [], selectedSampleIds: p.selectedSampleIds ?? [],
    processTemplateId: p.processTemplateId ?? "__none__", measurementParams: p.measurementParams ?? {}, measurementFormValues: p.measurementFormValues ?? {},
    dynamicValues: p.dynamicValues ?? {}, dynamicFormId: p.dynamicFormId ?? null,
  };
}

/** Empty containers are not edits; 0 and false explicitly are. */
export function hasDraftValue(value: unknown): boolean {
  if (value == null || value === "") return false;
  if (Array.isArray(value)) return value.some(hasDraftValue);
  if (typeof value === "object") return Object.entries(value).some(([key, v]) => !key.startsWith("__") && hasDraftValue(v));
  return true;
}
export function draftPositionEdited(payload: Pick<OrderDraftPayload, "measurementFormValues" | "measurementParams">, uid: string) {
  return hasDraftValue(payload.measurementFormValues?.[uid]) || hasDraftValue(payload.measurementParams?.[uid]);
}
export function missingDraftFiles(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  if ("__draft_file_missing" in value) return [String((value as { name?: string }).name ?? "Datei")];
  if (typeof File !== "undefined" && value instanceof File) return [value.name];
  return Object.values(value).flatMap(missingDraftFiles);
}
