import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FormField } from "@/lib/api/formFields";
import { readRepeaterMeta } from "@/lib/api/formFields";
import { readGlobalRepeaterMeta, readGlobalRepeaterSubfields } from "@/lib/api/globalModel";
import type { ReportFieldGroup, ReportFieldItem, ReportSubfield } from "@/lib/reportFieldCatalog";

/**
 * Baut den Feldkatalog eines Berichts dynamisch aus den bereits vorhandenen
 * Strukturen (globale Felder, Formulare, Dienstleistungsformulare,
 * Berechnungen). Es werden keine berichtseigenen Felder erzeugt.
 */
export function useReportFieldCatalog(templateId: string | null | undefined) {
  return useQuery({
    queryKey: ["report-field-catalog", templateId],
    enabled: !!templateId,
    queryFn: async (): Promise<ReportFieldGroup[]> => {
      const tid = templateId as string;

      const [steps, serviceLinks, services, globalObjects, globalFields, calculations, allForms] =
        await Promise.all([
          api.processTemplateSteps.listForTemplate(tid).catch(() => []),
          api.processServiceLinks.listForProcess(tid).catch(() => []),
          api.measurementServices.listAll().catch(() => [] as any[]),
          api.globalObjects.list().catch(() => []),
          api.globalFields.list().catch(() => []),
          api.globalCalculations.list().catch(() => []),
          api.formDefinitions.list().catch(() => []),
        ]);

      const formById = new Map<string, any>((allForms as any[]).map((f) => [f.id, f]));
      const serviceById = new Map<string, any>((services as any[]).map((s) => [s.id, s]));

      // --- welche Formulare gehören zu diesem Prozess? --------------------
      type FormRef = { formId: string; label: string; role: string | null; group: string };
      const formRefs: FormRef[] = [];
      const seen = new Set<string>();

      const pushForm = (formId: string | null | undefined, label: string, role: string | null, group: string) => {
        if (!formId || seen.has(formId)) return;
        seen.add(formId);
        formRefs.push({ formId, label, role, group });
      };

      for (const st of steps as any[]) {
        const role = (st.role_required as string | null) ?? null;
        const formName = formById.get(st.form_id)?.name ?? st.name;
        const isCustomer = role === "auftraggeber";
        pushForm(
          st.form_id,
          formName,
          role,
          isCustomer ? "Auftraggeberformular" : `Messdienstleister – ${st.name}`
        );
      }

      const serviceFormLists = await Promise.all(
        (serviceLinks as any[]).map((l) =>
          api.serviceFormLinks.listForService(l.service_id).catch(() => [])
        )
      );
      (serviceLinks as any[]).forEach((link, i) => {
        const svcName = serviceById.get(link.service_id)?.service_name ?? "Dienstleistung";
        for (const sfl of serviceFormLists[i] as any[]) {
          pushForm(
            sfl.form_definition_id,
            formById.get(sfl.form_definition_id)?.name ?? svcName,
            null,
            `Dienstleistung – ${svcName}`
          );
        }
      });

      // --- Felder der Formulare laden -------------------------------------
      const fieldLists = await Promise.all(
        formRefs.map((f) => api.formFields.listForForm(f.formId).catch(() => [] as FormField[]))
      );

      const groups: ReportFieldGroup[] = [];

      // --- Gruppe: Auftragsdaten (globale Felder) --------------------------
      const orderObjectIds = new Set(
        (globalObjects as any[])
          .filter((o) =>
            ["auftrag", "order", "versuch"].includes(String(o.object_key).toLowerCase()) ||
            String(o.category ?? "").toLowerCase() === "auftrag"
          )
          .map((o) => o.id)
      );
      const objById = new Map<string, any>((globalObjects as any[]).map((o) => [o.id, o]));

      const orderItems: ReportFieldItem[] = [];
      const otherGlobalItems: ReportFieldItem[] = [];
      for (const gf of globalFields as any[]) {
        const obj = objById.get(gf.object_id);
        const prefix = orderObjectIds.has(gf.object_id) ? "order" : "customer_form";
        const item = globalFieldToItem(gf, prefix, obj?.display_name ?? "Globale Felder");
        (orderObjectIds.has(gf.object_id) ? orderItems : otherGlobalItems).push(item);
      }
      if (orderItems.length) groups.push({ key: "order", label: "Auftragsdaten", items: orderItems });
      if (otherGlobalItems.length)
        groups.push({ key: "global", label: "Globale Felder", items: otherGlobalItems });

      // --- Gruppen: Formulare ----------------------------------------------
      const byGroup = new Map<string, ReportFieldItem[]>();
      formRefs.forEach((ref, i) => {
        const prefix = ref.group === "Auftraggeberformular" ? "customer_form" : "employee_form";
        const items = (fieldLists[i] as FormField[]).map((f) => formFieldToItem(f, prefix, ref.label));
        const cur = byGroup.get(ref.group) ?? [];
        byGroup.set(ref.group, [...cur, ...items]);
      });
      for (const [label, items] of byGroup) {
        if (items.length) groups.push({ key: label, label, items });
      }

      // --- Gruppe: Berechnete Werte ----------------------------------------
      const calcItems: ReportFieldItem[] = (calculations as any[]).map((c) => ({
        path: `computed.${c.calc_key}`,
        label: c.display_name,
        kind: "computed" as const,
        dataType: "decimal",
        unit: c.unit ?? null,
        sourceLabel: "Globale Berechnung",
      }));
      // berechnete Formularfelder ergänzen
      formRefs.forEach((ref, i) => {
        const prefix = ref.group === "Auftraggeberformular" ? "customer_form" : "employee_form";
        for (const f of fieldLists[i] as FormField[]) {
          if (f.field_type === "computed") {
            calcItems.push({
              path: `${prefix}.${f.field_key}`,
              label: `${f.display_name} (${ref.label})`,
              kind: "computed",
              dataType: "decimal",
              unit: f.unit,
              sourceLabel: ref.label,
            });
          }
        }
      });
      if (calcItems.length) groups.push({ key: "computed", label: "Berechnete Werte", items: calcItems });

      // --- Gruppe: Standard-Auftragsstammdaten -----------------------------
      groups.push({
        key: "context",
        label: "Auftrag & Kontext (Stammdaten)",
        items: STATIC_CONTEXT_ITEMS,
      });

      return groups;
    },
  });
}

