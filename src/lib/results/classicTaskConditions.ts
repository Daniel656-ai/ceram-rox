import type { MeasurementParameter } from "@/lib/api/measurementParameters";

export interface ClassicTaskSource {
  measurementId: string;
  orderId: string;
  sampleId: string | null;
  serviceId: string;
  structureChecked: boolean;
  repeatedStructure: boolean;
  parameters: MeasurementParameter[];
  results: Array<{ id: string; result_name: string; instance_key: string | null; instance_label: string | null; remarks: string | null; instance_context?: unknown }>;
}

/** No historical claim: only the single uninstanced task scope in the complete read. */
export function classicTaskEntries(record: {
  measurementId?: string; orderId?: string; sampleId?: string | null; serviceId?: string | null;
  instanceKey?: string | null; outputResults: Array<{ id: string; instance_key?: string | null }>;
  classicTaskSource?: ClassicTaskSource;
}): Array<{ key: string; value: string; unit?: string | null; id?: string }> | null {
  const s = record.classicTaskSource;
  if (!s || !s.structureChecked || s.repeatedStructure || !record.measurementId ||
    s.measurementId !== record.measurementId || s.orderId !== record.orderId ||
    s.sampleId !== record.sampleId || s.serviceId !== record.serviceId || record.instanceKey ||
    !s.results.length || !record.outputResults.length) return null;
  if (s.results.some(r => r.instance_key || r.instance_label || /\[[^\]]+\]/.test(r.result_name))) return null;
  if (new Set(s.results.map(r => r.id)).size !== s.results.length || new Set(s.results.map(r => r.result_name)).size !== s.results.length) return null;
  if (s.results.some(r => r.instance_context && typeof r.instance_context === "object" && Object.keys(r.instance_context).length > 0)) return null;
  if (record.outputResults.some(r => r.instance_key || !s.results.some(all => all.id === r.id))) return null;
  // JSON series/objects can contain additional runs even without official result keys.
  const complex = (raw: string | null) => {
    if (!raw) return false;
    const v = raw.trim();
    return v.startsWith("[") || v.startsWith("{");
  };
  if (s.results.some(r => complex(r.remarks)) || s.parameters.some(p =>
    p.order_measurement_id !== s.measurementId || p.parameter_name.startsWith("repeat:") || complex(p.parameter_value))) return null;
  const ids = new Set(s.parameters.map(p => p.id));
  if (ids.size !== s.parameters.length) return null;
  const entries = s.parameters.filter(p => p.parameter_name.trim() && p.parameter_value != null && p.parameter_value.trim() !== "")
    .map(p => ({ id: p.id, key: p.parameter_name, value: p.parameter_value ?? "", unit: p.unit }));
  return entries.length ? entries : null;
}