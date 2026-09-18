/**
 * ROX – Mehrfach-Vorauswahl für Felder vom Typ „Mehrfachauswahl“.
 * =============================================================
 *
 * Rein additiv auf der bestehenden Feldstruktur: die Vorauswahl wird im bereits
 * vorhandenen `default_value` des Formularfeldes als JSON-Array der
 * Options-/Stammdatenwerte abgelegt. Es gibt KEINE neue Tabelle und keine
 * zweite Konfiguration.
 *
 * Verhalten zur Laufzeit:
 * - Die Vorauswahl wird nur übernommen, solange für das Feld noch kein Wert
 *   gespeichert ist (erstmaliges Öffnen der Formularinstanz).
 * - Sobald ein Wert gespeichert wurde – auch eine leere Auswahl – ist allein
 *   dieser maßgeblich. Entfernte Häkchen kommen nicht zurück.
 * - Bestehende Einzel-Standardwerte (Text/Zahl/Auswahl) bleiben unverändert.
 */

/** Liest die gespeicherte Vorauswahl aus `default_value`. */
export function parseMultiSelectDefault(defaultValue: string | null | undefined): string[] {
  if (defaultValue == null) return [];
  const s = String(defaultValue).trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      /* fällt auf Komma-Trennung zurück */
    }
  }
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Schreibt die Vorauswahl in die bestehende `default_value`-Spalte. */
export function serializeMultiSelectDefault(values: string[]): string | null {
  const clean = values.map((v) => String(v).trim()).filter(Boolean);
  const unique = clean.filter((v, i) => clean.indexOf(v) === i);
  return unique.length ? JSON.stringify(unique) : null;
}

/**
 * Entscheidet, ob die Vorauswahl beim Öffnen übernommen werden muss.
 * `stored === undefined` bedeutet: für dieses Feld wurde noch nie ein Wert
 * gespeichert. Alles andere (auch `[]`) gilt als Benutzerentscheidung.
 */
export function multiSelectInitialValue(
  stored: unknown,
  defaultValue: string | null | undefined,
  availableValues?: string[]
): { apply: boolean; value: string[] } {
  if (stored !== undefined) return { apply: false, value: [] };
  let defaults = parseMultiSelectDefault(defaultValue);
  if (availableValues && availableValues.length) {
    defaults = defaults.filter((v) => availableValues.includes(v));
  }
  if (!defaults.length) return { apply: false, value: [] };
  return { apply: true, value: defaults };
}
