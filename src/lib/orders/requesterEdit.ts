/**
 * Bearbeitung eigener, noch nicht begonnener Aufträge durch den Auftraggeber.
 * Reine Hilfsfunktionen: Abgleich von Dienstleistungen und Vorgaben zwischen
 * dem geladenen Ausgangsstand und dem bearbeiteten Formular.
 * Serverseitige Freigabe: order_requester_edit_state / Trigger (maßgeblich).
 */

export interface ParamRow { name: string; value: string; unit: string | null }
export interface ExistingParam { id: string; parameter_name: string; parameter_value: string | null }

export interface FieldDef { field_key: string; display_name?: string | null; unit?: string | null; field_type?: string | null }
export interface LegacyDef { id: string; parameter_name: string; unit?: string | null }

const isUploadValue = (v: unknown) =>
  Array.isArray(v) && v.length > 0 &&
  v.every((x) => x && typeof x === "object" && "__id" in x && ("pendingFile" in x || "templateId" in x || "storagePath" in x));

const stringify = (v: unknown) =>
  typeof v === "boolean" ? (v ? "true" : "false")
    : (Array.isArray(v) || (v && typeof v === "object")) ? JSON.stringify(v)
    : String(v);

/** Vorgaben-Zeilen wie bei der Neuanlage (ohne Datei-Uploads). */
export function buildRequesterParameterRows(input: {
  formValues: Record<string, unknown> | undefined;
  params: Record<string, string> | undefined;
  fields: FieldDef[];
  legacyDefs: LegacyDef[];
  linkedFields: Record<string, FieldDef[]>;
  parseLinkedKey: (key: string) => { formId: string; fieldKey: string } | null;
}): ParamRow[] {
  const rows: ParamRow[] = [];
  for (const [id, value] of Object.entries(input.params ?? {})) {
    const def = input.legacyDefs.find((d) => d.id === id);
    if (def && (value || "").trim()) rows.push({ name: def.parameter_name, value, unit: def.unit || null });
  }
  const uploadKeys = new Set(input.fields.filter((f) => f.field_type === "file" || f.field_type === "image").map((f) => f.field_key));
  for (const [key, v] of Object.entries(input.formValues ?? {})) {
    if (v == null) continue;
    const linked = input.parseLinkedKey(key);
    if (linked) {
      if (typeof v === "string" && v.trim() === "") continue;
      const def = (input.linkedFields[linked.formId] ?? []).find((x) => x.field_key === linked.fieldKey);
      rows.push({ name: def?.display_name || linked.fieldKey, value: stringify(v), unit: def?.unit || null });
      continue;
    }
    if (uploadKeys.has(key) && isUploadValue(v)) continue;
    if (key.startsWith("repeat:") && Array.isArray(v)) {
      if (v.length === 0) continue;
      const cleaned = v.map((entry) => {
        if (!entry || typeof entry !== "object") return entry;
        const out: Record<string, unknown> = {};
        for (const [ek, ev] of Object.entries(entry as Record<string, unknown>)) {
          if (!(uploadKeys.has(ek) && isUploadValue(ev))) out[ek] = ev;
        }
        return out;
      });
      rows.push({ name: key, value: JSON.stringify(cleaned), unit: null });
      continue;
    }
    if (typeof v === "string" && v.trim() === "") continue;
    const f = input.fields.find((x) => x.field_key === key);
    rows.push({ name: f?.display_name || key, value: stringify(v), unit: f?.unit || null });
  }
  return rows;
}

export class AmbiguousParameterError extends Error {
  constructor(public parameterName: string) {
    super(`Vorgabe „${parameterName}“ ist mehrfach vorhanden und kann nicht eindeutig geändert werden.`);
  }
}

/**
 * Abgleich: nur tatsächlich geänderte Vorgaben werden geändert (mit Historie),
 * neue ergänzt, geleerte auf "" gesetzt. Unbekannte, nicht aus dem Formular
 * stammende Vorgaben bleiben unangetastet.
 */
export function diffRequesterParameters(existing: ExistingParam[], baseline: ParamRow[], next: ParamRow[]) {
  const amend: Array<{ id: string; name: string; value: string }> = [];
  const insert: ParamRow[] = [];
  const base = new Map(baseline.map((r) => [r.name, r.value]));
  const nextNames = new Set(next.map((r) => r.name));
  const find = (name: string) => {
    const hits = existing.filter((p) => p.parameter_name === name);
    if (hits.length > 1) throw new AmbiguousParameterError(name);
    return hits[0];
  };
  for (const row of next) {
    if (base.has(row.name) && base.get(row.name) === row.value) continue;
    const hit = find(row.name);
    if (!hit) insert.push(row);
    else if ((hit.parameter_value ?? "") !== row.value) amend.push({ id: hit.id, name: row.name, value: row.value });
  }
  for (const name of base.keys()) {
    if (nextNames.has(name)) continue;
    const hit = find(name);
    if (hit && (hit.parameter_value ?? "") !== "") amend.push({ id: hit.id, name, value: "" });
  }
  return { amend, insert };
}

