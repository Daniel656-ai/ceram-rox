import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ServiceForm } from "@/lib/api/workflowDesigner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Archive, FileText } from "lucide-react";

const FORM_TYPES = [
  { value: "requester", label: "Auftraggeberformular" },
  { value: "provider", label: "Messdienstleisterformular" },
  { value: "pilot_plant", label: "Pilot Plant Formular" },
  { value: "quality", label: "Qualitätskontrolle" },
  { value: "report", label: "Ergebnisbericht" },
  { value: "generic", label: "Generisch" },
];

interface Props {
  serviceId: string;
  canManage: boolean;
}

export default function FormsLibrary({ serviceId, canManage }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<ServiceForm> | null>(null);

  const { data: forms = [], isLoading } = useQuery({
    queryKey: ["service-forms", serviceId],
    queryFn: () => api.serviceForms.list(serviceId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["service-forms", serviceId] });

  const save = useMutation({
    mutationFn: async (f: Partial<ServiceForm>) => {
      if (f.id) return api.serviceForms.update(f.id, f);
      return api.serviceForms.create({
        ...f,
        service_id: f.is_global ? null : serviceId,
        name: f.name!,
        form_type: f.form_type || "generic",
      } as any);
    },
    onSuccess: () => { invalidate(); setEditing(null); toast.success("Formular gespeichert"); },
    onError: (e: any) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: (id: string) => api.serviceForms.archive(id),
    onSuccess: () => { invalidate(); toast.success("Formular archiviert"); },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Formular-Bibliothek</CardTitle>
            <CardDescription>Wiederverwendbare Formulare für diese Dienstleistung. Formulare sind entkoppelt vom Prozess und werden im Workflow-Schritt eingebunden.</CardDescription>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setEditing({ form_type: "generic", is_global: false })}>
              <Plus className="h-4 w-4 mr-1" /> Neues Formular
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Lädt…</p>
          ) : forms.length === 0 ? (
            <p className="text-muted-foreground text-sm">Noch keine Formulare vorhanden.</p>
          ) : (
            <div className="space-y-2">
              {forms.map((f) => (
                <div key={f.id} className="flex items-center gap-3 border rounded-md p-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{f.name}</span>
                      <Badge variant="secondary">{FORM_TYPES.find((t) => t.value === f.form_type)?.label ?? f.form_type}</Badge>
                      {f.is_global && <Badge variant="outline">Global</Badge>}
                      <Badge variant="outline">v{f.version}</Badge>
                    </div>
                    {f.description && <p className="text-xs text-muted-foreground mt-1">{f.description}</p>}
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(f)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Formular "${f.name}" archivieren?`)) archive.mutate(f.id); }}><Archive className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Formular bearbeiten" : "Neues Formular"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Beschreibung</Label><Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div>
                <Label>Typ</Label>
                <Select value={editing.form_type ?? "generic"} onValueChange={(v) => setEditing({ ...editing, form_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FORM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_global ?? false} onCheckedChange={(v) => setEditing({ ...editing, is_global: v })} />
                <Label>Global (für alle Dienstleistungen verfügbar)</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Die Feld-Konfiguration erfolgt im bestehenden Tab „Formular" (Feld-Definitionen werden in einer der nächsten Phasen an die neue Formular-Entität gebunden).
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Abbrechen</Button>
            <Button onClick={() => editing && save.mutate(editing)} disabled={!editing?.name}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
