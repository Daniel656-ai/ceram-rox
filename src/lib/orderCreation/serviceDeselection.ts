import type { OrderDraftPayload } from "@/lib/api/orderDrafts";
import { normalizeToken, readServiceSelectionEntries, type SelectableService, type SelectionField, type SelectionMeasurement } from "@/lib/orderServiceSelection";
import { nextActiveServiceTab } from "./activeServiceTab";

/** Inspect a proposed checkbox change without committing any draft state. */
export function planPilotServiceDeselection(params: {
  values: Record<string, unknown>;
  patch: Record<string, unknown>;
  fields: SelectionField[];
  services: SelectableService[];
  measurements: SelectionMeasurement[];
}) {
  const before = readServiceSelectionEntries(params.values, params.fields, params.services);
  const after = new Set(readServiceSelectionEntries({ ...params.values, ...params.patch }, params.fields, params.services).map(e => normalizeToken(e.token)));
  const removed = before.filter(e => !after.has(normalizeToken(e.token)));
  const tokens = new Set(removed.map(e => normalizeToken(e.token)));
  const positions = params.measurements.filter(m => m.origin === "template" && tokens.has(normalizeToken(m.selection_token ?? m.service_name)));
  return {
    uids: positions.map(m => m.uid),
    names: removed.map(e => positions.find(m => normalizeToken(m.selection_token ?? m.service_name) === normalizeToken(e.token))?.service_name
      ?? params.services.find(s => s.id === e.service_id)?.service_name ?? e.aliases[0] ?? e.token),
  };
}

/** Remove only confirmed UID-owned draft data, keeping every other position intact. */
export function removeDraftServices(payload: OrderDraftPayload, uids: string[], patch: Record<string, unknown>): OrderDraftPayload {
  const removed = new Set(uids);
  const measurements = (payload.measurements ?? []).filter(m => !removed.has(m.uid));
  const withoutRemoved = <T,>(values: Record<string, T> = {}) => Object.fromEntries(Object.entries(values).filter(([uid]) => !removed.has(uid)));
  const tab = nextActiveServiceTab({
    prev: { active: payload.activeMeasurementUid ?? null, order: payload.serviceTabOrder ?? [] },
    visibleUids: measurements.map(m => m.uid),
  });
  return {
    ...payload, measurements,
    measurementParams: withoutRemoved(payload.measurementParams),
    measurementFormValues: withoutRemoved(payload.measurementFormValues),
    dynamicValues: { ...payload.dynamicValues, ...patch },
    activeMeasurementUid: tab.active, serviceTabOrder: tab.order,
  };
}