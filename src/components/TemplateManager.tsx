import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTemplates, useCreateTemplate, useDeleteTemplate } from "@/hooks/useTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Layers, Save, Trash2, ChevronDown } from "lucide-react";

interface TemplateManagerProps {
  /** Currently selected service IDs in the order form */
  selectedServiceIds: string[];
  /** Callback to apply a template's services */
  onApplyTemplate: (serviceIds: string[]) => void;
}

export default function TemplateManager({ selectedServiceIds, onApplyTemplate }: TemplateManagerProps) {
  const { user } = useAuth();
  const { data: templates = [] } = useTemplates();
  const createTemplate = useCreateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim() || selectedServiceIds.length === 0) {
      toast.error("Name und mindestens eine Messung erforderlich");
      return;
    }
    try {
      await createTemplate.mutateAsync({
        name: templateName,
        created_by: user!.id,
        items: selectedServiceIds.map((sid, idx) => ({ service_id: sid, sort_order: idx })),
      });
      toast.success("Template gespeichert");
      setSaveDialogOpen(false);
      setTemplateName("");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteTemplate.mutateAsync(id);
      toast.success("Template gelöscht");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleApply = (tpl: any) => {
    const serviceIds = (tpl.measurement_template_items || [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((item: any) => item.service_id);
    onApplyTemplate(serviceIds);
    toast.success(`Template "${tpl.name}" angewendet`);
  };

  return (
    <>
      <div className="flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Layers className="h-4 w-4 mr-2" />
              Meine Templates
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {(templates as any[]).length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Noch keine Templates gespeichert
              </div>
            ) : (
              (templates as any[]).map((tpl) => (
                <DropdownMenuItem key={tpl.id} className="flex items-center justify-between cursor-pointer" onSelect={() => handleApply(tpl)}>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">{tpl.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(tpl.measurement_template_items || []).length} Messung(en)
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive shrink-0 ml-2"
                    onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </DropdownMenuItem>
              ))
            )}
            {selectedServiceIds.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setSaveDialogOpen(true)}>
                  <Save className="h-4 w-4 mr-2" />
                  Aktuelle Auswahl als Template speichern
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Template speichern</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Template-Name *</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="z.B. Standard-Wasseranalyse"
                autoFocus
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {selectedServiceIds.length} Messung(en) werden gespeichert
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSaveAsTemplate} disabled={createTemplate.isPending}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
