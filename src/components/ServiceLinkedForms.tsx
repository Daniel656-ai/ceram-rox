import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api";
import type { FormField } from "@/lib/api/formFields";
import type { EffectivePermission } from "@/lib/api/formFieldPermissions";
import { normalizeLayout, type FormLayoutTree } from "@/lib/api/formDefinitionLayout";
import type { FormViewContext } from "@/lib/api/formRoleViews";
import FormLayoutRenderer from "@/components/ServiceDesigner/FormLayoutRenderer";
import { autoLayout } from "@/components/OrderKindDynamicForm";

/**
 * Prefix used to namespace the values of a linked form definition inside the
 * per-task value bag. Keeps values of different forms (and of the classic
 * Service-Designer fields) strictly separated per task.
 */
export const linkedFormValueKey = (formId: string, fieldKey: string) => `form:${formId}:${fieldKey}`;

export const parseLinkedFormValueKey = (key: string): { formId: string; fieldKey: string } | null => {
  if (!key.startsWith("form:")) return null;
  const rest = key.slice("form:".length);
  const idx = rest.indexOf(":");
  if (idx <= 0) return null;
  return { formId: rest.slice(0, idx), fieldKey: rest.slice(idx + 1) };
};

interface SingleProps {
  formId: string;
  context: FormViewContext;
  /** Alte rollenbezogene Verknüpfung (Migrationsfallback). */
  legacyRole?: "customer" | "employee" | null;
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  /** Ergebnisansicht bzw. abgeschlossene Aufgaben: alles schreibgeschützt. */
  readOnly?: boolean;
}

/**
 * Rendert genau ein Globales Formular in der Ansicht des übergebenen Kontexts
 * (Auftraggeber / Messdienstleister / Ergebnis). Layout und Feldberechtigungen
 * stammen aus den Rollenansichten des Formulars – nicht aus separaten
 * Rollenformularen.
 */
function LinkedForm({ formId, context, legacyRole, values, onChange, readOnly }: SingleProps) {
  const { data: form } = useQuery({
    queryKey: ["form-definition", formId],
    queryFn: () => api.formDefinitions.get(formId),
  });

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ["form-fields", formId],
    queryFn: () => api.formFields.listForForm(formId),
  });

  const typedFields = fields as FormField[];

  // Welche Rollenansicht gilt für diesen Kontext?
  const { data: viewKey, isLoading: viewLoading } = useQuery({
    queryKey: ["form-view-key", formId, context],
    queryFn: () => api.formRoleViews.resolveViewKey(formId, context),
  });

  const { data: viewLayout } = useQuery({
    queryKey: ["form-role-view-layout", formId, viewKey],
    queryFn: () => api.formRoleViews.get(formId, viewKey!),
    enabled: !!viewKey,
  });

  const layout = useMemo<FormLayoutTree>(() => {
    const roleLayout = normalizeLayout(viewLayout?.layout);
    if (roleLayout.nodes.length) return roleLayout;
    const base = normalizeLayout(form?.layout);
    if (base.nodes.length) return base;
    return autoLayout(typedFields);
  }, [viewLayout?.layout, form?.layout, typedFields]);

  const { data: permissions } = useQuery({
    queryKey: ["form-field-permissions", formId, viewKey, typedFields.length],
    queryFn: () =>
      api.formFieldPermissions.getEffectiveMap(formId, viewKey!, typedFields.map((f) => f.id)),
    enabled: !!viewKey && typedFields.length > 0,
  });

  const effectivePermissions = useMemo<Map<string, EffectivePermission> | undefined>(() => {
    if (!readOnly) return permissions;
    const out = new Map<string, EffectivePermission>();
    for (const f of typedFields) {
      const p = permissions?.get(f.id);
      out.set(f.id, {
        ...(p ?? { visibility: "write", required: false }),
        visibility: p?.visibility === "hidden" ? "hidden" : "read",
        locked: true,
      });
    }
    return out;
  }, [permissions, readOnly, typedFields]);

  // Values are stored namespaced per form; strip the prefix for the renderer.
  const localValues = useMemo(() => {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(values)) {
      const parsed = parseLinkedFormValueKey(k);
      if (parsed && parsed.formId === formId) out[parsed.fieldKey] = v;
    }
    return out;
  }, [values, formId]);

  if (isLoading || viewLoading) return <p className="text-sm text-muted-foreground">Lade Formular…</p>;
  if (typedFields.length === 0) return null;
  // Keine Ansicht für diesen Kontext konfiguriert: nur noch Altverknüpfungen
  // (Formular war früher direkt einer Rolle zugeordnet) werden angezeigt.
  if (!viewKey && !(legacyRole && legacyRole === context)) return null;

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        {form?.name || "Formular"}
        {viewLayout?.label ? ` · Ansicht: ${viewLayout.label}` : ""}
      </p>
      <FormLayoutRenderer
        layout={layout}
        fields={typedFields}
        permissions={effectivePermissions}
        values={localValues}
        onChange={(key, v) => onChange(linkedFormValueKey(formId, key), v)}
        formId={formId}
      />
    </div>
  );
}

interface Props {
  serviceId: string;
  /** Kontext, dessen Rollenansicht angezeigt wird. */
  context: FormViewContext;
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  readOnly?: boolean;
}

/**
 * Lädt das mit der Dienstleistung verknüpfte Globale Formular
 * (`service_form_links`) und rendert es in der Ansicht des jeweiligen
 * Kontexts. Die Dienstleistung verknüpft nur noch EIN Formular – die
 * Rollentrennung erfolgt über dessen Rollenansichten.
 */
export default function ServiceLinkedForms({ serviceId, context, values, onChange, readOnly }: Props) {
  const { data: links = [] } = useQuery({
    queryKey: ["service-form-links", serviceId],
    queryFn: () => api.serviceFormLinks.listForService(serviceId),
    enabled: !!serviceId,
  });

  if (links.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {links.map((l) => (
        <LinkedForm
          key={l.id}
          formId={l.form_definition_id}
          context={context}
          legacyRole={(l.role_view as "customer" | "employee" | null) ?? null}
          values={values}
          onChange={onChange}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}
