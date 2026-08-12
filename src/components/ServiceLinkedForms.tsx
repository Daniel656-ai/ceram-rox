import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { FormField } from "@/lib/api/formFields";
import { normalizeLayout, type FormLayoutTree } from "@/lib/api/formDefinitionLayout";
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
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
}

/**
 * Renders exactly one configured form definition using the single rendering
 * engine (FormLayoutRenderer) — identical to the order-kind template flow.
 */
function LinkedForm({ formId, values, onChange }: SingleProps) {
  const { role } = useAuth();

  const { data: form } = useQuery({
    queryKey: ["form-definition", formId],
    queryFn: () => api.formDefinitions.get(formId),
  });

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ["form-fields", formId],
    queryFn: () => api.formFields.listForForm(formId),
  });

  const typedFields = fields as FormField[];

  const layout = useMemo<FormLayoutTree>(() => {
    const normalized = normalizeLayout(form?.layout);
    if (normalized.nodes.length) return normalized;
    return autoLayout(typedFields);
  }, [form?.layout, typedFields]);

  const { data: permissions } = useQuery({
    queryKey: ["form-field-permissions", formId, role, typedFields.length],
    queryFn: () =>
      api.formFieldPermissions.getEffectiveMap(formId, role ?? "", typedFields.map((f) => f.id)),
    enabled: !!role && typedFields.length > 0,
  });

  // Values are stored namespaced per form; strip the prefix for the renderer.
  const localValues = useMemo(() => {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(values)) {
      const parsed = parseLinkedFormValueKey(k);
      if (parsed && parsed.formId === formId) out[parsed.fieldKey] = v;
    }
    return out;
  }, [values, formId]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Lade Formular…</p>;
  if (typedFields.length === 0) return null;

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{form?.name || "Formular"}</p>
      <FormLayoutRenderer
        layout={layout}
        fields={typedFields}
        permissions={permissions}
        values={localValues}
        onChange={(key, v) => onChange(linkedFormValueKey(formId, key), v)}
      />
    </div>
  );
}

interface Props {
  serviceId: string;
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
}

/**
 * Loads all form definitions that are linked to the given Dienstleistung in the
 * Service-Designer (`service_form_links`) and renders them below the task.
 *
 * Fully data-driven — no service-specific logic. Any service that gets a form
 * linked in its configuration automatically shows that form here.
 */
export default function ServiceLinkedForms({ serviceId, values, onChange }: Props) {
  const { data: links = [] } = useQuery({
    queryKey: ["service-form-links", serviceId],
    queryFn: () => api.serviceFormLinks.listForService(serviceId),
    enabled: !!serviceId,
  });

  if (links.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {links.map((l) => (
        <LinkedForm key={l.id} formId={l.form_definition_id} values={values} onChange={onChange} />
      ))}
    </div>
  );
}
