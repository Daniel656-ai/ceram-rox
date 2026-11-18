import { toast } from "sonner";
import { api } from "@/lib/api";
import { parseLinkedFormValueKey } from "@/components/ServiceLinkedForms";
import { buildFormValueResultPayload } from "@/lib/orderFormValueHandover";
import { ruleStepKey } from "@/lib/ruleEvaluation";
import type { OrderDraftPayload } from "@/lib/api/orderDrafts";

/**
 * Anlege-Ablauf der Seite „Auftrag erstellen“ – 1:1 aus `CreateOrderPage.tsx` herausgelöst
 * (Stufe 0 von „Auftrag bearbeiten“: keine Verhaltensänderung, nur Struktur).
 *
 * Reihenfolge und Fehlerbehandlung sind unverändert:
 *   1. persistOrderLevelData   – Pilot-Plant-Bausteine, Auftragsformular, Prozessvorlage, Proben
 *   2. createMeasurementTasks  – je Probe und Dienstleistung eine Aufgabe inkl. Vorgaben/Formularwerte/Uploads
 *   3. runPostCreateSyncs      – Regel-Auslöser und „Mundstück 293/1“ abgleichen
 * Die Seite bleibt der Ablaufleiter (Auftrag anlegen, Entwurf verwerfen, Navigation).
 */

/** Eine gewählte Dienstleistung/Messung der Maske (Karte). */
export interface SelectedMeasurement {
  uid: string;
  service_id: string;
  service_name: string;
  /** "template" = aus der Auswahl im Auftraggeberformular, "manual" = zusätzlich gebucht. */
  origin?: "template" | "manual" | "rule";
  /** Nur bei origin "rule": auslösende Position und Regel. */
  rule_source_uid?: string | null;
  rule_id?: string | null;
  /** Auswahlwert, aus dem die Position entstanden ist. */
  selection_token?: string | null;
  source_package_id?: string | null;
  source_package_name?: string | null;
}

/** Minimale Form einer React-Query-Mutation (`mutateAsync`), damit der Ablauf ohne React testbar ist. */
export interface AddMeasurementMutation {
  mutateAsync: (input: any) => Promise<{ id: string }>;
}

export interface PersistOrderLevelInput {
  order: { id: string; order_number?: string | null };
  user: { id: string };
  orderKind: "labor" | "pilot_plant";
  dynamicFormId: string | null;
  dynamicValues: Record<string, any>;
  processTemplateId: string;
  processTemplates: any[];
  projectId: string | null;
  selectedSampleIds: string[];
}

/** Schritte direkt nach dem Anlegen des Auftrags (alle mit eigener Fehlermeldung, ohne den Auftrag zu verwerfen). */
export async function persistOrderLevelData(input: PersistOrderLevelInput): Promise<void> {
  const { order, user, orderKind, dynamicFormId, dynamicValues, processTemplateId, processTemplates, projectId, selectedSampleIds } = input;
  // Pilot Plant: seed process blocks. Alle fachlichen Angaben kommen aus
  // dem konfigurierten Auftraggeberformular (siehe unten), nicht aus Code.
  if (orderKind === "pilot_plant") {
    try {
      await api.pilotPlantBlocks.seed(order.id);
    } catch (err: any) {
      toast.error(`Pilot-Plant-Bausteine: ${err.message}`);
    }
  }


  // Persist template-driven dynamic form values (no hardcoded fields).
  if (dynamicFormId && Object.keys(dynamicValues).length > 0) {
    try {
      await api.orderSharedFormData.merge(order.id, {
        template: {
          form_definition_id: dynamicFormId,
          order_kind: orderKind,
          values: dynamicValues,
          saved_at: new Date().toISOString(),
          saved_by: user.id,
        },
      });
    } catch (err: any) {
      toast.error(`Formularvorlage: ${err.message}`);
    }
  }

  // Phase 5: If a process template was selected, spin up an order_instance
  // linked to this measurement_order and seed its workflow steps.
  if (processTemplateId && processTemplateId !== "__none__") {
    try {
      const tpl = (processTemplates as any[]).find(t => t.id === processTemplateId);
      let snapshot: Record<string, unknown> | null = null;
      try { snapshot = await api.processTemplates.snapshot(processTemplateId); } catch { /* optional */ }
      const instance = await api.orderInstances.create({
        template_id: processTemplateId,
        template_snapshot: snapshot,
        project_id: projectId,
        legacy_order_id: order.id,
        order_number: order.order_number,
        title: tpl?.name ?? null,
        status: "planned",
        sample_ids: selectedSampleIds.length > 0 ? selectedSampleIds : null,
        shared_data: {},
        created_by: user.id,
      });
      await api.workflowEngine.seedFromTemplate(instance.id, processTemplateId);
    } catch (err: any) {
      toast.error(`Prozessvorlage: ${err.message}`);
    }
  }





  // Alle ausgewählten Proben dem Auftrag zuordnen (n:m)
  if (selectedSampleIds.length > 0) {
    try {
      await api.orderSamples.add(order.id, selectedSampleIds, user.id);
    } catch (err: any) {
      toast.error(`Probenzuordnung: ${err.message}`);
    }
  }
}

