import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FormDefinition } from "@/lib/api/formDefinitions";
import type { FormField } from "@/lib/api/formFields";
import { normalizeLayout, type FormLayoutTree } from "@/lib/api/formDefinitionLayout";
import { DEFAULT_ROLE_KEY } from "@/lib/api/formRoleViews";
import FormLayoutRenderer from "./FormLayoutRenderer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const STANDARD = "__standard__";

/**
 * Live-Vorschau eines Globalen Formulars in einem großen Dialog.
 *
 * Nutzt bewusst dieselbe Rendering-Engine (FormLayoutRenderer) und dieselben
 * Rollenansichten/Feldberechtigungen wie das spätere echte Formular – es gibt
 * kein zweites Vorschau-Layoutsystem.
 */
export default function FormPreviewDialog({
  open,
  onOpenChange,
  form,
  /** Aktueller (auch ungespeicherter) Bearbeitungsstand aus dem Designer. */
  currentLayout,
  /** Rollenschlüssel, den der Designer gerade bearbeitet (Standard = undefined). */
  currentRoleKey,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: FormDefinition;
  currentLayout: FormLayoutTree;
  currentRoleKey?: string | null;
}) {
  const editingKey = currentRoleKey || STANDARD;
  const [viewKey, setViewKey] = useState<string>(editingKey);
  const [fullscreen, setFullscreen] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});

  const { data: fields = [] } = useQuery({
    queryKey: ["form-fields", form.id],
    queryFn: () => api.formFields.listForForm(form.id),
  });
  const typedFields = fields as FormField[];

  const { data: roleViews = [] } = useQuery({
    queryKey: ["form-role-views", form.id],
    queryFn: () => api.formRoleViews.list(form.id),
  });

  const savedView = roleViews.find((v) => v.role_key === viewKey) ?? null;
  const isEditingView = viewKey === editingKey;

  // Bearbeitete Ansicht: ungespeicherter Stand. Andere Ansicht: gespeichertes Layout.
  const layout = useMemo<FormLayoutTree>(() => {
    if (isEditingView) return currentLayout;
    if (viewKey === STANDARD) return normalizeLayout((form as any).layout);
    const roleLayout = normalizeLayout(savedView?.layout);
    return roleLayout.nodes.length ? roleLayout : normalizeLayout((form as any).layout);
  }, [isEditingView, currentLayout, viewKey, savedView, form]);

  const permRoleKey = viewKey === STANDARD ? DEFAULT_ROLE_KEY : viewKey;
  const { data: permissions } = useQuery({
    queryKey: ["form-field-permissions", form.id, permRoleKey, typedFields.length],
    queryFn: () =>
      api.formFieldPermissions.getEffectiveMap(form.id, permRoleKey, typedFields.map((f) => f.id)),
    enabled: open && typedFields.length > 0,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-[95vw] p-0 gap-0 overflow-hidden",
          fullscreen ? "w-screen h-screen max-h-screen rounded-none" : "w-[95vw] h-[90vh]"
        )}
      >
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-base flex items-center gap-2">
              Live-Vorschau · {form.name}
              {isEditingView && <Badge variant="secondary">Bearbeitungsstand</Badge>}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Ansicht</Label>
              <Select value={viewKey} onValueChange={setViewKey}>
                <SelectTrigger className="h-8 w-56 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={STANDARD}>Standardformular</SelectItem>
                  {roleViews.map((v) => (
                    <SelectItem key={v.role_key} value={v.role_key}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" onClick={() => setValues({})} title="Eingaben zurücksetzen">
                <RotateCcw className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setFullscreen((f) => !f)}>
                {fullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4">
          <div className="mx-auto w-full max-w-6xl">
            <FormLayoutRenderer
              layout={layout}
              fields={typedFields}
              permissions={permissions}
              values={values}
              onChange={(k, v) => setValues((prev) => ({ ...prev, [k]: v }))}
              formId={form.id}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
