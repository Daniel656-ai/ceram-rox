/**
 * Zentrale Einheitenumrechnung für die Rezeptur-Bestandsprüfung.
 *
 * Hintergrund: Rezepturmengen werden seit der Gramm-Umstellung in der
 * Eingabeeinheit der Zeile gespeichert (z. B. 500 g), Lagerbestände dagegen
 * in der Stammdateneinheit des Rohstoffs (z. B. 25 kg). Alle Vergleiche
 * laufen ausschließlich über `compareStock` in einer gemeinsamen
 * Vergleichseinheit – gespeicherte Zahlenwerte werden nie verändert.
 */

/** Umrechnungsfaktoren auf eine Basiseinheit je Dimension (Masse/Volumen). */
const UNIT_FACTORS: Record<string, { base: string; factor: number }> = {
  mg: { base: "g", factor: 0.001 },
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  ml: { base: "ml", factor: 1 },
  l: { base: "ml", factor: 1000 },
};

const norm = (u: string | null | undefined) => (u ?? "").trim().toLowerCase();

/**
 * Rechnet eine Menge von `fromUnit` in `toUnit` um.
 * Gibt `null` zurück, wenn die Einheiten inkompatibel oder unbekannt sind –
 * in diesem Fall darf keine Bestandswarnung ausgelöst werden (kein Raten).
 * Gleiche (auch unbekannte) Einheiten sind ohne Umrechnung vergleichbar.
 */
export function convertQuantity(
  value: number | string,
  fromUnit: string | null | undefined,
  toUnit: string | null | undefined
): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!isFinite(n)) return null;
  const f = norm(fromUnit);
  const t = norm(toUnit);
  if (f === t) return f === "" ? null : n;
  const from = UNIT_FACTORS[f];
  const to = UNIT_FACTORS[t];
  if (!from || !to || from.base !== to.base) return null;
  return (n * from.factor) / to.factor;
}

/**
 * Standardeingabeeinheit für neue Rezepturzeilen: Feststoffe (Stammdaten kg)
 * werden in g eingegeben; flüssige und sonstige Rohstoffe behalten ihre
 * bisherige Stammdateneinheit. Bestehende Zeilen behalten immer ihre
 * gespeicherte Einheit.
 */
export function defaultRecipeUnit(materialUnit: string | null | undefined): string {
  const u = norm(materialUnit);
  if (u === "kg") return "g";
  return (materialUnit ?? "").trim();
}

export interface StockComparison {
  /** Bedarf, umgerechnet in die Bestandseinheit. */
  required: number;
  /** Verfügbarer Bestand in der Bestandseinheit. */
  available: number;
  /** Gemeinsame Vergleichseinheit (Bestandseinheit). */
  unit: string;
  /** true, wenn der Bestand den Bedarf nicht deckt. */
  short: boolean;
}

/**
 * Vergleicht Bedarf und Bestand in der Bestandseinheit.
 * `null` bei inkompatiblen/unbekannten Einheiten oder ungültigen Zahlen –
 * dann wird keine Fehlmenge gemeldet statt falsch zu alarmieren.
 */
export function compareStock(
  requiredQty: number | string,
  requiredUnit: string | null | undefined,
  availableQty: number | string,
  stockUnit: string | null | undefined
): StockComparison | null {
  const avail = typeof availableQty === "number" ? availableQty : Number(availableQty);
  if (!isFinite(avail)) return null;
  const req = convertQuantity(requiredQty, requiredUnit, stockUnit);
  if (req === null) return null;
  const unit = (stockUnit ?? "").trim() || (requiredUnit ?? "").trim();
  return { required: req, available: avail, unit, short: avail < req };
}
