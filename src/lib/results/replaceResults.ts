/**
 * Reine Validierungs- und Payload-Logik für die atomare Ergebnisänderung
 * und -ergänzung über die RPC `replace_measurement_results`.
 *
 * Spiegelt die serverseitigen Regeln clientseitig vor, damit ungültige
 * Eingaben früh mit verständlichen Meldungen abgelehnt werden. Maßgeblich
 * ist immer die serverseitige Prüfung (Berechtigung, Historie, Idempotenz).
 */

export interface ReplaceResultEntry {
  result_name: string;
  instance_key?: string | null;
  instance_label?: string | null;
  display_label?: string | null;
  unit?: string | null;
  remarks?: string | null;
  /** Numerischer Wert – `0` ist ein gültiger Messwert. */
  value?: number | null;
  /** Textueller Wert, z. B. „n.b.“ oder „< 0.1“. */
  text_value?: string | null;
}

export interface ReplaceResultsPayload {
  orderMeasurementId: string;
  operationId: string;
  reason: string;
  results: ReplaceResultEntry[];
  newRawDatasetId?: string | null;
  replacesDatasetId?: string | null;
}

export interface ReplaceResultsSummary {
  success: boolean;
  already_completed: boolean;
  operation_id: string;
  added_count: number;
  updated_count: number;
  unchanged_count: number;
  affected_count: number;
  raw_dataset_id: string | null;
}

export type ReplaceValidation =
  | { ok: true }
  | { ok: false; error: string };

const NUMERIC_PATTERN = /^[+-]?(\d+([.,]\d+)?|[.,]\d+)([eE][+-]?\d+)?$/;

/**
 * Interpretiert eine Roheingabe aus dem Bearbeitungsdialog:
 * - leer/getrimmt leer → `null` (Zeile wird nicht übernommen)
 * - Zahl (auch mit Komma, z. B. „12,5“, oder „0“) → `{ value }`
 * - alles andere (z. B. „n.b.“, „< 0.1“) → `{ text_value }`
 */
export function parseResultInput(
  raw: string
): { value: number } | { text_value: string } | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (NUMERIC_PATTERN.test(trimmed)) {
    const parsed = Number(trimmed.replace(",", "."));
    if (Number.isFinite(parsed)) return { value: parsed };
  }
  return { text_value: trimmed };
}

/**
 * Kanonische Identität eines Ergebnisses – identisch zu Suche,
 * Dublettenprüfung und UNIQUE-Index auf dem Server:
 * `result_name` + `COALESCE(instance_key, '')`. `NULL`, `undefined`
 * und leere Schlüssel werden gleich behandelt.
 */
export function canonicalResultKey(
  resultName: string,
  instanceKey?: string | null
): string {
  const name = resultName.trim();
  const key = (instanceKey ?? "").trim();
  return `${name}::${key}`;
}

function normalizeEntry(entry: ReplaceResultEntry): ReplaceResultEntry {
  const clean = (v?: string | null) => {
    const t = (v ?? "").trim();
    return t.length > 0 ? t : null;
  };
  return {
    ...entry,
    result_name: entry.result_name.trim(),
    instance_key: clean(entry.instance_key),
    instance_label: clean(entry.instance_label),
    display_label: clean(entry.display_label),
    unit: clean(entry.unit),
    remarks: clean(entry.remarks),
    text_value:
      entry.text_value === undefined || entry.text_value === null
        ? entry.text_value
        : clean(entry.text_value),
  };
}

/**
 * Validiert und normalisiert den Payload vor dem RPC-Aufruf.
 * Wirft bei Verletzung eine Error mit verständlicher Meldung.
 */
export function buildReplaceResultsPayload(
  input: ReplaceResultsPayload
): ReplaceResultsPayload {
  if (!input.orderMeasurementId) {
    throw new Error("Dienstleistung ist erforderlich.");
  }
  if (!input.operationId) {
    throw new Error("Operations-ID ist erforderlich.");
  }
  const reason = (input.reason ?? "").trim();
  if (reason.length === 0) {
    throw new Error("Eine Begründung ist erforderlich.");
  }
  if (!Array.isArray(input.results) || input.results.length === 0) {
    throw new Error("Mindestens ein Ergebnis ist erforderlich.");
  }
  if (input.replacesDatasetId && !input.newRawDatasetId) {
    throw new Error(
      "Ablösung eines Rohdatensatzes erfordert die Angabe eines neuen Rohdatensatzes."
    );
  }
  if (
    input.replacesDatasetId &&
    input.newRawDatasetId &&
    input.replacesDatasetId === input.newRawDatasetId
  ) {
    throw new Error("Ein Rohdatensatz kann sich nicht selbst ablösen.");
  }

  const seen = new Set<string>();
  const results = input.results.map((raw) => {
    const entry = normalizeEntry(raw);
    if (entry.result_name.length === 0) {
      throw new Error("result_name darf nicht leer sein.");
    }

    const key = canonicalResultKey(entry.result_name, entry.instance_key);
    if (seen.has(key)) {
      throw new Error(
        `Dublette im Payload für Parameter ${entry.result_name} (Instanz: ${
          entry.instance_key ?? "-"
        }).`
      );
    }
    seen.add(key);

    const hasNumeric = entry.value !== undefined && entry.value !== null;
    const hasText =
      entry.text_value !== undefined && entry.text_value !== null;

    if (hasNumeric && hasText) {
      throw new Error(
        `Widersprüchliche Eingabe für ${entry.result_name}: value und text_value dürfen nicht gleichzeitig angegeben werden.`
      );
    }
    if (!hasNumeric && !hasText) {
      throw new Error(
        `Kein Wert angegeben für ${entry.result_name}: entweder value oder text_value ist erforderlich.`
      );
    }
    if (hasNumeric && !Number.isFinite(entry.value)) {
      throw new Error(
        `Ungültiger numerischer Wert für ${entry.result_name}.`
      );
    }
    if (hasText && (entry.text_value ?? "").trim().length === 0) {
      throw new Error(
        `text_value für ${entry.result_name} darf nicht leer sein.`
      );
    }
    return entry;
  });

  return {
    orderMeasurementId: input.orderMeasurementId,
    operationId: input.operationId,
    reason,
    results,
    newRawDatasetId: input.newRawDatasetId ?? null,
    replacesDatasetId: input.replacesDatasetId ?? null,
  };
}
