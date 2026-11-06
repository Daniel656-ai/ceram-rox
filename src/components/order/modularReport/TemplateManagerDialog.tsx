import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Download, Check, X, RefreshCw } from "lucide-react";
import type { ReportLayout } from "@/lib/modularReport/config";
import { deleteTemplate, renameTemplate, saveTemplate, type PersonalReportTemplate } from "@/lib/modularReport/templates";

export function TemplateManagerDialog({ open, onOpenChange, userId, templates, setTemplates, currentLayout, onApply }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string | null;
  templates: PersonalReportTemplate[];
  setTemplates: (t: PersonalReportTemplate[]) => void;
  currentLayout: ReportLayout;
  onApply: (layout: ReportLayout) => void;
}) {
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  if (!userId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Persönliche Berichtsvorlagen</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Gespeichert werden nur Modulstruktur, Reihenfolge, Sichtbarkeit, Überschriften und Standardtexte (DE/EN) –
          keine Auftrags-, Proben- oder Messdaten. Vorlagen liegen nur auf diesem Gerät.
        </p>
        <div className="flex gap-2">
          <Input placeholder="Name der neuen Vorlage" value={name} onChange={(e) => setName(e.target.value)} />
          <Button disabled={!name.trim()} onClick={() => { setTemplates(saveTemplate(userId, name, currentLayout)); setName(""); toast.success("Vorlage gespeichert"); }}>
            Speichern
          </Button>
        </div>
        <div className="space-y-2 max-h-80 overflow-auto">
          {templates.length === 0 && <p className="text-sm text-muted-foreground">Noch keine persönlichen Vorlagen.</p>}
          {templates.map((tpl) => (
            <div key={tpl.id} className="flex items-center gap-2 rounded-md border p-2">
              {editId === tpl.id ? (
                <>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" />
                  <Button size="icon" variant="ghost" title="Übernehmen" onClick={() => { setTemplates(renameTemplate(userId, tpl.id, editName)); setEditId(null); }}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="Abbrechen" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{tpl.name}</div>
                    <div className="text-xs text-muted-foreground">{new Date(tpl.updatedAt).toLocaleString("de-AT")}</div>
                  </div>
                  <Button size="icon" variant="ghost" title="Laden" onClick={() => { onApply(tpl.layout); onOpenChange(false); }}><Download className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="Mit aktueller Konfiguration überschreiben" onClick={() => { setTemplates(saveTemplate(userId, tpl.name, currentLayout, tpl.id)); toast.success("Vorlage aktualisiert"); }}><RefreshCw className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="Umbenennen" onClick={() => { setEditId(tpl.id); setEditName(tpl.name); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="Löschen" onClick={() => setTemplates(deleteTemplate(userId, tpl.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
