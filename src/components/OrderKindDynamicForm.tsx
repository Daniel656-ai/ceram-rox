import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import type { OrderKind } from "@/lib/api/orderKindFormTemplates";
import type { FormField } from "@/lib/api/formFields";
import { topLevelFields } from "@/lib/api/formFields";
import { normalizeLayout, type FormLayoutTree, type LayoutNode } from "@/lib/api/formDefinitionLayout";
import FormLayoutRenderer from "@/components/ServiceDesigner/FormLayoutRenderer";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  orderKind: OrderKind;
  values: Record<string, any>;
  onChange: (patch: Record<string, any>) => void;
  /** Called with the resolved form_definition_id once (or null if none). Optional. */
  onTemplateResolved?: (formId: string | null) => void;
}

/**
 * Renders the Auftraggeberformular that is configured for the given order kind
 * in the Prozess-/Formulardesigner.
 *
 * There is exactly ONE rendering engine (FormLayoutRenderer) — the same one the
 * designer preview, the process runtime and the opened order use. Nothing about
 * the fields, sections or labels is hardcoded here.
 *
 * If no template is mapped for this order kind, the component renders nothing.
 */
export default function OrderKindDynamicForm({ orderKind, values, onChange, onTemplateResolved }: Props) {
  const { role } = useAuth();

  const { data: mapping, isLoading: mapLoading } = useQuery({
    queryKey: ["order-kind-form-template", orderKind],
    queryFn: () => api.orderKindFormTemplates.get(orderKind),
  });

  const formId = mapping?.form_definition_id ?? null;

  useEffect(() => {
    onTemplateResolved?.(formId);
  }, [formId, onTemplateResolved]);

  const { data: form } = useQuery({
    queryKey: ["form-definition", formId],
    queryFn: () => (formId ? api.formDefinitions.get(formId) : Promise.resolve(null)),
    enabled: !!formId,
  });

  const { data: fields = [], isLoading: fieldsLoading } = useQuery({
    queryKey: ["form-fields", formId],
    queryFn: () => (formId ? api.formFields.listForForm(formId) : Promise.resolve([])),
    enabled: !!formId,
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
      api.formFieldPermissions.getEffectiveMap(
        formId!,
        role ?? "",
        typedFields.map((f) => f.id)
      ),
    enabled: !!formId && !!role && typedFields.length > 0,
  });

  if (mapLoading) return null;
  if (!formId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {form?.name || "Auftragsformular"}
          <Badge variant="outline" className="text-[10px]">Template</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {fieldsLoading ? (
          <p className="text-sm text-muted-foreground">Lade Formular…</p>
        ) : (
          <FormLayoutRenderer
            layout={layout}
            fields={typedFields}
            permissions={permissions}
            values={values}
            onChange={(key, v) => onChange({ [key]: v })}
          />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Fallback layout for templates that have fields but no explicit layout tree
 * yet: one section per category, in the field order defined in the designer.
 */
export function autoLayout(fields: FormField[]): FormLayoutTree {
  const top = topLevelFields(fields);
  const groups = new Map<string, FormField[]>();
  top.forEach((f) => {
    const cat = f.category?.trim() || "Allgemein";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(f);
  });

  const nodes: LayoutNode[] = [...groups.entries()].map(([title, catFields]) => ({
    id: `auto-section-${title}`,
    type: "section",
    title,
    children: catFields.map((f) => ({
      id: `auto-field-${f.id}`,
      type: "field",
      field_id: f.id,
      width: f.field_type === "longtext" || f.field_type === "repeater" || f.field_type === "multiselect" ? 12 : 6,
    })),
  })) as LayoutNode[];

  return { version: 1, nodes };
}

/**
 * Utility: derive a "Laufzettel"-style text summary from dynamic form values.
 * Kept generic so any template can produce a rendered summary without code changes.
 */
export function buildLaufzettelText(values: Record<string, any>, fields: FormField[]): string {
  const lines: string[] = [];
  const top = topLevelFields(fields);

  top.forEach((f) => {
    const v = values[f.field_key];
    if (v == null || v === "") return;
    if (Array.isArray(v)) {
      const rendered = v
        .map((entry) =>
          entry && typeof entry === "object"
            ? Object.values(entry).filter(Boolean).join(" ")
            : String(entry)
        )
        .filter(Boolean);
      if (!rendered.length) return;
      lines.push(`${f.display_name}:`);
      rendered.forEach((r) => lines.push(`• ${r}`));
      lines.push("");
      return;
    }
    lines.push(`${f.display_name}: ${v}`);
  });

  return lines.join("\n").trim();
}
