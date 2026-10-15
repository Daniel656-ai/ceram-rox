/**
 * Auswahloptionen aus aktiven Stammdateneinträgen plus – falls nötig – den
 * bereits gespeicherten Wert als nicht auswählbare historische Option.
 * Der gespeicherte Wert wird nie verändert oder entfernt.
 */
export interface MasterDataSelectOption {
  label: string;
  value: string;
  /** Historischer Wert eines inzwischen inaktiven/fehlenden Eintrags. */
  inactive?: boolean;
}

export function withHistoricalOption(
  active: Array<{ label: string; item_value: string }>,
  currentValue: unknown,
): MasterDataSelectOption[] {
  const options: MasterDataSelectOption[] = active.map((i) => ({ label: i.label, value: i.item_value }));
  if (typeof currentValue !== "string" || currentValue === "") return options;
  if (options.some((o) => o.value === currentValue)) return options;
  return [{ label: `${currentValue} (inaktiv)`, value: currentValue, inactive: true }, ...options];
}
