import { useState } from "react";
import {
  useServiceParameterDefs,
  useCreateParameterDef,
  useUpdateParameterDef,
  useDeleteParameterDef,
  type ServiceParameterDefinition,
} from "@/hooks/useServiceParameters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Beaker, FlaskConical, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface Props {
  serviceId: string;
  serviceName: string;
}

const TYPE_LABELS: Record<string, string> = {
  number: "Zahl",
  text: "Text",
  select: "Auswahl",
  boolean: "Ja/Nein",
};

const CATEGORY_LABELS: Record<string, string> = {
  input: "Einstellparameter",
  output: "Ergebnisparameter",
};

const CATEGORY_ICONS: Record<string, typeof Beaker> = {
  input: Beaker,
  output: FlaskConical,
};

export default function ServiceParameterEditor({ serviceId, serviceName }: Props) {
  const { data: defs = [], isLoading } = useServiceParameterDefs(serviceId);
  const createDef = useCreateParameterDef();
  const updateDef = useUpdateParameterDef();
  const deleteDef = useDeleteParameterDef();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceParameterDefinition | null>(null);
  const [form, setForm] = useState({
    parameter_name: "",
    unit: "",
    default_value: "",
    parameter_type: "text" as string,
    is_required: false,
    parameter_category: "input" as string,
    select_options_text: "",
    conditional_on: "" as string,
    conditional_value: "",
    description: "",
    min_value: "",
    max_value: "",
  });

  const inputDefs = defs.filter((d) => d.parameter_category === "input");
  const outputDefs = defs.filter((d) => d.parameter_category === "output");

  const openDialog = (def?: ServiceParameterDefinition) => {
    if (def) {
      setEditing(def);
      setForm({
        parameter_name: def.parameter_name,
        unit: def.unit || "",
        default_value: def.default_value || "",
        parameter_type: def.parameter_type,
        is_required: def.is_required,
        parameter_category: def.parameter_category,
        select_options_text: (def.select_options || []).join(", "),
        conditional_on: def.conditional_on || "",
        conditional_value: def.conditional_value || "",
        description: def.description || "",
        min_value: def.min_value != null ? String(def.min_value) : "",
        max_value: def.max_value != null ? String(def.max_value) : "",
      });
    } else {
      setEditing(null);
      setForm({
        parameter_name: "",
        unit: "",
        default_value: "",
        parameter_type: "text",
        is_required: false,
        parameter_category: "input",
        select_options_text: "",
        conditional_on: "",
        conditional_value: "",
        description: "",
        min_value: "",
        max_value: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.parameter_name.trim()) {
      toast.error("Parametername ist erforderlich");
      return;
    }
    const selectOptions = form.parameter_type === "select"
      ? form.select_options_text.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const payload = {
      service_id: serviceId,
      parameter_name: form.parameter_name.trim(),
      unit: form.unit || null,
      default_value: form.default_value || null,
      parameter_type: form.parameter_type,
      is_required: form.is_required,
      parameter_category: form.parameter_category,
      select_options: selectOptions,
      conditional_on: form.conditional_on || null,
      conditional_value: form.conditional_value || null,
      sort_order: editing ? undefined : defs.length,
      description: form.description || null,
      min_value: form.min_value ? parseFloat(form.min_value) : null,
      max_value: form.max_value ? parseFloat(form.max_value) : null,
    };

    try {
      if (editing) {
        const { service_id, sort_order, ...updates } = payload;
        await updateDef.mutateAsync({ id: editing.id, ...updates });
        toast.success("Parameter aktualisiert");
      } else {
        await createDef.mutateAsync(payload as any);
        toast.success("Parameter erstellt");
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDef.mutateAsync(id);
      toast.success("Parameter gelöscht");
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    }
  };

  const renderTable = (category: string, items: ServiceParameterDefinition[]) => {
    const Icon = CATEGORY_ICONS[category];
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">{CATEGORY_LABELS[category]}</h4>
          <Badge variant="secondary" className="text-xs">{items.length}</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Einheit</TableHead>
              <TableHead>Pflicht</TableHead>
              <TableHead>Bereich</TableHead>
              <TableHead>Standard</TableHead>
              <TableHead>Bedingung</TableHead>
              <TableHead className="w-20">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((d, i) => {
              const condParam = d.conditional_on ? defs.find((x) => x.id === d.conditional_on) : null;
              return (
                <TableRow key={d.id}>
                  <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium text-sm">{d.parameter_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{TYPE_LABELS[d.parameter_type]}</Badge>
                    {d.parameter_type === "select" && d.select_options?.length > 0 && (
                      <span className="text-xs text-muted-foreground ml-1">({d.select_options.join(", ")})</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{d.unit || "–"}</TableCell>
                  <TableCell>{d.is_required ? <Badge className="text-xs">Pflicht</Badge> : <span className="text-xs text-muted-foreground">Optional</span>}</TableCell>
                  <TableCell className="text-sm">{d.default_value || "–"}</TableCell>
                  <TableCell className="text-xs">
                    {condParam ? (
                      <span>Wenn „{condParam.parameter_name}" = „{d.conditional_value}"</span>
                    ) : "–"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openDialog(d)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => handleDelete(d.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-4">
                  Keine {CATEGORY_LABELS[category]} definiert
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (isLoading) return <div className="flex justify-center py-4"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  // Potential parents for conditional logic (only input booleans/selects)
  const conditionalParents = defs.filter(
    (d) => d.parameter_category === "input" && (d.parameter_type === "boolean" || d.parameter_type === "select")
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Parameterdefinition – {serviceName}</h3>
        <Button size="sm" onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-1" /> Parameter hinzufügen
        </Button>
      </div>

      {renderTable("input", inputDefs)}
      {renderTable("output", outputDefs)}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Parameter bearbeiten" : "Neuer Parameter"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Parametername *</Label>
                <Input value={form.parameter_name} onChange={(e) => setForm((f) => ({ ...f, parameter_name: e.target.value }))} placeholder="z. B. Starttemperatur" />
              </div>
              <div>
                <Label>Kategorie</Label>
                <Select value={form.parameter_category} onValueChange={(v) => setForm((f) => ({ ...f, parameter_category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="input">Einstellparameter</SelectItem>
                    <SelectItem value="output">Ergebnisparameter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Datentyp</Label>
                <Select value={form.parameter_type} onValueChange={(v) => setForm((f) => ({ ...f, parameter_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Zahl</SelectItem>
                    <SelectItem value="select">Auswahl</SelectItem>
                    <SelectItem value="boolean">Ja/Nein</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Einheit</Label>
                <Input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="z. B. °C, K/min, %" />
              </div>
            </div>

            {form.parameter_type === "select" && (
              <div>
                <Label>Auswahloptionen (kommagetrennt)</Label>
                <Input value={form.select_options_text} onChange={(e) => setForm((f) => ({ ...f, select_options_text: e.target.value }))} placeholder="z. B. Luft, Argon, Stickstoff" />
              </div>
            )}

            <div>
              <Label>Standardwert</Label>
              <Input value={form.default_value} onChange={(e) => setForm((f) => ({ ...f, default_value: e.target.value }))} placeholder="Optional" />
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={form.is_required} onCheckedChange={(v) => setForm((f) => ({ ...f, is_required: v }))} />
              <Label>Pflichtfeld</Label>
            </div>

            {conditionalParents.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Bedingt durch</Label>
                  <Select value={form.conditional_on || "none"} onValueChange={(v) => setForm((f) => ({ ...f, conditional_on: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Keine Bedingung" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Keine Bedingung</SelectItem>
                      {conditionalParents
                        .filter((p) => p.id !== editing?.id)
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.parameter_name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.conditional_on && (
                  <div>
                    <Label>Wenn Wert =</Label>
                    {(() => {
                      const parent = conditionalParents.find((p) => p.id === form.conditional_on);
                      if (parent?.parameter_type === "boolean") {
                        return (
                          <Select value={form.conditional_value || "true"} onValueChange={(v) => setForm((f) => ({ ...f, conditional_value: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">Ja</SelectItem>
                              <SelectItem value="false">Nein</SelectItem>
                            </SelectContent>
                          </Select>
                        );
                      }
                      if (parent?.parameter_type === "select" && parent.select_options?.length > 0) {
                        return (
                          <Select value={form.conditional_value} onValueChange={(v) => setForm((f) => ({ ...f, conditional_value: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {parent.select_options.map((o) => (
                                <SelectItem key={o} value={o}>{o}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      }
                      return <Input value={form.conditional_value} onChange={(e) => setForm((f) => ({ ...f, conditional_value: e.target.value }))} />;
                    })()}
                  </div>
                )}
              </div>
            )}

            <Button onClick={handleSave} className="w-full">
              {editing ? "Aktualisieren" : "Erstellen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
