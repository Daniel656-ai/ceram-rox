import type { GlobalValidation } from "@/lib/api/globalLibrary";

export interface ValidationIssue {
  severity: "error" | "warning";
  message: string;
  validationKey: string;
}

const defaultMessage = (v: GlobalValidation): string => {
  const unit = v.unit ? ` ${v.unit}` : "";
  switch (v.rule_type) {
    case "range":
      return `Wert muss zwischen ${v.min_value ?? "?"} und ${v.max_value ?? "?"}${unit} liegen.`;
    case "min":
      return `Wert muss mindestens ${v.min_value ?? "?"}${unit} betragen.`;
    case "max":
      return `Wert darf höchstens ${v.max_value ?? "?"}${unit} betragen.`;
    case "pattern":
      return "Eingabe entspricht nicht dem erwarteten Format.";
    case "required":
      return "Pflichtangabe.";
    default:
      return `Regel „${v.display_name}" nicht erfüllt.`;
  }
};

const isEmpty = (value: unknown) =>
  value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);

/** Prüft einen Wert gegen eine einzelne globale Validierungsregel. */
export const evaluateValidation = (
  value: unknown,
  v: GlobalValidation
): ValidationIssue | null => {
  const fail = (): ValidationIssue => ({
    severity: v.severity ?? "error",
    message: v.error_message?.trim() || defaultMessage(v),
    validationKey: v.validation_key,
  });

  if (v.rule_type === "required") return isEmpty(value) ? fail() : null;

  // Leere Werte werden von allen anderen Regeln toleriert (Pflicht steuert das Formular).
  if (isEmpty(value)) return null;

  if (v.rule_type === "pattern") {
    if (!v.pattern) return null;
    try {
      return new RegExp(v.pattern).test(String(value)) ? null : fail();
    } catch {
      return null; // ungültiges Muster darf die Eingabe nicht blockieren
    }
  }

  if (v.rule_type === "expression") return null; // wird von der Formel-Engine im Formular ausgewertet

  const num = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(num)) return null;

  if ((v.rule_type === "range" || v.rule_type === "min") && v.min_value !== null && num < v.min_value) return fail();
  if ((v.rule_type === "range" || v.rule_type === "max") && v.max_value !== null && num > v.max_value) return fail();
  return null;
};

/** Prüft einen Wert gegen mehrere Regeln und liefert alle Verstöße. */
export const evaluateValidations = (
  value: unknown,
  validations: GlobalValidation[]
): ValidationIssue[] =>
  validations.map((v) => evaluateValidation(value, v)).filter((i): i is ValidationIssue => !!i);

/** Liest die im Formularfeld hinterlegten Validierungs-IDs (aus metadata). */
export const validationIdsFromMetadata = (metadata: unknown): string[] => {
  const ids = (metadata as Record<string, unknown> | null)?.["validation_ids"];
  return Array.isArray(ids) ? ids.filter((i): i is string => typeof i === "string") : [];
};
