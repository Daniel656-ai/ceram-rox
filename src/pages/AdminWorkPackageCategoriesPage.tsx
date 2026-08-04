import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCanManagePortfolio } from "@/hooks/useCanManagePortfolio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { toast } from "sonner";

export default function AdminWorkPackageCategoriesPage() {
  const qc = useQueryClient();
  const canManage = useCanManagePortfolio();
  const { data: cats = [], isLoading } = useQuery({
    queryKey: ["wp-categories"],
    queryFn: () => api.workPackageCategories.list(),
  });

  const [dialog, setDialog] = useState<{ open: boolean; id?: string; draft: any }>({
    open: false,
    draft: { name: "", description: "" },
  });

  const save = useMutation({
    mutationFn: async () => {
      const d = dialog.draft;
      if (dialog.id) return api.workPackageCategories.update(dialog.id, { name: d.name.trim(), description: d.description?.trim() || null });
      return api.workPackageCategories.create({ name: d.name.trim(), description: d.description?.trim() || null });
    },
    onSuccess: () => {
      toast.success("Gespeichert");
      setDialog({ open: false, draft: {} });
      qc.invalidateQueries({ queryKey: ["wp-categories"] });
    },
    onError: (e: any) => toast.error(e?.message || "Fehler"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.workPackageCategories.remove(id),
    onSuccess: () => { toast.success("Gelöscht"); qc.invalidateQueries({ queryKey: ["wp-categories"] }); },
    onError: (e: any) => toast.error(e?.message || "Kategorie wird noch verwendet."),
  });

  if (!canManage) {
    return (
      <div className="p-6">
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">Keine Berechtigung. Diese Seite ist nur für Administratoren und PMO verfügbar.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Tags className="h-7 w-7 text-primary mt-1" />
          <div>
            <h1 className="text-2xl font-bold">Arbeitspaket-Kategorien</h1>
            <p className="text-sm text-muted-foreground">
              Zentrale Kategorien, die Projekt-Arbeitspakete mit Portfolio-Arbeitspaketen verbinden.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setDialog({ open: true, draft: { name: "", description: "" } })}>
          <Plus className="h-4 w-4 mr-2" /> Neue Kategorie
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Kategorien</CardTitle></CardHeader>
        <CardContent>
          <DataTable<any>
            tableId="admin.wp-categories"
            isLoading={isLoading}
            rows={cats}
            rowKey={(c) => c.id}
            emptyMessage="Keine Kategorien vorhanden."
            searchPlaceholder="Name, Beschreibung …"
            columns={[
              { key: "name", header: "Name", type: "text", className: "font-medium" },
              {
                key: "description",
                header: "Beschreibung",
                type: "text",
                className: "text-sm text-muted-foreground",
                cell: (c) => c.description ?? "—",
              },
              {
                key: "is_system",
                header: "Typ",
                type: "boolean",
                headClassName: "w-24",
                cell: (c) =>
                  c.is_system ? <Badge variant="secondary">System</Badge> : <Badge variant="outline">Custom</Badge>,
              },
              {
                key: "actions",
                header: "Aktionen",
                type: "custom",
                sortable: false,
                filterable: false,
                searchable: false,
                headClassName: "w-32 text-right",
                className: "text-right",
                cell: (c) => (
                  <>
                    <Button size="icon" variant="ghost" onClick={() => setDialog({ open: true, id: c.id, draft: { name: c.name, description: c.description ?? "" } })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" disabled={c.is_system} onClick={() => {
                      if (confirm(`Kategorie „${c.name}" löschen?`)) remove.mutate(c.id);
                    }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>


      <Dialog open={dialog.open} onOpenChange={(o) => setDialog((s) => ({ ...s, open: o }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialog.id ? "Kategorie bearbeiten" : "Neue Kategorie"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input value={dialog.draft.name ?? ""} onChange={(e) => setDialog((s) => ({ ...s, draft: { ...s.draft, name: e.target.value } }))} />
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea rows={3} value={dialog.draft.description ?? ""} onChange={(e) => setDialog((s) => ({ ...s, draft: { ...s.draft, description: e.target.value } }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog((s) => ({ ...s, open: false }))}>Abbrechen</Button>
            <Button onClick={() => save.mutate()} disabled={!dialog.draft.name?.trim() || save.isPending}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
