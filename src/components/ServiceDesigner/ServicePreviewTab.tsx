import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormInput, Layers, FileText } from "lucide-react";
import type { ProcessTemplate } from "@/lib/api/processTemplates";

export default function ServicePreviewTab({ template }: { template: ProcessTemplate }) {
  const meta = (template.metadata ?? {}) as Record<string, any>;

  const { data: steps = [] } = useQuery({
    queryKey: ["process-steps", template.id],
    queryFn: () => api.processTemplateSteps.listForTemplate(template.id),
  });

  const { data: customerForm } = useQuery({
    queryKey: ["role-form", meta.customer_form_id],
    queryFn: () => (meta.customer_form_id ? api.formDefinitions.get(meta.customer_form_id) : Promise.resolve(null)),
    enabled: !!meta.customer_form_id,
  });
  const { data: employeeForm } = useQuery({
    queryKey: ["role-form", meta.employee_form_id],
    queryFn: () => (meta.employee_form_id ? api.formDefinitions.get(meta.employee_form_id) : Promise.resolve(null)),
    enabled: !!meta.employee_form_id,
  });

  const { data: customerFields = [] } = useQuery({
    queryKey: ["form-fields", customerForm?.id],
    queryFn: () => (customerForm ? api.formFields.listForForm(customerForm.id) : Promise.resolve([])),
    enabled: !!customerForm,
  });
  const { data: employeeFields = [] } = useQuery({
    queryKey: ["form-fields", employeeForm?.id],
    queryFn: () => (employeeForm ? api.formFields.listForForm(employeeForm.id) : Promise.resolve([])),
    enabled: !!employeeForm,
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><FormInput className="h-4 w-4" /> Auftraggeberformular</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!customerForm ? (
            <p className="text-sm text-muted-foreground">Kein Formular verknüpft.</p>
          ) : customerFields.length === 0 ? (
            <p className="text-sm text-muted-foreground">Formular „{customerForm.name}" enthält noch keine Felder.</p>
          ) : (
            customerFields.map((f: any) => (
              <div key={f.id} className="flex items-center gap-2 text-sm border rounded px-2 py-1.5">
                <span className="flex-1">{f.display_name}</span>
                <Badge variant="outline" className="text-xs">{f.field_type}</Badge>
                {f.is_required && <Badge variant="secondary" className="text-xs">Pflicht</Badge>}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><FormInput className="h-4 w-4" /> Messdienstleisterformular</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!employeeForm ? (
            <p className="text-sm text-muted-foreground">Kein Formular verknüpft.</p>
          ) : employeeFields.length === 0 ? (
            <p className="text-sm text-muted-foreground">Formular „{employeeForm.name}" enthält noch keine Felder.</p>
          ) : (
            employeeFields.map((f: any) => (
              <div key={f.id} className="flex items-center gap-2 text-sm border rounded px-2 py-1.5">
                <span className="flex-1">{f.display_name}</span>
                <Badge variant="outline" className="text-xs">{f.field_type}</Badge>
                {f.is_required && <Badge variant="secondary" className="text-xs">Pflicht</Badge>}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" /> Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          {steps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Prozessschritte definiert.</p>
          ) : (
            <ol className="space-y-1 text-sm">
              {steps.map((s: any, i: number) => (
                <li key={s.id} className="flex items-center gap-2 border rounded px-2 py-1.5">
                  <span className="w-6 text-muted-foreground">{i + 1}.</span>
                  <span className="flex-1">{s.name}</span>
                  {s.role_required && <Badge variant="outline" className="text-xs">{s.role_required}</Badge>}
                  {s.is_mandatory && <Badge variant="secondary" className="text-xs">Pflicht</Badge>}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 border-dashed">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" /> Berichtsvorschau (in Vorbereitung)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Wird verfügbar, sobald die Berichtsvorlage konfiguriert ist.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