export interface CreateMeasurementTasksInput {
  order: { id: string };
  user: { id: string };
  effectiveMeasurements: SelectedMeasurement[];
  selectedSampleIds: string[];
  dueDate: string;
  measurementParams: Record<string, Record<string, string>>;
  measurementFormValues: Record<string, Record<string, any>>;
  addMeasurement: AddMeasurementMutation;
}

/**
 * Je Probe und Dienstleistung eine eigene Aufgabe anlegen (damit Ergebnisse eindeutig der jeweiligen Probe
 * zugeordnet bleiben) und deren Auftraggeber-Vorgaben, Formularwerte und Uploads speichern.
 */
export async function createMeasurementTasks(input: CreateMeasurementTasksInput): Promise<void> {
  const { order, user, effectiveMeasurements, selectedSampleIds, dueDate, measurementParams, measurementFormValues, addMeasurement } = input;
  // Je Probe und Dienstleistung entsteht eine eigene Aufgabe, damit
  // Ergebnisse eindeutig der jeweiligen Probe zugeordnet bleiben.
  const sampleTargets: Array<string | null> =
    selectedSampleIds.length > 0 ? selectedSampleIds : [null];

  const createdByUidSample = new Map<string, string>();
  for (let idx = 0; idx < effectiveMeasurements.length * sampleTargets.length; idx++) {
    const m = effectiveMeasurements[Math.floor(idx / sampleTargets.length)];
    const sampleTarget = sampleTargets[idx % sampleTargets.length];
    const isRule = m.origin === "rule";
    // Duplikatschutz: bereits (z.B. über feste Abhängigkeit) vorhanden → nicht erneut anlegen.
    if (isRule && (await api.ruleTriggers.exists(order.id, m.service_id, sampleTarget))) continue;
    const createdMeasurement = await addMeasurement.mutateAsync({
      order_id: order.id, service_id: m.service_id,
      sample_id: sampleTarget,
      due_date: dueDate || undefined,
      source_package_id: m.source_package_id ?? null,
      source_package_name_snapshot: m.source_package_name ?? null,
      ...(isRule
        ? {
            origin: "workflow" as const,
            source_measurement_id: createdByUidSample.get(`${m.rule_source_uid}|${sampleTarget}`) ?? null,
            source_step_key: m.rule_id ? ruleStepKey(m.rule_id) : null,
          }
        : {}),
    });
    createdByUidSample.set(`${m.uid}|${sampleTarget}`, createdMeasurement.id);
    const params = measurementParams[m.uid];
    if (params && Object.keys(params).length > 0) {
      const defs = await api.serviceParameters.listByIdsForService(m.service_id, Object.keys(params));
      if (defs && defs.length > 0) {
        const inserts = defs.filter((d: any) => (params[d.id] || "").trim()).map((d: any) => ({ order_measurement_id: createdMeasurement.id, parameter_name: d.parameter_name, parameter_value: params[d.id], unit: d.unit || null }));
        if (inserts.length > 0) { await api.measurementParameters.bulkInsert(inserts); }
      }
    }
    // Service Designer Formulardaten persistieren
    const formVals = measurementFormValues[m.uid];
    if (formVals && Object.keys(formVals).length > 0) {
      const fields = await api.serviceDataFields.listForService(m.service_id);
      const uploadKeys = new Set(
        fields.filter((f: any) => f.field_type === "file" || f.field_type === "image").map((f: any) => f.field_key)
      );

      // Helper: is this value an upload-field value? (array of UploadValueEntry)
      const isUploadValue = (v: any) =>
        Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === "object" && "__id" in x && ("pendingFile" in x || "templateId" in x || "storagePath" in x));

      // Process a single upload entry
      const persistUpload = async (fieldKey: string, entryIndex: number | null, entry: any) => {
        try {
          if (entry.pendingFile instanceof File) {
            await api.orderUploads.uploadFile({
              measurementId: createdMeasurement.id,
              fieldKey,
              entryIndex,
              file: entry.pendingFile,
              uploadedBy: user!.id,
            });
          } else if (entry.templateId) {
            const templates = await api.serviceFieldTemplates.listForField(
              (fields.find((f: any) => f.field_key === fieldKey) as any)?.id
            );
            const tpl = templates.find((t: any) => t.id === entry.templateId);
            if (tpl) {
              await api.orderUploads.attachTemplate({
                measurementId: createdMeasurement.id,
                fieldKey,
                entryIndex,
                template: tpl,
                uploadedBy: user!.id,
              });
            }
          }
        } catch (err: any) {
          toast.error(`Upload „${entry.name}" fehlgeschlagen`, { description: err.message });
        }
      };

      // Split values: uploads vs. parameters, including inside repeatable arrays
      const paramInserts: Array<{ order_measurement_id: string; parameter_name: string; parameter_value: string; unit: string | null }> = [];
      // Werte verknüpfter Formulare (Dienstleistung → Formular) je Aufgabe
      const linkedFormValues: Array<{ formId: string; fieldKey: string; value: any }> = [];
      for (const [key, v] of Object.entries(formVals)) {
        if (v == null) continue;

        const linked = parseLinkedFormValueKey(key);
        if (linked) {
          linkedFormValues.push({ formId: linked.formId, fieldKey: linked.fieldKey, value: v });
          continue;
        }


        // Top-level upload field
        if (uploadKeys.has(key) && isUploadValue(v)) {
          for (const entry of v as any[]) await persistUpload(key, null, entry);
          continue;
        }

        // Repeatable section: array of entries
        if (key.startsWith("repeat:") && Array.isArray(v)) {
          if (v.length === 0) continue;
          // Extract upload entries from each repeatable entry and remove them from the JSON
          const cleaned = v.map((entry: any, idx: number) => {
            if (!entry || typeof entry !== "object") return entry;
            const out: Record<string, any> = {};
            for (const [ek, ev] of Object.entries(entry)) {
              if (uploadKeys.has(ek) && isUploadValue(ev)) {
                // fire-and-forget within the loop; sequenced via for..of below
                // We push a task list instead so ordering is deterministic.
                (persistUpload as any)._pending = (persistUpload as any)._pending || [];
                for (const uploadEntry of ev as any[]) {
                  (persistUpload as any)._pending.push([ek, idx, uploadEntry]);
                }
              } else {
                out[ek] = ev;
              }
            }
            return out;
          });
          paramInserts.push({
            order_measurement_id: createdMeasurement.id,
            parameter_name: key,
            parameter_value: JSON.stringify(cleaned),
            unit: null,
          });
          continue;
        }

        if (typeof v === "string" && v.trim() === "") continue;

        const f = fields.find((x: any) => x.field_key === key);
        paramInserts.push({
          order_measurement_id: createdMeasurement.id,
          parameter_name: (f as any)?.display_name || key,
          parameter_value:
            typeof v === "boolean" ? (v ? "true" : "false")
              : (Array.isArray(v) || (v && typeof v === "object")) ? JSON.stringify(v)
              : String(v),
          unit: (f as any)?.unit || null,
        });
      }

      // Drain queued repeatable uploads
      const pending: Array<[string, number, any]> = (persistUpload as any)._pending || [];
      for (const [fk, idx, entry] of pending) await persistUpload(fk, idx, entry);
      (persistUpload as any)._pending = [];

      // Werte der verknüpften Formulare je Aufgabe persistieren
      if (linkedFormValues.length > 0) {
        const formIds = [...new Set(linkedFormValues.map((x) => x.formId))];
        for (const fid of formIds) {
          const ff = await api.formFields.listForForm(fid);
          for (const item of linkedFormValues.filter((x) => x.formId === fid)) {
            const def = (ff as any[]).find((x) => x.field_key === item.fieldKey);
            const raw = item.value;
            if (typeof raw === "string" && raw.trim() === "") continue;
            paramInserts.push({
              order_measurement_id: createdMeasurement.id,
              parameter_name: def?.display_name || item.fieldKey,
              parameter_value:
                typeof raw === "boolean" ? (raw ? "true" : "false")
                  : typeof raw === "object" ? JSON.stringify(raw)
                  : String(raw),
              unit: def?.unit || null,
            });

            // Zusätzlich als normaler Formularwert derselben Messung
            // ablegen (`form:<Formular>:<Feldschlüssel>`), damit die
            // Messdienstleisteransicht und der bestehende Formel-Scope
            // exakt dasselbe Feld lesen. Kein neues Feld, keine zweite
            // Feldinstanz – nur derselbe Wert unter dem vorhandenen
            // Feldschlüssel. Die Auftragsparameter oben bleiben unberührt.
            const payload = buildFormValueResultPayload({
              measurementId: createdMeasurement.id,
              formId: fid,
              fieldKey: item.fieldKey,
              raw,
              def,
              measuredBy: user!.id,
            });
            if (!payload) continue;
            try {
              await api.measurementResults.create(payload as any);
            } catch (err: any) {
              // Der Auftrag bleibt gültig; nur die Vorbelegung fehlt dann.
              console.warn("Formularwert konnte nicht übernommen werden", err);
            }
          }
        }
      }

      if (paramInserts.length > 0) {
        await api.measurementParameters.bulkInsert(paramInserts);
      }
    }
  }
}

