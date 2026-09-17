/**
 * Abgleich zwischen der Auswahl im Auftraggeberformular (globale
 * Mehrfachauswahl "Dienstleistungen" aus den Stammdaten) und den echten
 * Dienstleistungspositionen des Auftrags (`order_measurements`).
 *
 * Hier entsteht KEINE zweite Dienstleistungsverwaltung: Die Auswahl liefert nur
 * Bezeichnungen, aufgelöst wird ausschließlich gegen den bestehenden
 * Dienstleistungskatalog (`measurement_services`).
 */

export interface SelectableService {
  id: string;
  service_name: string;
  category?: string | null;
}

export interface SelectionMeasurement {
  uid: string;
  service_id: string;
  service_name: string;
  /** "template" = aus der Formularauswahl erzeugt, "manual" = zusätzlich gebucht. */
  origin?: "template" | "manual";
  /** Ursprünglicher Auswahlwert, damit das Entfernen eindeutig bleibt. */
  selection_token?: string | null;
  source_package_id?: string | null;
  source_package_name?: string | null;
}

export const normalizeToken = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

/** Findet die Auswahlwerte der Mehrfachauswahl "Dienstleistungen" im Formular. */
export function readServiceSelection(
  values: Record<string, any>,
  fields: Array<{ field_key: string; display_name?: string | null; field_type?: string | null }>
): string[] {
  const candidates = fields.filter((f) => {
    const type = (f.field_type ?? "").toLowerCase();
    if (type && type !== "multiselect" && type !== "select") return false;
    const name = normalizeToken(f.display_name) || normalizeToken(f.field_key);
    return name === "dienstleistungen" || name === "services";
  });

  const out: string[] = [];
  for (const f of candidates) {
    const raw = values[f.field_key];
    const list = Array.isArray(raw) ? raw : raw == null || raw === "" ? [] : [raw];
    for (const entry of list) {
      const token = typeof entry === "object" && entry !== null
        ? String((entry as any).value ?? (entry as any).label ?? "")
        : String(entry);
      if (token.trim()) out.push(token.trim());
    }
  }
  return [...new Set(out)];
}

export interface SyncPlan {
  /** Neu anzulegende Positionen (Dienstleistung aus dem Katalog aufgelöst). */
  add: Array<{ service: SelectableService; token: string }>;
  /** uids, die entfernt werden, weil die Auswahl zurückgenommen wurde. */
  remove: string[];
  /** uids, die erhalten bleiben, obwohl die Auswahl entfernt wurde (bereits bearbeitet). */
  keep: string[];
  /** Auswahlwerte ohne passende aktive Dienstleistung. */
  unresolved: string[];
}

/**
 * Berechnet den Abgleich. Es wird ausschließlich exakt (ohne Groß-/
 * Kleinschreibung) über den Dienstleistungsnamen abgeglichen – keine
 * Namensähnlichkeit, keine Ersatzdienstleistung, keine Neuanlage.
 */
export function planServiceSync(params: {
  selection: string[];
  services: SelectableService[];
  measurements: SelectionMeasurement[];
  /** Liefert true, wenn zu dieser Position bereits Formulardaten erfasst wurden. */
  isEdited?: (uid: string) => boolean;
}): SyncPlan {
  const { selection, services, measurements, isEdited } = params;
  const byName = new Map<string, SelectableService>();
  for (const s of services) {
    const key = normalizeToken(s.service_name);
    if (!byName.has(key)) byName.set(key, s);
  }

  const selectedTokens = selection.map((s) => normalizeToken(s)).filter(Boolean);
  const selectedSet = new Set(selectedTokens);

  const fromTemplate = measurements.filter((m) => m.origin === "template");
  const presentTokens = new Set(fromTemplate.map((m) => normalizeToken(m.selection_token ?? m.service_name)));

  const add: SyncPlan["add"] = [];
  const unresolved: string[] = [];
  selection.forEach((raw) => {
    const token = normalizeToken(raw);
    if (!token || presentTokens.has(token)) return;
    const service = byName.get(token);
    if (!service) { unresolved.push(raw.trim()); return; }
    if (add.some((a) => normalizeToken(a.token) === token)) return;
    add.push({ service, token: raw.trim() });
  });

  const remove: string[] = [];
  const keep: string[] = [];
  fromTemplate.forEach((m) => {
    const token = normalizeToken(m.selection_token ?? m.service_name);
    if (selectedSet.has(token)) return;
    if (isEdited?.(m.uid)) keep.push(m.uid);
    else remove.push(m.uid);
  });

  return { add, remove, keep, unresolved };
}
