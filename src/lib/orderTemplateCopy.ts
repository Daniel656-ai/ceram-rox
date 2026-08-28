import { api } from "@/lib/api";
import type { OrderDraftPayload } from "@/lib/api/orderDrafts";

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
    orderKind: order.order_kind === "pilot_plant" ? "pilot_plant" : "labor",
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

  // --- Auftragsformular (Auftragsart-Vorlage) ---
  if (opts.orderForm) {
    const tpl = order.shared_form_data?.template;
    if (tpl?.values) {
      payload.dynamicValues = deepCopy(tpl.values);
      payload.dynamicFormId = tpl.form_definition_id ?? null;
    }
  }

  // --- Dienstleistungen (je Kombination Dienstleistung × Paketherkunft einmal) ---
  if (opts.services) {
    const seen = new Set<string>();
    for (const m of (order.order_measurements ?? []) as any[]) {
      const pkgId = opts.packages ? m.source_package_id ?? null : null;
      const key = `${m.service_id}::${pkgId ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const uid = newUid();
      payload.measurements!.push({
        uid,
        service_id: m.service_id,
        service_name: m.measurement_services?.service_name ?? "Dienstleistung",
        source_package_id: pkgId,
        source_package_name: opts.packages ? m.source_package_name_snapshot ?? null : null,
      });

      // --- Messbedingungen / Vorgaben aus den gespeicherten Parametern ---
      if (opts.conditions) {
        const params = (m.measurement_parameters ?? []) as any[];
        if (params.length === 0) continue;
        let fields: any[] = [];
        try {
          fields = (await api.serviceDataFields.listForService(m.service_id)) as any[];
        } catch {
          fields = [];
        }
        const byDisplay = new Map<string, any>();
        for (const f of fields) byDisplay.set(String(f.display_name ?? f.field_key), f);

        const values: Record<string, unknown> = {};
        for (const p of params) {
          const name = String(p.parameter_name ?? "");
          if (!name) continue;
          if (name.startsWith("repeat:")) {
            try {
              values[name] = JSON.parse(p.parameter_value);
            } catch {
              /* nicht interpretierbare Werte werden bewusst verworfen */
            }
            continue;
          }
          const def = byDisplay.get(name);
          if (!def) continue; // kein zuordenbares Feld → nicht übernehmen
          // Upload-/Bildfelder werden nie kopiert (Anhänge separat).
          if (def.field_type === "file" || def.field_type === "image") continue;
          const raw = p.parameter_value;
          if (raw == null || raw === "") continue;
          if (def.field_type === "boolean") values[def.field_key] = raw === "true";
          else if (def.field_type === "multiselect") {
            try {
              values[def.field_key] = JSON.parse(raw);
            } catch {
              values[def.field_key] = raw;
            }
          } else values[def.field_key] = raw;
        }
        if (Object.keys(values).length > 0) payload.measurementFormValues![uid] = values;
      }
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
  const src = deepCopy(source) ?? {};
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
      out.measurements!.push({
        uid,
        service_id: m.service_id,
        service_name: m.service_name,
        source_package_id: opts.packages ? m.source_package_id ?? null : null,
        source_package_name: opts.packages ? m.source_package_name ?? null : null,
      });
      if (opts.conditions && src.measurementFormValues?.[m.uid]) {
        out.measurementFormValues![uid] = deepCopy(src.measurementFormValues[m.uid]);
      }
      if (opts.conditions && src.measurementParams?.[m.uid]) {
        out.measurementParams![uid] = deepCopy(src.measurementParams[m.uid]);
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