function globalFieldToItem(gf: any, prefix: string, sourceLabel: string): ReportFieldItem {
  if (gf.data_type === "repeater") {
    const meta = readGlobalRepeaterMeta(gf);
    const subs = readGlobalRepeaterSubfields(gf);
    return {
      path: `${prefix}.${meta.storage_key || gf.field_key}`,
      label: gf.display_name,
      kind: "repeater",
      dataType: "repeater",
      unit: gf.unit,
      sourceLabel,
      subfields: subs.map<ReportSubfield>((s) => ({
        key: s.field_key,
        label: s.display_name,
        unit: s.unit,
      })),
    };
  }
  return {
    path: `${prefix}.${gf.field_key}`,
    label: gf.display_name,
    kind: gf.data_type === "computed" ? "computed" : "value",
    dataType: gf.data_type,
    unit: gf.unit,
    sourceLabel,
  };
}

function formFieldToItem(f: FormField, prefix: string, sourceLabel: string): ReportFieldItem {
  if (f.field_type === "repeater") {
    const meta = readRepeaterMeta(f);
    const subs = collectRepeaterSubfields(f);
    return {
      path: `${prefix}.${meta.storage_key || f.field_key}`,
      label: f.display_name,
      kind: "repeater",
      dataType: "repeater",
      sourceLabel,
      subfields: subs,
    };
  }
  if (f.field_type === "raw_material_recipe") {
    return {
      path: `${prefix}.${f.field_key}`,
      label: f.display_name,
      kind: "repeater",
      dataType: "repeater",
      sourceLabel,
      subfields: [
        { key: "material", label: "Rohstoff" },
        { key: "quantity", label: "Menge" },
        { key: "unit", label: "Einheit" },
        { key: "lot", label: "LOT" },
      ],
    };
  }
  return {
    path: `${prefix}.${f.field_key}`,
    label: f.display_name,
    kind: f.field_type === "computed" ? "computed" : "value",
    dataType: f.field_type,
    unit: f.unit,
    sourceLabel,
  };
}

