import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useTemplates, useCreateTemplate, useDeleteTemplate, useUpdateTemplate } from "@/hooks/useTemplates";
import { useAllServices } from "@/hooks/useMeasurements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Copy, FlaskConical } from "lucide-react";

export default function TemplatesPage() {
  const { t } = useTranslation(["common", "orders"]);
  const { user } = useAuth();
  const { data: templates = [], isLoading } = useTemplates();
  const { data: allServices = [] } = useAllServices();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  const resetForm = () => {
    setName("");
    setCategory("");
    setDescription("");
    setSelectedServiceIds([]);
    setEditId(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (tpl: any) => {
    setEditId(tpl.id);
    setName(tpl.name);
    setCategory(tpl.category || "");
    setDescription(tpl.description || "");
    setSelectedServiceIds(
      (tpl.measurement_template_items || []).map((i: any) => i.service_id)
    );
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || selectedServiceIds.length === 0) {
      toast.error("Name und mindestens eine Messung erforderlich");
      return;
    }
    const items = selectedServiceIds.map((sid, idx) => ({ service_id: sid, sort_order: idx }));
    try {
      if (editId) {
        await updateTemplate.mutateAsync({ id: editId, name, category: category || undefined, description: description || undefined, items });
        toast.success("Template aktualisiert");
      } else {
        await createTemplate.mutateAsync({ name, category: category || undefined, description: description || undefined, created_by: user!.id, items });
        toast.success("Template erstellt");
      }
      setDialogOpen(false);
      resetForm();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Template wirklich löschen?")) return;
    try {
      await deleteTemplate.mutateAsync(id);
      toast.success("Template gelöscht");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleService = (sid: string) => {
    setSelectedServiceIds(prev =>
      prev.includes(sid) ? prev.filter(s => s !== sid) : [...prev, sid]
    );
  };

  // Group services by category
  const servicesByCategory = (allServices as any[]).reduce((acc: Record<string, any[]>, s: any) => {
    const cat = s.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mess-Templates</h1>
          <p className="text-muted-foreground">Vordefinierte Messungssets für schnelle Auftragserstellung</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Neues Template
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Laden…</p>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Noch keine Templates vorhanden. Erstelle dein erstes Template!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(templates as any[]).map((tpl) => (
            <Card key={tpl.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{tpl.name}</CardTitle>
                    {tpl.category && <Badge variant="secondary" className="mt-1">{tpl.category}</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(tpl)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(tpl.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {tpl.description && <p className="text-sm text-muted-foreground mb-2">{tpl.description}</p>}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {(tpl.measurement_template_items || []).length} Messung(en):
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(tpl.measurement_template_items || []).map((item: any) => (
                      <Badge key={item.id} variant="outline" className="text-xs">
                        {item.measurement_services?.service_name || "–"}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Template bearbeiten" : "Neues Template erstellen"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Trinkwasser Standardanalyse" />
              </div>
              <div className="space-y-2">
                <Label>Kategorie</Label>
                <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="z.B. Wasseranalytik" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optionale Beschreibung" rows={2} />
            </div>

            <div className="space-y-2">
              <Label>Messungen auswählen *</Label>
              <p className="text-xs text-muted-foreground">{selectedServiceIds.length} ausgewählt</p>
              <div className="border rounded-md max-h-60 overflow-y-auto">
                {Object.entries(servicesByCategory).map(([cat, services]) => (
                  <div key={cat}>
                    <div className="px-3 py-1.5 bg-muted text-xs font-medium text-muted-foreground sticky top-0">
                      {cat === "labor" ? "Labor" : cat === "pilot_plant" ? "Technikum" : cat}
                    </div>
                    {(services as any[]).map((s: any) => (
                      <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                        <Checkbox
                          checked={selectedServiceIds.includes(s.id)}
                          onCheckedChange={() => toggleService(s.id)}
                        />
                        <span className="text-sm flex-1">{s.service_name}</span>
                        <span className="text-xs text-muted-foreground">{s.standard_duration_hours}h</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={createTemplate.isPending || updateTemplate.isPending}>
              {editId ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
