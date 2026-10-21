/** Display metadata only: never modifies result values or their identities. */
export interface PrecisionField {
  id: string;
  form_id: string;
  field_key: string;
  decimal_places: number | null;
  parent_field_id: string | null;
  field_type: string;
  metadata?: Record<string, unknown> | null;
}

export interface PrecisionDefinitions {
  fields: PrecisionField[];
  calculations: Array<{ form_id: string; calc_key: string; decimals: number | null }>;
  serviceFields: Array<{ service_id: string; field_key: string; decimal_places: number | null }>;
}

export const emptyPrecisionDefinitions: PrecisionDefinitions = { fields: [], calculations: [], serviceFields: [] };

export function resultFormId(name: string): string | undefined {
  return /^form:([^:]+):.+$/.exec(name)?.[1];
}

function validPrecision(value: unknown): value is number {
  // Intl implementations consistently support 0–20; invalid metadata must not break a table.
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 20;
}

export function resolveResultPrecision(
  result: { result_name: string; instance_key?: string | null },
  serviceId: string | null | undefined,
  definitions: PrecisionDefinitions,
): number | undefined {
  const formId = resultFormId(result.result_name);
  let candidates: unknown[];
  if (!formId) {
    if (!serviceId || result.result_name.startsWith("form:")) return undefined;
    candidates = definitions.serviceFields
      .filter((f) => f.service_id === serviceId && f.field_key === result.result_name)
      .map((f) => f.decimal_places);
  } else {
    const key = result.result_name.slice(`form:${formId}:`.length);
    const fields = definitions.fields.filter((f) => f.form_id === formId);
    const block = /^(.+)\[([^\]]+)\]\.(.+)$/.exec(key);
    if (block) {
      if (result.instance_key && result.instance_key !== block[2]) return undefined;
      const parents = fields.filter((f) => {
        const meta = f.metadata?.measurement_block as { storage_key?: string } | undefined;
        return f.field_type === "measurement_block" && (meta?.storage_key || f.field_key) === block[1];
      });
      if (parents.length !== 1) return undefined;
      candidates = fields
        .filter((f) => f.parent_field_id === parents[0].id && f.field_key === block[3])
        .map((f) => f.decimal_places);
    } else {
      candidates = [
        ...fields.filter((f) => f.field_key === key && !fields.some((p) => p.id === f.parent_field_id && p.field_type === "measurement_block"))
          .map((f) => f.decimal_places),
        ...definitions.calculations.filter((c) => c.form_id === formId && c.calc_key === key).map((c) => c.decimals),
      ];
    }
  }
  return candidates.length === 1 && validPrecision(candidates[0]) ? candidates[0] : undefined;
}

export function formatResultDisplayValue(value: number | null, text: string | null, present: boolean, precision?: number): string {
  if (!present) return "";
  if (value === null) return text ?? "";
  return new Intl.NumberFormat("de-AT", validPrecision(precision)
    ? { minimumFractionDigits: precision, maximumFractionDigits: precision }
    : { maximumFractionDigits: 6 }).format(value);
}