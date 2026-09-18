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

/** Ein Auswahlwert samt seiner Bezeichnung aus der Stammdatenliste. */
export interface SelectionEntry {
  /** Gespeicherter Auswahlwert – bleibt die Identität der Position. */
  token: string;
  /** Weitere Schreibweisen (z.B. Anzeigebezeichnung der Stammdatenliste). */
  aliases: string[];
}

export interface SelectionField {
  field_key: string;
  display_name?: string | null;
  field_type?: string | null;
  select_options?: Array<string | { label?: string | null; value?: string | null }> | null;
}

const SERVICE_FIELD_NAMES = new Set([
  "dienstleistungen",
  "dienstleistung",
  "services",
  "service",
]);

const isServiceField = (f: SelectionField): boolean => {
  const type = (f.field_type ?? "").toLowerCase();
  if (type && type !== "multiselect" && type !== "select") return false;
  const byName = normalizeToken(f.display_name);
  const byKey = normalizeToken(f.field_key);
  return SERVICE_FIELD_NAMES.has(byName) || SERVICE_FIELD_NAMES.has(byKey);
};

/**
 * Findet die Auswahl der Mehrfachauswahl "Dienstleistungen" im Formular –
 * inklusive der Bezeichnungen aus der verknüpften Stammdatenliste. Stammdaten
 * speichern den technischen Wert (`item_value`); der Dienstleistungskatalog
 * kennt aber den Namen. Deshalb werden beide Schreibweisen mitgeführt.
 */
export function readServiceSelectionEntries(
  values: Record<string, any>,
  fields: SelectionField[]
): SelectionEntry[] {
  const out: SelectionEntry[] = [];
  const seen = new Set<string>();

  for (const f of fields.filter(isServiceField)) {
    const labelByValue = new Map<string, string>();
    for (const o of f.select_options ?? []) {
      if (!o || typeof o === "string") continue;
      const v = normalizeToken(o.value);
      const l = String(o.label ?? "").trim();
      if (v && l) labelByValue.set(v, l);
    }

    const raw = values[f.field_key];
    const list = Array.isArray(raw) ? raw : raw == null || raw === "" ? [] : [raw];
    for (const entry of list) {
      const isObj = typeof entry === "object" && entry !== null;
      const token = String(
        isObj ? ((entry as any).value ?? (entry as any).label ?? "") : entry
      ).trim();
      if (!token) continue;
      const key = normalizeToken(token);
      if (seen.has(key)) continue;
      seen.add(key);
      const aliases = new Set<string>();
      if (isObj && (entry as any).label) aliases.add(String((entry as any).label).trim());
      const fromList = labelByValue.get(key);
      if (fromList) aliases.add(fromList);
      out.push({
        token,
        aliases: [...aliases].filter((a) => a && normalizeToken(a) !== key),
      });
    }
  }
  return out;
}

/** Nur die gespeicherten Auswahlwerte (Kompatibilität). */
export function readServiceSelection(
  values: Record<string, any>,
  fields: SelectionField[]
): string[] {
  return readServiceSelectionEntries(values, fields).map((e) => e.token);
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
