import { api } from "@/lib/api";
import { sanitizeDraftPayload, type OrderDraftPayload } from "@/lib/api/orderDrafts";
import { cleanDraftTemplateValue, copyTemplateInputs, parseTemplateInput, templateInputAllowed } from "@/lib/orderTemplateInputs";
import { resolveOrderKind } from "@/lib/orders/orderKind";

/**
 * Vorlagen-Kopierlogik für die Auftragserstellung.
 *
 * Grundsätze:
 *  - Es wird ausschließlich GELESEN. Der Quellauftrag bzw. Quellentwurf wird
 *    niemals verändert.
 *  - Es entsteht ein reiner JSON-Snapshot (Deep Copy) — keine geteilten
 *    Referenzen zwischen Original und neuem Entwurf.
 *  - Niemals kopiert werden: Auftragsnummer, Status, Workflowstatus,
 *    Messnummern, Proben-IDs, Messergebnisse, Messwerte, Arbeitszeiten,
 *    Aufgabenzuweisungen und Abschlussinformationen.
 */

export interface CopyOptions {
  services: boolean;
  packages: boolean;
  conditions: boolean;
  orderForm: boolean;
  samples: boolean;
  attachments: boolean;
}

export const DEFAULT_COPY_OPTIONS: CopyOptions = {
  services: true,
  packages: true,
  conditions: true,
  orderForm: true,
  samples: false,
  attachments: false,
};

export const COPY_OPTION_LABELS: Record<keyof CopyOptions, string> = {
  services: "Dienstleistungen",
  packages: "Servicepakete (Herkunft)",
  conditions: "Messbedingungen, Vorgaben & Auswertungsvorgaben",
  orderForm: "Angaben des Auftragsformulars",
  samples: "Proben",
  attachments: "Anhänge",
};

