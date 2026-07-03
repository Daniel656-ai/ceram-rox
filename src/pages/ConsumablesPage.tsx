import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useConsumables, useAddConsumable, useUpdateConsumable, useDeleteConsumable } from "@/hooks/useConsumables";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, Package } from "lucide-react";
import { toast } from "sonner";

export default function ConsumablesPage() {
  const { t } = useTranslation("materials");
  const { data: consumables = [], isLoading } = useConsumables();
  const addConsumable = useAddConsumable();
  const updateConsumable = useUpdateConsumable();
  const deleteConsumable = useDeleteConsumable();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "", price_per_unit: "", unit: "Stück" });

  const filtered = consumables.filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditItem(null);
    setForm({ name: "", description: "", price_per_unit: "", unit: "Stück" });
    setDialogOpen(true);
  };

  const openEdit = (c: any) => {
    setEditItem(c);
    setForm({ name: c.name, description: c.description || "", price_per_unit: String(c.price_per_unit), unit: c.unit });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error(t("name_required")); return; }
    const payload = { name: form.name.trim(), description: form.description.trim() || undefined, price_per_unit: Number(form.price_per_unit) || 0, unit: form.unit.trim() || "Stück" };
    if (editItem) {
      await updateConsumable.mutateAsync({ id: editItem.id, ...payload });
      toast.success(t("consumable_updated"));
    } else {
      await addConsumable.mutateAsync(payload);
      toast.success(t("consumable_created"));
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteConsumable.mutateAsync(id);
    toast.success(t("consumable_deleted"));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("consumables_title")}</h1>
          <p className="text-muted-foreground">{t("consumables_subtitle")}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />{t("new_consumable")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editItem ? t("edit_consumable") : t("new_consumable")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("name")} *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>{t("description")}</Label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("price_per_unit")} (€)</Label>
                  <Input type="number" step="0.01" min="0" value={form.price_per_unit} onChange={e => setForm(f => ({ ...f, price_per_unit: e.target.value }))} />
                </div>
                <div>
                  <Label>{t("unit")}</Label>
                  <Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
                </div>
              </div>
              <Button className="w-full" onClick={handleSave}>{editItem ? t("edit_consumable") : t("new_consumable")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder={t("search_placeholder")} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("description")}</TableHead>
                <TableHead className="text-right">{t("price_per_unit")}</TableHead>
                <TableHead>{t("unit")}</TableHead>
                <TableHead className="w-24">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    {t("no_consumables")}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">{c.description || "–"}</TableCell>
                    <TableCell className="text-right font-bold">{Number(c.price_per_unit).toFixed(2)} €</TableCell>
                    <TableCell>{c.unit}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("delete_consumable")}</AlertDialogTitle>
                              <AlertDialogDescription>{t("delete_consumable_desc")}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(c.id)}>Löschen</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