function collectRepeaterSubfields(f: FormField): ReportSubfield[] {
  const meta = (f.metadata ?? {}) as any;
  const subs = Array.isArray(meta.subfields) ? meta.subfields : [];
  return subs.map((s: any) => ({
    key: s.field_key ?? s.key,
    label: s.display_name ?? s.label ?? s.field_key,
    unit: s.unit ?? null,
  }));
}

const STATIC_CONTEXT_ITEMS: ReportFieldItem[] = [
  { path: "order.order_number", label: "Auftragsnummer", kind: "value", sourceLabel: "Auftrag" },
  { path: "order.pp_experiment_number", label: "Versuchsnummer", kind: "value", sourceLabel: "Auftrag" },
  { path: "order.status", label: "Status", kind: "value", sourceLabel: "Auftrag" },
  { path: "order.priority", label: "Priorität", kind: "value", sourceLabel: "Auftrag" },
  { path: "order.created_at", label: "Erstellt am", kind: "value", dataType: "datetime", sourceLabel: "Auftrag" },
  { path: "order.due_date", label: "Fälligkeit", kind: "value", dataType: "date", sourceLabel: "Auftrag" },
  { path: "order.created_by_name", label: "Ersteller", kind: "value", sourceLabel: "Auftrag" },
  { path: "order.responsible_name", label: "Bearbeiter", kind: "value", sourceLabel: "Auftrag" },
  { path: "project.project_number", label: "Projektnummer", kind: "value", sourceLabel: "Projekt" },
  { path: "project.project_name", label: "Projekt", kind: "value", sourceLabel: "Projekt" },
  { path: "project.customer", label: "Kunde", kind: "value", sourceLabel: "Projekt" },
  { path: "sample.sample_number", label: "Probennummer", kind: "value", sourceLabel: "Probe" },
  { path: "sample.sample_name", label: "Probe", kind: "value", sourceLabel: "Probe" },
  { path: "measurement_result", label: "Messwerte (Liste)", kind: "repeater", sourceLabel: "Messungen",
    subfields: [
      { key: "measurement", label: "Messung" },
      { key: "result_name", label: "Ergebnis" },
      { key: "value", label: "Wert" },
      { key: "unit", label: "Einheit" },
    ] },
  { path: "measurement_parameter", label: "Messparameter (Liste)", kind: "repeater", sourceLabel: "Messungen",
    subfields: [
      { key: "measurement", label: "Messung" },
      { key: "parameter_name", label: "Parameter" },
      { key: "parameter_value", label: "Wert" },
      { key: "unit", label: "Einheit" },
    ] },
  { path: "service.list", label: "Dienstleistungen (Liste)", kind: "repeater", sourceLabel: "Dienstleistungen",
    subfields: [
      { key: "number", label: "Nummer" },
      { key: "name", label: "Dienstleistung" },
      { key: "status", label: "Status" },
      { key: "hours", label: "Stunden" },
    ] },
  { path: "worklog.entries", label: "Arbeitszeiten (Liste)", kind: "repeater", sourceLabel: "Arbeitszeiten",
    subfields: [
      { key: "date", label: "Datum" },
      { key: "user", label: "Person" },
      { key: "hours", label: "Stunden" },
      { key: "notes", label: "Notiz" },
    ] },
];