const newUid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `m_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const deepCopy = <T,>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));

/** Schlüssel, die bei jedem Kopiervorgang neu vergeben werden und daher nie Teil eines Wertvergleichs sein dürfen. */
const VOLATILE_KEYS = new Set(["__id", "__instance_id"]);

/** Stabile, schlüsselsortierte JSON-Darstellung ohne flüchtige Identitäten. */
function stableStringify(v: unknown): string {
  if (v == null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const entries = Object.entries(v as Record<string, unknown>)
    .filter(([k]) => !VOLATILE_KEYS.has(k))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, val]) => `${JSON.stringify(k)}:${stableStringify(val)}`);
  return `{${entries.join(",")}}`;
}

/**
 * Fingerabdruck einer Dienstleistungskonfiguration anhand ihrer tatsächlichen
 * fachlichen Werte (Leistung + Formularwerte + Parameter). Frisch vergebene
 * Zeilen-Identitäten (__id/__instance_id) fließen nicht ein.
 */
export function templateRowFingerprint(
  serviceId: string,
  values: Record<string, unknown>,
  params: Record<string, string>
): string {
  return stableStringify({ serviceId, values, params });
}

export interface TemplateRowRef {
  sample_id?: string | null;
  fingerprint: string;
}

/**
 * Fasst Dienstleistungszeilen eines Quellauftrags zu Vorlagenkarten zusammen.
 *
 * Zusammengeführt werden ausschließlich Zeilen, die eindeutig aus der
 * probenweisen Fächerung stammen: gleiche Leistung, identische fachliche
 * Werte und jede Zeile einer eigenen Probe zugeordnet. Bewusst mehrfach
 * gebuchte Leistungen (gleiche Probe oder ohne Probenbezug) und Zeilen mit
 * abweichenden Messbedingungen bleiben immer eigenständige Karten — es wird
 * nie still zusammengeführt und nie automatisch eine Probe ausgewählt.
 *
 * Rückgabe: Gruppen von Zeilenindizes in Reihenfolge des ersten Auftretens;
 * jede Gruppe wird genau eine Vorlagenkarte.
 */
export function consolidateTemplateRows(rows: TemplateRowRef[]): number[][] {
  const byFingerprint = new Map<string, number[]>();
  rows.forEach((row, i) => {
    const list = byFingerprint.get(row.fingerprint) ?? [];
    list.push(i);
    byFingerprint.set(row.fingerprint, list);
  });
  const groups: number[][] = [];
  for (const indexes of byFingerprint.values()) {
    const sampleIds = indexes.map((i) => rows[i].sample_id ?? null);
    const isSampleFanOut =
      indexes.length > 1 &&
      sampleIds.every((id) => id != null) &&
      new Set(sampleIds).size === sampleIds.length;
    if (isSampleFanOut) groups.push([indexes[0]]);
    else for (const i of indexes) groups.push([i]);
  }
  return groups;
}

interface ResolvableField { field_key: string; display_name?: string | null; archived?: boolean | null }

/**
 * Ordnet eine gespeicherte Vorgabe (parameter_name) genau einer aktiven
 * Felddefinition zu. Reihenfolge: direkte Dienstleistungsfelder (field_key,
 * dann display_name), erst danach verknüpfte Formulare (ebenso). Archivierte
 * Felder zählen nie. Mehrere gleichrangige Treffer derselben Stufe sind ein
 * echter Konflikt → Abbruch, nie Auswahl des ersten Treffers.
 */
export function resolveParameterField<S extends ResolvableField, L extends ResolvableField>(
  name: string,
  serviceFields: S[],
  linkedDefinitions: { formId: string; fields: L[] }[],
): { key: string; def: S | L } | undefined {
  const active = (f: ResolvableField) => f.archived !== true;
  const conflict = () => new Error(`Vorgabe „${name}“ ist nicht eindeutig zugeordnet; Vorlage nicht erstellt.`);
  const pick = <T,>(hits: T[]): T | undefined => {
    if (hits.length > 1) throw conflict();
    return hits[0];
  };
  const direct = serviceFields.filter(active);
  const directHit =
    pick(direct.filter(f => f.field_key === name)) ??
    pick(direct.filter(f => f.display_name === name));
  if (directHit) return { key: directHit.field_key, def: directHit };
  const linked = linkedDefinitions.flatMap(link =>
    link.fields.filter(active).map(f => ({ key: `form:${link.formId}:${f.field_key}`, def: f })));
  return pick(linked.filter(c => c.def.field_key === name)) ?? pick(linked.filter(c => c.def.display_name === name));
}

/** Baut aus einem bestehenden Auftrag einen unabhängigen Entwurfs-Payload. */
export async function buildPayloadFromOrder(
  orderId: string,
  opts: CopyOptions
): Promise<{ payload: OrderDraftPayload; label: string }> {
  const order = await api.orders.get(orderId);
  if (!order) throw new Error("Auftrag nicht gefunden");

  const payload: OrderDraftPayload = {
    selectedProjectId: order.project_id ?? "",
    orderType: order.order_type ?? "",
    orderKind: resolveOrderKind(order) === "pilot_plant" ? "pilot_plant" : "labor",
    dueDate: "",
    notes: order.notes ?? "",
    measurements: [],
    selectedSampleIds: [],
    processTemplateId: "__none__",
    measurementParams: {},
    measurementFormValues: {},
    dynamicValues: {},
    dynamicFormId: null,
  };

  // Template values are filtered by their actual definition, never by result records.
  if (opts.orderForm) {
    const tpl = (order.shared_form_data as { template?: { values?: Record<string, unknown>; form_definition_id?: string } } | null)?.template;
    if (tpl?.values && tpl.form_definition_id) {
      const fields = await api.formFields.listForForm(tpl.form_definition_id);
      payload.dynamicValues = copyTemplateInputs(tpl.values, fields);
      payload.dynamicFormId = tpl.form_definition_id;
    }
  }

  if (opts.services) {
    // Zuerst pro Ausführungszeile die fachlichen Werte aufbereiten, danach
    // eindeutige probenweise Fächerungen zu je einer Vorlagenkarte bündeln.
    interface RowBuild {
      service_id: string;
      service_name: string;
      source_package_id: string | null;
      source_package_name: string | null;
      sample_id: string | null;
      values: Record<string, unknown>;
      params: Record<string, string>;
    }
    const rows: RowBuild[] = [];
    for (const m of order.order_measurements ?? []) {
      const row: RowBuild = {
        service_id: m.service_id,
        service_name: m.measurement_services?.service_name ?? "Dienstleistung",
        source_package_id: opts.packages ? m.source_package_id ?? null : null,
        source_package_name: opts.packages ? m.source_package_name_snapshot ?? null : null,
        sample_id: m.sample_id ?? null,
        values: {},
        params: {},
      };
      rows.push(row);
      if (!opts.conditions) continue;
      const [fields, links, legacyDefinitions, layout] = await Promise.all([
        api.serviceDataFields.listForService(m.service_id),
        api.serviceFormLinks.listForService(m.service_id),
        api.serviceParameters.listForService(m.service_id),
        api.serviceFormLayouts.get(m.service_id, "customer"),
      ]);
      const linkedDefinitions = await Promise.all(links.map(async link => ({
        formId: link.form_definition_id,
        fields: await api.formFields.listForForm(link.form_definition_id),
      })));
      const values = row.values;
      const params = row.params;
      const seenParameterNames = new Set<string>();
      for (const p of m.measurement_parameters ?? []) {
        const name = String(p.parameter_name ?? "");
        if (!name) continue;
        if (seenParameterNames.has(name)) throw new Error(`Vorgabe „${name}“ ist mehrfach gespeichert und nicht eindeutig; Vorlage nicht erstellt.`);
        seenParameterNames.add(name);
        const candidate = resolveParameterField(name, fields, linkedDefinitions);
        if (candidate) {
          if (!templateInputAllowed(candidate.def)) continue;
          const parsed = parseTemplateInput(p.parameter_value, candidate.def);
          const ownerFields: Parameters<typeof copyTemplateInputs>[1] = candidate.key.startsWith("form:")
            ? linkedDefinitions.find(link => candidate.key.startsWith(`form:${link.formId}:`))?.fields ?? [] : fields;
          const copied = copyTemplateInputs({ [candidate.def.field_key]: parsed }, ownerFields);
          if (candidate.def.field_key in copied) values[candidate.key] = copied[candidate.def.field_key];
          continue;
        }
        const section = layout?.layout?.sections?.find(sec => sec.repeatable?.enabled && (sec.repeatable.storage_key || `repeat:${sec.id}`) === name);
        if (section) {
          let parsedRows: unknown;
          try { parsedRows = JSON.parse(p.parameter_value); } catch { throw new Error(`Wiederholungsbereich „${name}“ ist nicht lesbar`); }
          if (!Array.isArray(parsedRows)) throw new Error(`Wiederholungsbereich „${name}“ ist nicht lesbar`);
          const childFields = fields.filter(f => section.fields.some(ref => ref.field_id === f.id));
          values[name] = parsedRows.map(r => ({ ...copyTemplateInputs(r, childFields), __id: newUid() }));
          continue;
        }
        const definitions = legacyDefinitions.filter(d => d.parameter_name === name);
        if (definitions.length === 1) params[definitions[0].id] = String(p.parameter_value ?? "");
        else throw new Error(`Vorgabe „${name}“ hat keine eindeutige Felddefinition; Vorlage nicht erstellt.`);
      }
    }
    // Konsolidierung: probenweise gefächerte, fachlich identische Zeilen
    // werden zu je einer Vorlagenkarte; die neue Probenanzahl ist dadurch
    // unabhängig von der ursprünglichen. Abweichende Messbedingungen und
    // bewusste Mehrfachbuchungen bleiben eigenständige Karten.
    const groups = consolidateTemplateRows(
      rows.map((r) => ({ sample_id: r.sample_id, fingerprint: templateRowFingerprint(r.service_id, r.values, r.params) }))
    );
    for (const group of groups) {
      const row = rows[group[0]];
      const uid = newUid();
      payload.measurements?.push({
        uid,
        service_id: row.service_id,
        service_name: row.service_name,
        origin: "manual",
        source_package_id: row.source_package_id,
        source_package_name: row.source_package_name,
      });
      if (opts.conditions) {
        if (payload.measurementFormValues) payload.measurementFormValues[uid] = row.values;
        if (payload.measurementParams) payload.measurementParams[uid] = row.params;
      }
    }
  }

  // Proben werden bewusst NICHT mit ihren alten Identifikationen übernommen.
  // Nur wenn explizit gewünscht, werden die Probenreferenzen mitkopiert.
  if (opts.samples) {
    const ids = (order.order_samples ?? []).map((s) => s.sample_id).filter(Boolean);
    payload.selectedSampleIds = [...new Set(ids)];
  }

  const label = order.order_number ? `Auftrag ${order.order_number}` : "Auftrag";
  return { payload: deepCopy(payload), label };
}

/** Baut aus einem bestehenden Entwurf einen unabhängigen Entwurfs-Payload. */
export function buildPayloadFromDraft(
  source: OrderDraftPayload,
  opts: CopyOptions
): OrderDraftPayload {
  const src = cleanDraftTemplateValue(sanitizeDraftPayload(source)) as OrderDraftPayload;
  const out: OrderDraftPayload = {
    selectedProjectId: src.selectedProjectId ?? "",
    orderType: src.orderType ?? "",
    orderKind: src.orderKind ?? "labor",
    dueDate: "",
    notes: src.notes ?? "",
    measurements: [],
    selectedSampleIds: opts.samples ? src.selectedSampleIds ?? [] : [],
    processTemplateId: src.processTemplateId ?? "__none__",
    measurementParams: {},
    measurementFormValues: {},
    dynamicValues: opts.orderForm ? src.dynamicValues ?? {} : {},
    dynamicFormId: opts.orderForm ? src.dynamicFormId ?? null : null,
  };

  if (opts.services) {
    for (const m of src.measurements ?? []) {
      const uid = newUid();
      out.measurements?.push({
        uid,
        service_id: m.service_id,
        service_name: m.service_name,
        origin: "manual",
        source_package_id: opts.packages ? m.source_package_id ?? null : null,
        source_package_name: opts.packages ? m.source_package_name ?? null : null,
      });
      if (opts.conditions && src.measurementFormValues?.[m.uid]) {
        if (out.measurementFormValues) out.measurementFormValues[uid] = deepCopy(src.measurementFormValues[m.uid]);
      }
      if (opts.conditions && src.measurementParams?.[m.uid]) {
        if (out.measurementParams) out.measurementParams[uid] = deepCopy(src.measurementParams[m.uid]);
      }
    }
  }
  return out;
}

/** Designer metadata also filters draft copies; direct restoration never uses this copier. */
export async function buildValidatedPayloadFromDraft(source: OrderDraftPayload, opts: CopyOptions): Promise<OrderDraftPayload> {
  const out = buildPayloadFromDraft(source, opts);
  if (opts.orderForm && out.dynamicFormId && out.dynamicValues) {
    out.dynamicValues = copyTemplateInputs(out.dynamicValues, await api.formFields.listForForm(out.dynamicFormId));
  }
  for (const m of out.measurements ?? []) {
    const values = out.measurementFormValues?.[m.uid];
    if (!values) continue;
    const [fields, links, layout] = await Promise.all([
      api.serviceDataFields.listForService(m.service_id), api.serviceFormLinks.listForService(m.service_id), api.serviceFormLayouts.get(m.service_id, "customer"),
    ]);
    const clean = copyTemplateInputs(values, fields);
    for (const section of layout?.layout?.sections ?? []) {
      if (!section.repeatable?.enabled) continue;
      const key = section.repeatable.storage_key || `repeat:${section.id}`;
      const rows = values[key];
      if (Array.isArray(rows)) clean[key] = rows.map(row => ({ ...copyTemplateInputs(row, fields.filter(f => section.fields.some(ref => ref.field_id === f.id))), __id: newUid() }));
    }
    for (const link of links) {
      const prefix = `form:${link.form_definition_id}:`;
      const formValues = Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key.slice(prefix.length), value]));
      const copied = copyTemplateInputs(formValues, await api.formFields.listForForm(link.form_definition_id));
      for (const [key, value] of Object.entries(copied)) clean[`${prefix}${key}`] = value;
    }
    if (out.measurementFormValues) out.measurementFormValues[m.uid] = clean;
  }
  return out;
}

export interface TemplateDiffEntry {
  uid: string;
  serviceName: string;
  fieldKey: string;
  baseline: string;
  current: string;
}

const norm = (v: unknown) =>
  v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);

/**
 * Vergleicht die aktuellen Messbedingungen mit dem Stand der Vorlage.
 * Rein lesend, ohne Persistenz — die Struktur ist so gewählt, dass später
 * eine nachvollziehbare Historie ergänzt werden kann.
 */
export function diffAgainstBaseline(
  baseline: OrderDraftPayload | null | undefined,
  current: OrderDraftPayload
): { copiedCount: number; changed: TemplateDiffEntry[] } {
  if (!baseline) return { copiedCount: 0, changed: [] };
  let copiedCount = 0;
  const changed: TemplateDiffEntry[] = [];

  const baseMeas = baseline.measurements ?? [];
  const curMeas = current.measurements ?? [];

  for (const bm of baseMeas) {
    const cm = curMeas.find((m) => m.uid === bm.uid);
    const bVals = baseline.measurementFormValues?.[bm.uid] ?? {};
    copiedCount += Object.keys(bVals).length;
    if (!cm) continue;
    const cVals = current.measurementFormValues?.[cm.uid] ?? {};
    for (const [k, bv] of Object.entries(bVals)) {
      const cv = (cVals as Record<string, unknown>)[k];
      if (norm(bv) !== norm(cv)) {
        changed.push({
          uid: cm.uid,
          serviceName: cm.service_name,
          fieldKey: k,
          baseline: norm(bv),
          current: norm(cv),
        });
      }
    }
  }
  return { copiedCount, changed };
}