/** Abgleiche nach dem Anlegen (idempotent, erzeugen keine Duplikate; Fehler werden nur protokolliert). */
export async function runPostCreateSyncs(orderId: string): Promise<void> {
  // Sicherheitsnetz: ausgelöste Dienstleistungen gegen den gespeicherten
  // Stand abgleichen (idempotent, erzeugt keine Duplikate).
  try { await api.ruleTriggers.syncOrder(orderId); }
  catch (err) { console.warn("Regel-Auslöser konnten nicht abgeglichen werden", err); }
  // Regel „Mundstück 293/1“ (Raumgewicht / Wasseraufnahme / Schwindung).
  try { await api.mundstueck293.syncOrder(orderId); }
  catch (err) { console.warn("Mundstück 293/1 konnte nicht abgeglichen werden", err); }
}

/** Alle Eingabefelder der Maske als ein Stand (Quelle: Entwurf; später auch: bestehender Auftrag). */
export interface FormState {
  selectedProjectId: string;
  orderType: string;
  orderKind: "labor" | "pilot_plant";
  priority: string;
  dueDate: string;
  notes: string;
  measurements: SelectedMeasurement[];
  selectedSampleIds: string[];
  processTemplateId: string;
  measurementParams: Record<string, Record<string, string>>;
  measurementFormValues: Record<string, Record<string, any>>;
  dynamicValues: Record<string, any>;
  dynamicFormId: string | null;
  /** Zuletzt aktiver Reiter der Dienstleistungs-Karten. */
  serviceTab: { active: string | null; order: string[] };
}

/** Maskenstand aus einem (bereits normalisierten) Entwurf-Stand ableiten – ohne Seiteneffekte. */
export function payloadToFormState(p: OrderDraftPayload): FormState {
  return {
    selectedProjectId: p.selectedProjectId ?? "",
    orderType: p.orderType ?? "",
    orderKind: p.orderKind === "pilot_plant" ? "pilot_plant" : "labor",
    priority: p.priority ?? "normal",
    dueDate: p.dueDate ?? "",
    notes: p.notes ?? "",
    measurements: (p.measurements ?? []) as SelectedMeasurement[],
    selectedSampleIds: p.selectedSampleIds ?? [],
    processTemplateId: p.processTemplateId ?? "__none__",
    measurementParams: (p.measurementParams ?? {}) as Record<string, Record<string, string>>,
    measurementFormValues: (p.measurementFormValues ?? {}) as Record<string, Record<string, any>>,
    dynamicValues: (p.dynamicValues ?? {}) as Record<string, any>,
    dynamicFormId: p.dynamicFormId ?? null,
    serviceTab: {
      active: p.activeMeasurementUid ?? null,
      order: (p.serviceTabOrder ?? []) as string[],
    },
  };
}
