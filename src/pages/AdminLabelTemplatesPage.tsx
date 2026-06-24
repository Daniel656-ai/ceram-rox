import { useMemo, useState } from "react";
import { useLabelTemplates, useCreateLabelTemplate, useUpdateLabelTemplate, useDeleteLabelTemplate, useDuplicateLabelTemplate } from "@/hooks/useLabelTemplates";
import { LabelDesigner } from "@/components/labels/LabelDesigner";
import type { LabelLayout, LabelTemplate } from "@/lib/api/labelTemplates";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Copy, Trash2, Save, Star, X } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LABEL_CATEGORIES, LABEL_FIELDS } from "@/lib/labels/fields";
import { LabelRenderer } from "@/components/labels/LabelRenderer";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanySettings } from "@/hooks/useCompanySettings";

const SAMPLE = LABEL_FIELDS.reduce<Record<string, string>>((acc, f) => { acc[f.key] = f.sample; return acc; }, {});

function emptyLayout(): LabelLayout {
  return { elements: [] };
}

export default function AdminLabelTemplatesPage() {
  const { data: templates = [], isLoading } = useLabelTemplates();
  const { data: company } = useCompanySettings();
  const { user } = useAuth();
  const create = useCreateLabelTemplate();
  const update = useUpdateLabelTemplate();
  const del = useDeleteLabelTemplate();
  const dup = useDuplicateLabelTemplate();

  const [editing, setEditing] = useState<{ id?: string; name: string; category: string; width_mm: number; height_mm: number; layout: LabelLayout; is_default?: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LabelTemplate | null>(null);

  const sampleData = useMemo(() => ({
    material: { material_name: SAMPLE["material.name"], other_designation: SAMPLE["material.other_designation"], description: SAMPLE["material.description"], material_number: SAMPLE["material.material_number"], mrs_number: SAMPLE["material.mrs_number"], supplier: SAMPLE["material.supplier"], cas_number: SAMPLE["material.cas_number"], unit: "kg" },
    container: { container_code: SAMPLE["container.container_code"], kind: SAMPLE["container.kind"], initial_quantity: 25, current_quantity: 18.4, unit: "kg", created_at: new Date().toISOString() },
    batch: { lot_number: SAMPLE["batch.lot_number"], expiry_date: "2027-12-31", delivery_date: "2026-06-15" },
    location: { hall: "Halle 1", room: "R-12", shelf: "F-3" },
    company: { name: company?.company_name ?? "Beispiel GmbH", address: "Musterstraße 1, 1010 Wien", logo_data_url: company?.logo_data_url },
    hazardGhsKeys: ["GHS02", "GHS07"],
    psaKeys: ["goggles", "gloves"],
  }), [company]);

  const startNew = () => setEditing({ name: "Neue Vorlage", category: "rohstoff", width_mm: 100, height_mm: 50, layout: emptyLayout(), is_default: false });
  const startEdit = (t: LabelTemplate) => setEditing({ id: t.id, name: t.name, category: t.category, width_mm: t.width_mm, height_mm: t.height_mm, layout: t.layout, is_default: t.is_default });

  async function save() {
    if (!editing) return;
    try {
      if (editing.id) {
        await update.mutateAsync({ id: editing.id, patch: editing });
        toast.success("Vorlage gespeichert");
      } else {
        await create.mutateAsync({ ...editing, created_by: user?.id ?? null });
        toast.success("Vorlage erstellt");
      }
      setEditing(null);
    } catch (e: any) {
      toast.error("Fehler", { description: e.message });
    }
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Etiketten-Designer</h1>
            <p className="text-muted-foreground text-sm">Layout per Drag &amp; Drop gestalten.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}><X className="h-4 w-4 mr-1" />Verwerfen</Button>
            <Button onClick={save} disabled={create.isPending || update.isPending}><Save className="h-4 w-4 mr-1" />Speichern</Button>
          </div>
        </div>
        <LabelDesigner value={editing} sampleData={sampleData} onChange={(patch) => setEditing((p) => ({ ...(p as any), ...patch }))} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Etiketten-Vorlagen</h1>
          <p className="text-muted-foreground">Verwalten Sie Layouts für Rohstoff-Gebinde, Gefahrstoffe, Produktion u.&nbsp;v.&nbsp;m.</p>
        </div>
        <Button onClick={startNew}><Plus className="h-4 w-4 mr-1" />Neue Vorlage</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lädt…</p>
      ) : templates.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Noch keine Vorlagen. Erstellen Sie Ihre erste Vorlage.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Card key={t.id} className="overflow-hidden">
              <div className="bg-muted/30 p-3 flex items-center justify-center min-h-[140px]">
                <div style={{ transform: "scale(0.7)", transformOrigin: "center" }}>
                  <LabelRenderer template={t} data={sampleData} placeholder />
                </div>
              </div>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{t.name}</h3>
                  {t.is_default && <Badge variant="secondary"><Star className="h-3 w-3 mr-1" />Standard</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{LABEL_CATEGORIES.find((c) => c.key === t.category)?.label ?? t.category} · {t.width_mm}×{t.height_mm} mm · {t.layout?.elements?.length ?? 0} Elemente</p>
                <div className="flex gap-1 pt-1">
                  <Button size="sm" variant="outline" onClick={() => startEdit(t)}>Bearbeiten</Button>
                  <Button size="sm" variant="ghost" onClick={() => dup.mutate(t.id, { onSuccess: () => toast.success("Dupliziert") })}><Copy className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(t)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vorlage löschen?</AlertDialogTitle>
            <AlertDialogDescription>„{deleteTarget?.name}“ wird endgültig gelöscht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => { if (deleteTarget) { await del.mutateAsync(deleteTarget.id); toast.success("Gelöscht"); setDeleteTarget(null); } }}
            >Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
