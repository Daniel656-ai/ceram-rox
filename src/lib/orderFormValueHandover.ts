/**
 * ROX – Übergabe der Auftraggeber-Formularwerte an dieselbe Messung.
 * =================================================================
 *
 * Reine Abbildungslogik: ein beim Auftrag erfasster Wert eines Globalen
 * Formulars (z. B. `av_1`, `av_2`) wird unter dem BESTEHENDEN Feldschlüssel
 * als normaler Formularwert derselben Messung abgelegt
 * (`measurement_results.result_name = "form:<form_id>:<field_key>"`).
 *
 * Dadurch liest die Messdienstleisteransicht exakt dasselbe Feld – ohne
 * zweite Feldinstanz, ohne neues Feld und ohne Änderung der Formeln.
 */

export interface FormValueFieldDef {
  display_name?: string | null;
  unit?: string | null;
  field_type?: string | null;
}

/** Feldtypen, deren Zeichenfolgen immer Text bleiben (Kennungen wie „014“). */
const TEXT_FIELD_TYPES = new Set(["text", "longtext", "select", "multiselect"]);

export interface FormValueResultPayload {
  order_measurement_id: string;
  result_name: string;
  display_label: string;
  unit?: string;
  is_official: boolean;
  measured_by?: string;
  value: number | null;
  remarks: string | null;
}

const NUMERIC = /^[+-]?(\d+([.,]\d+)?|[.,]\d+)([eE][+-]?\d+)?$/;

/**
 * Baut die Ergebniszeile für einen Auftraggeber-Formularwert.
 * Leere Werte werden nicht übernommen (`null`) – sie dürfen nie zu 0 werden.
 * Text-/Auswahlfelder behalten Zeichenfolgen unverändert; Zahl-, Dezimal-,
 * Prozent- und unbekannte Feldtypen verhalten sich wie bisher.
 */
export function buildFormValueResultPayload(params: {
  measurementId: string;
  formId: string;
  fieldKey: string;
  raw: unknown;
  def?: FormValueFieldDef | null;
  measuredBy?: string;
}): FormValueResultPayload | null {
  const { measurementId, formId, fieldKey, raw, def, measuredBy } = params;
  if (raw == null) return null;
  if (typeof raw === "string" && raw.trim() === "") return null;

  const payload: FormValueResultPayload = {
    order_measurement_id: measurementId,
    result_name: `form:${formId}:${fieldKey}`,
    display_label: def?.display_name || fieldKey,
    unit: def?.unit || undefined,
    is_official: false,
    measured_by: measuredBy,
    value: null,
    remarks: null,
  };

  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    payload.value = raw;
  } else if (typeof raw === "string") {
    const isText = !!def?.field_type && TEXT_FIELD_TYPES.has(def.field_type);
    const text = raw.trim();
    const num = !isText && NUMERIC.test(text) ? parseFloat(text.replace(",", ".")) : NaN;
    if (Number.isFinite(num)) payload.value = num;
    else payload.remarks = raw;
  } else if (typeof raw === "boolean") {
    payload.remarks = raw ? "true" : "false";
  } else {
    payload.remarks = JSON.stringify(raw);
  }

  return payload;
}
