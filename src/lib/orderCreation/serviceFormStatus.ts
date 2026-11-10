/**
 * ROX – Bearbeitungsstatus einer Dienstleistungsposition (Reiter-Anzeige).
 *
 * Reine Auswertung vorhandener Pflichtfeld- und Sichtbarkeitsregeln aus
 * ServiceBookingForm (klassische Designer-Formulare) und verknüpften globalen
 * Formularen. Es werden KEINE neuen fachlichen Regeln eingeführt:
 *
 * - Offen: keine Eingaben.
 * - In Bearbeitung: Eingaben vorhanden, aber keine abschließende Prüfung
 *   möglich (Metadaten noch nicht geladen oder keine Pflichtfelder definiert).
 * - Unvollständig: mindestens ein Pflichtfeld ohne Wert.
 * - Vollständig: alle vorhandenen Pflichtfelder erfüllt.
 *
 * Leer-Prüfung wie überall im Entwurf: 0 und false zählen als Eingabe.
 * Pflichtfelder innerhalb von Repeater-Abschnitten fließen nicht ein (ihre
 * Prüfung erfolgt zeilenweise im Formular selbst).
 */

import { hasDraftValue } from "@/lib/orderDraftSafety";

export type ServiceFormStatus = "offen" | "in_bearbeitung" | "unvollstaendig" | "vollstaendig";

export const SERVICE_FORM_STATUS_LABELS: Record<ServiceFormStatus, string> = {
  offen: "Offen",
  in_bearbeitung: "In Bearbeitung",
  unvollstaendig: "Unvollständig",
  vollstaendig: "Vollständig",
};

interface ClassicField {
  id: string;
  field_key: string;
  is_required?: boolean | null;
  archived?: boolean | null;
}

interface LayoutSectionRef {
  repeatable?: { enabled?: boolean } | null;
  fields: Array<{ field_id?: string; hidden?: boolean }>;
}

/**
 * Pflichtfeld-Schlüssel des klassischen Auftraggeberformulars: nur Felder,
 * die im Customer-Layout platziert und nicht ausgeblendet sind. Ohne
 * Customer-Layout wird kein Formular gerendert → keine Pflichtfelder.
 */
export function classicRequiredKeys(params: {
  fields: ClassicField[];
  sections: LayoutSectionRef[] | null | undefined;
  ruleRequired: Set<string>;
  ruleHidden: Set<string>;
}): string[] {
  const { fields, sections, ruleRequired, ruleHidden } = params;
  if (!sections || sections.length === 0) return [];
  const byId = new Map(fields.filter((f) => !f.archived).map((f) => [f.id, f]));
  const out: string[] = [];
  for (const sec of sections) {
    if (sec.repeatable?.enabled) continue; // Repeater prüfen zeilenweise im Formular
    for (const ref of sec.fields) {
      if (ref.hidden || !ref.field_id) continue;
      const f = byId.get(ref.field_id);
      if (!f || ruleHidden.has(f.field_key)) continue;
      if (f.is_required || ruleRequired.has(f.field_key)) {
        if (!out.includes(f.field_key)) out.push(f.field_key);
      }
    }
  }
  return out;
}

/**
 * Pflichtfeld-Schlüssel eines verknüpften globalen Formulars – mit Namespace
 * `form:<formId>:<feld>`, wie die Werte im Positions-Wertebeutel liegen.
 */
export function linkedRequiredKeys(
  formId: string,
  fields: Array<{ field_key: string; is_required?: boolean | null }>
): string[] {
  return fields
    .filter((f) => f.is_required)
    .map((f) => `form:${formId}:${f.field_key}`);
}

export function evaluateServiceFormStatus(params: {
  values: Record<string, unknown>;
  requiredKeys: string[];
  /** Sind Felder-, Layout- und Regel-Metadaten vollständig geladen? */
  metaReady: boolean;
}): ServiceFormStatus {
  if (!hasDraftValue(params.values)) return "offen";
  if (!params.metaReady) return "in_bearbeitung";
  const missing = params.requiredKeys.some((k) => !hasDraftValue(params.values[k]));
  if (missing) return "unvollstaendig";
  if (params.requiredKeys.length === 0) return "in_bearbeitung";
  return "vollstaendig";
}
