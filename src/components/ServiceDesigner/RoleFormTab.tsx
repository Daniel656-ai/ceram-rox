import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FormInput } from "lucide-react";
import { toast } from "sonner";
import type { ProcessTemplate } from "@/lib/api/processTemplates";

interface Props {
  template: ProcessTemplate;
  metaKey: "customer_form_id" | "employee_form_id";
  title: string;
  description: string;
  defaultFormName: string;
  /** Optional renderer for the field editor block. */
  renderFieldsEditor: (form: any) => React.ReactNode;
}

/**
 * Rollen-spezifischer Formular-Tab (Auftraggeber / Messdienstleister).
 * Speichert die Verknüpfung zum Formular in `process_templates.metadata[metaKey]`,
 * ohne Schema-Änderung. Nutzt bestehende Form-Designer-Komponenten.
 */
export default function RoleFormTab({ template, metaKey, title, description, defaultFormName, renderFieldsEditor }: Props) {
  const qc = useQueryClient();
  const meta = (template.metadata ?? {}) as Record<string, any>;
  const formId: string | null = meta[metaKey] ?? null;

  const { data: form } = useQuery({
    queryKey: ["role-form", formId],
    queryFn: () => (formId ? api.formDefinitions.get(formId) : Promise.resolve(null)),
    enabled: !!formId,
  });

  const { data: allForms = [] } = useQuery({
    queryKey: ["form-definitions", "all"],
    queryFn: () => api.formDefinitions.list(),
  });

  const invalidateTemplate = () => qc.invalidateQueries({ queryKey: ["process-template", template.id] });

  const linkMut = useMutation({
    mutationFn: async (newId: string | null) => {
      const nextMeta = { ...(template.metadata ?? {}), [metaKey]: newId };
      await api.processTemplates.update(template.id, { metadata: nextMeta } as any);
    },
    onSuccess: () => { invalidateTemplate(); toast.success("Verknüpfung gespeichert"); },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const f = await api.formDefinitions.create({ name: defaultFormName, scope: "global" } as any);
      const nextMeta = { ...(template.metadata ?? {}), [metaKey]: f.id };
      await api.processTemplates.update(template.id, { metadata: nextMeta } as any);
      return f;
    },
    onSuccess: () => {
      invalidateTemplate();
      qc.invalidateQueries({ queryKey: ["form-definitions", "all"] });
      toast.success("Formular angelegt");
    },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const linkable = allForms.filter((f: any) => f.id !== formId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <FormInput className="h-4 w-4" /> {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded border bg-muted/30 p-3">
          <Select value={formId ?? ""} onValueChange={(v) => v && linkMut.mutate(v)}>
            <SelectTrigger className="w-80">
              <SelectValue placeholder="Vorhandenes Formular verknüpfen…" />
            </SelectTrigger>
            <SelectContent>
              {linkable.length === 0 && (
                <div className="px-2 py-1 text-xs text-muted-foreground">Keine Formulare vorhanden.</div>
              )}
              {linkable.map((gf: any) => (
                <SelectItem key={gf.id} value={gf.id}>
                  {gf.name} · v{gf.version}
                  {gf.scope === "global" ? " · global" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">oder</span>
          <Button size="sm" variant="outline" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Neues Formular
          </Button>
          {formId && (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => {
              if (confirm("Verknüpfung aufheben? Das Formular selbst bleibt in der Bibliothek erhalten.")) linkMut.mutate(null);
            }}>Verknüpfung aufheben</Button>
          )}
        </div>

        {formId && form ? (
          <div>
            <div className="text-xs text-muted-foreground mb-2">
              Verknüpftes Formular: <span className="font-medium">{form.name}</span>
              {form.scope === "global" && <Badge variant="outline" className="ml-2 text-xs">Global</Badge>}
            </div>
            {renderFieldsEditor(form)}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground border border-dashed rounded p-6 text-center">
            Noch kein Formular verknüpft.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
