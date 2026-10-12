/**
 * Projektpflicht richtet sich nach der fachlichen Auftragsart (order_type),
 * nicht nach der Benutzerrolle. Kunden- und Produktionsaufträge sind projektfrei.
 */
export const PROJECT_OPTIONAL_ORDER_TYPES = ["customer", "production"] as const;

export function isProjectRequired(orderType: string | null | undefined): boolean {
  return !!orderType && !(PROJECT_OPTIONAL_ORDER_TYPES as readonly string[]).includes(orderType);
}

/** Pflichtfelder der Probenneuanlage; Projekt nur, wenn der Auftrag eines verlangt. */
export function isSampleFormComplete(
  form: { sample_name: string; description: string; post_measurement_action: string; project_id: string },
  projectRequired: boolean,
): boolean {
  if (!form.sample_name.trim() || !form.description.trim() || !form.post_measurement_action) return false;
  if (projectRequired && !form.project_id) return false;
  return true;
}