/** Welche Dienstleistungs-Positionen bleiben, entfallen oder kommen hinzu. */
export function planServiceChanges(original: Record<string, string[]>, currentUids: string[]) {
  const current = new Set(currentUids);
  const kept = Object.keys(original).filter((uid) => current.has(uid));
  const removedMeasurementIds = Object.entries(original).filter(([uid]) => !current.has(uid)).flatMap(([, ids]) => ids);
  const addedUids = currentUids.filter((uid) => !(uid in original));
  return { kept, removedMeasurementIds, addedUids };
}

export type RequesterEditReason = "forbidden" | "started" | "locked" | "internal" | "not_found" | "not_authenticated" | null;
export interface RequesterEditState { can_edit: boolean; reason: RequesterEditReason }

// ---------------------------------------------------------------------------
// Bearbeitungsmodus: geladene Positionen wiedererkennen, PP-Stammdaten ergänzen
// ---------------------------------------------------------------------------

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export interface LoadedPosition { uid: string; service_id: string; service_name: string; origin?: string; selection_token?: string | null }
export interface SelectionRef { token: string; aliases?: string[]; service_id?: string | null }

/**
 * Ordnet jede Formularauswahl genau einer geladenen Position derselben
 * Dienstleistung zu (uid bleibt stabil) und markiert sie als Formularposition,
 * damit der Auswahlabgleich keine leeren Duplikate erzeugt. Nicht zuordenbare
 * Positionen bleiben unverändert (zusätzliche Dienstleistungen).
 */
export function adoptLoadedSelection<T extends LoadedPosition>(
  positions: T[],
  selection: SelectionRef[],
  services: Array<{ id: string; service_name: string }>,
): T[] {
  const out = positions.map((p) => ({ ...p }));
  const used = new Set<string>();
  for (const entry of selection) {
    const names = new Set([entry.token, ...(entry.aliases ?? [])].map(norm).filter(Boolean));
    const serviceId = entry.service_id
      ?? services.find((s) => names.has(norm(s.service_name)))?.id
      ?? null;
    const hit = out.find((p) => !used.has(p.uid) && p.origin !== "rule" && p.origin !== "template"
      && (serviceId ? p.service_id === serviceId : names.has(norm(p.service_name))));
    if (!hit) continue;
    used.add(hit.uid);
    hit.origin = "template";
    hit.selection_token = entry.token;
  }
  return out;
}

/** Spalte → zulässige Feldschlüssel (exakt, keine Namensheuristik). */
export const PP_COLUMN_FIELDS: Record<string, { binding: string; keys: string[] }> = {
  pp_experiment_number: { binding: "order.versuchsnummer", keys: ["versuchsnummer", "pp_experiment_number"] },
  pp_experiment_date: { binding: "order.pp_experiment_date", keys: ["versuchsdatum", "pp_experiment_date"] },
  pp_masse_type: { binding: "order.pp_masse_type", keys: ["massetyp", "pp_masse_type"] },
  pp_v2o5_percent: { binding: "order.pp_v2o5_percent", keys: ["v2o5", "v2o5_percent", "pp_v2o5_percent"] },
  pp_previous_experiments: { binding: "order.pp_previous_experiments", keys: ["fruehere_versuche", "pp_previous_experiments"] },
  pp_remarks: { binding: "order.pp_remarks", keys: ["bemerkungen", "pp_remarks"] },
};

const isEmpty = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

/**
 * Ergänzt fehlende Formularwerte aus den Pilot-Plant-Spalten des Auftrags.
 * Vorhandene Werte werden nie überschrieben; mehrdeutige Felder bleiben leer.
 */
export function applyPilotPlantColumnFallback(
  values: Record<string, unknown>,
  fields: Array<{ field_key: string; binding_path?: string | null; field_type?: string | null }>,
  order: Record<string, unknown> | null | undefined,
): { values: Record<string, unknown>; filled: string[] } {
  const next = { ...values };
  const filled: string[] = [];
  if (!order) return { values: next, filled };
  for (const [column, spec] of Object.entries(PP_COLUMN_FIELDS)) {
    const raw = order[column];
    if (isEmpty(raw)) continue;
    const bound = fields.filter((f) => f.binding_path === spec.binding);
    const targets = bound.length ? bound : fields.filter((f) => spec.keys.includes(f.field_key));
    if (targets.length !== 1) continue;
    const field = targets[0];
    if (!isEmpty(next[field.field_key])) continue;
    let value: unknown = raw;
    if (field.field_type === "date") value = String(raw).slice(0, 10);
    else if (["number", "decimal", "percent"].includes(field.field_type ?? "")) {
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      value = n;
    } else if (typeof raw !== "string") value = String(raw);
    next[field.field_key] = value;
    filled.push(field.field_key);
  }
  return { values: next, filled };
}
