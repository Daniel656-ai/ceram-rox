import { api } from "@/lib/api";
import type { OrderDraftPayload } from "@/lib/api/orderDrafts";
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

/** Baut aus einem bestehenden Auftrag einen unabhängigen Entwurfs-Payload. */
export async function buildPayloadFromOrder(
  orderId: string,
  opts: CopyOptions
): Promise<{ payload: OrderDraftPayload; label: string }> {
  const order: any = await api.orders.get(orderId);
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
    const tpl = order.shared_form_data?.template;
    if (tpl?.values && tpl.form_definition_id) {
      const fields = await api.formFields.listForForm(tpl.form_definition_id);
      payload.dynamicValues = copyTemplateInputs(tpl.values, fields);
      payload.dynamicFormId = tpl.form_definition_id;
    }
  }

  if (opts.services) {
    for (const m of (order.order_measurements ?? []) as any[]) {
      const uid = newUid();
      payload.measurements?.push({
        uid, service_id: m.service_id,
        service_name: m.measurement_services?.service_name ?? "Dienstleistung",
        origin: "manual",
        source_package_id: opts.packages ? m.source_package_id ?? null : null,
        source_package_name: opts.packages ? m.source_package_name_snapshot ?? null : null,
      });
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
      const values: Record<string, unknown> = {};
      const params: Record<string, string> = {};
      for (const p of (m.measurement_parameters ?? []) as any[]) {
        const name = String(p.parameter_name ?? "");
        if (!name) continue;
        const candidates = [
          ...fields.filter(f => f.field_key === name || f.display_name === name).map(f => ({ key: f.field_key, def: f })),
          ...linkedDefinitions.flatMap(link => link.fields.filter(f => f.field_key === name || f.display_name === name)
            .map(f => ({ key: `form:${link.formId}:${f.field_key}`, def: f }))),
        ];
        if (candidates.length > 1) throw new Error(`Vorgabe „${name}“ ist nicht eindeutig zugeordnet; Vorlage nicht erstellt.`);
        const candidate = candidates[0];
        if (candidate) {
          if (!templateInputAllowed(candidate.def)) continue;
          const parsed = parseTemplateInput(p.parameter_value, candidate.def);
          const ownerFields = candidate.key.startsWith("form:")
            ? linkedDefinitions.find(link => candidate.key.startsWith(`form:${link.formId}:`))?.fields ?? [] : fields;
          const copied = copyTemplateInputs({ [candidate.def.field_key]: parsed }, ownerFields);
          if (candidate.def.field_key in copied) values[candidate.key] = copied[candidate.def.field_key];
          continue;
        }
        const section = layout?.layout?.sections?.find(sec => sec.repeatable?.enabled && (sec.repeatable.storage_key || `repeat:${sec.id}`) === name);
        if (section) {
          let rows: unknown;
          try { rows = JSON.parse(p.parameter_value); } catch { throw new Error(`Wiederholungsbereich „${name}“ ist nicht lesbar`); }
          if (!Array.isArray(rows)) throw new Error(`Wiederholungsbereich „${name}“ ist nicht lesbar`);
          const childFields = fields.filter(f => section.fields.some(ref => ref.field_id === f.id));
          values[name] = rows.map(row => ({ ...copyTemplateInputs(row, childFields), __id: newUid() }));
          continue;
        }
        const definitions = legacyDefinitions.filter(d => d.parameter_name === name);
        if (definitions.length === 1) params[definitions[0].id] = String(p.parameter_value ?? "");
        else throw new Error(`Vorgabe „${name}“ hat keine eindeutige Felddefinition; Vorlage nicht erstellt.`);
      }
      if (payload.measurementFormValues) payload.measurementFormValues[uid] = values;
      if (payload.measurementParams) payload.measurementParams[uid] = params;
    }
  }

  // Proben werden bewusst NICHT mit ihren alten Identifikationen übernommen.
  // Nur wenn explizit gewünscht, werden die Probenreferenzen mitkopiert.
  if (opts.samples) {
    const ids = ((order.order_samples ?? []) as any[]).map((s) => s.sample_id).filter(Boolean);
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
  const src = cleanDraftTemplateValue(deepCopy(source)) as OrderDraftPayload;
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
