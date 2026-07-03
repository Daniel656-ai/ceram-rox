import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRawMaterials } from "@/hooks/useRawMaterials";
import {
  useProjectKnetungMaterials, useAddProjectKnetungMaterial, useDeleteProjectKnetungMaterial,
} from "@/hooks/useProjectMaterials";
import { useProjectExpenses } from "@/hooks/useProjectExpenses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Package, Gem } from "lucide-react";
import { toast } from "sonner";
import { formatQuantity } from "@/lib/formatQuantity";
import { formatCurrency } from "@/lib/formatCurrency";
import { ProjectExpenses } from "@/components/ProjectExpenses";

interface Props {
  projectId: string;
  defaultLeaderId?: string | null;
  knetungMeasurements?: Array<{ id: string; measurement_number: string }>;
}

export function ProjectMaterialCosts({ projectId, defaultLeaderId, knetungMeasurements = [] }: Props) {
  const { t } = useTranslation("materials");
  const { data: rawMaterials = [] } = useRawMaterials();
  const { data: projectKnetung = [] } = useProjectKnetungMaterials(projectId);
  const { data: projectExpenses = [] } = useProjectExpenses(projectId);
  const addKnetung = useAddProjectKnetungMaterial();
  const deleteKnetung = useDeleteProjectKnetungMaterial();

  const [knDialog, setKnDialog] = useState(false);
  const [knForm, setKnForm] = useState({ raw_material_id: "", quantity_kg: "", order_measurement_id: "", comment: "" });

  const selectedRawMaterial = rawMaterials.find((r: any) => r.id === knForm.raw_material_id);

  const totalExpenses = useMemo(() =>
    (projectExpenses as any[]).reduce((s, e) => s + Number(e.total_price || 0), 0), [projectExpenses]);
  const totalKnetung = useMemo(() =>
    (projectKnetung as any[]).reduce((s, k) => s + Number(k.total_cost || 0), 0), [projectKnetung]);


  const handleAddConsumable = async () => {
    if (!conForm.consumable_id || !Number(conForm.quantity)) return;
    await addConsumable.mutateAsync({
      project_id: projectId,
      consumable_id: conForm.consumable_id,
      quantity: Number(conForm.quantity),
      unit_price: selectedConsumable?.price_per_unit || 0,
      comment: conForm.comment || undefined,
    });
    toast.success(t("booking_created"));
    setConDialog(false);
    setConForm({ consumable_id: "", quantity: "", comment: "" });
  };

  const handleAddKnetung = async () => {
    if (!knForm.raw_material_id || !Number(knForm.quantity_kg)) return;
    await addKnetung.mutateAsync({
      project_id: projectId,
      raw_material_id: knForm.raw_material_id,
      quantity_kg: Number(knForm.quantity_kg),
      price_per_kg: (selectedRawMaterial as any)?.price_per_kg || 0,
      order_measurement_id: knForm.order_measurement_id || undefined,
      comment: knForm.comment || undefined,
    });
    toast.success(t("booking_created"));
    setKnDialog(false);
    setKnForm({ raw_material_id: "", quantity_kg: "", order_measurement_id: "", comment: "" });
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{formatCurrency(totalConsumables)} {t("currency")}</p>
              <p className="text-xs text-muted-foreground">{t("total_consumables")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Gem className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{formatCurrency(totalKnetung)} {t("currency")}</p>
              <p className="text-xs text-muted-foreground">{t("total_knetung")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">Σ</div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(totalConsumables + totalKnetung)} {t("currency")}</p>
              <p className="text-xs text-muted-foreground">{t("total_material_costs")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Consumables Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">{t("consumables_section")}</CardTitle>
          <Dialog open={conDialog} onOpenChange={setConDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />{t("add_consumable_booking")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("add_consumable_booking")}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t("select_consumable")}</Label>
                  <Select value={conForm.consumable_id} onValueChange={v => setConForm(f => ({ ...f, consumable_id: v }))}>
                    <SelectTrigger><SelectValue placeholder={t("select_consumable")} /></SelectTrigger>
                    <SelectContent>
                      {consumables.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name} ({c.price_per_unit} €/{c.unit})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("quantity")}{selectedConsumable ? ` (${selectedConsumable.unit})` : ""}</Label>
                  <Input type="number" step="0.001" min="0" value={conForm.quantity} onChange={e => setConForm(f => ({ ...f, quantity: e.target.value }))} />
                  {selectedConsumable && conForm.quantity && (
                    <p className="text-sm text-muted-foreground mt-1">
                      = {formatCurrency(Number(conForm.quantity) * Number(selectedConsumable.price_per_unit))} €
                    </p>
                  )}
                </div>
                <div>
                  <Label>{t("comment")}</Label>
                  <Input value={conForm.comment} onChange={e => setConForm(f => ({ ...f, comment: e.target.value }))} />
                </div>
                <Button className="w-full" onClick={handleAddConsumable}>{t("add_consumable_booking")}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead className="text-right">{t("quantity")}</TableHead>
                <TableHead className="text-right">{t("price")}</TableHead>
                <TableHead className="text-right">{t("total")}</TableHead>
                <TableHead>{t("comment")}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(projectConsumables as any[]).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">{t("no_consumable_bookings")}</TableCell></TableRow>
              ) : (
                (projectConsumables as any[]).map((pc: any) => (
                  <TableRow key={pc.id}>
                    <TableCell className="font-medium">{pc.consumables?.name || "–"}</TableCell>
                    <TableCell className="text-right">{formatQuantity(pc.quantity)} {pc.consumables?.unit || ""}</TableCell>
                    <TableCell className="text-right">{formatCurrency(pc.unit_price)} €</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(pc.total_cost)} €</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">{pc.comment || "–"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { deleteConsumable.mutateAsync({ id: pc.id, project_id: projectId }); toast.success(t("booking_deleted")); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {(projectConsumables as any[]).length > 0 && (
            <div className="border-t p-4 flex justify-end">
              <span className="font-semibold">{t("total_consumables")}: {formatCurrency(totalConsumables)} €</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Knetung Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">{t("knetung_section")}</CardTitle>
          <Dialog open={knDialog} onOpenChange={setKnDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />{t("add_knetung_booking")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("add_knetung_booking")}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t("select_raw_material")}</Label>
                  <Select value={knForm.raw_material_id} onValueChange={v => setKnForm(f => ({ ...f, raw_material_id: v }))}>
                    <SelectTrigger><SelectValue placeholder={t("select_raw_material")} /></SelectTrigger>
                    <SelectContent>
                      {rawMaterials.map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>{r.material_name} ({(r as any).price_per_kg || 0} €/kg)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {knetungMeasurements.length > 0 && (
                  <div>
                    <Label>{t("select_measurement")}</Label>
                    <Select value={knForm.order_measurement_id} onValueChange={v => setKnForm(f => ({ ...f, order_measurement_id: v }))}>
                      <SelectTrigger><SelectValue placeholder={t("select_measurement")} /></SelectTrigger>
                      <SelectContent>
                        {knetungMeasurements.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.measurement_number}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>{t("quantity_kg")}</Label>
                  <Input type="number" step="0.001" min="0" value={knForm.quantity_kg} onChange={e => setKnForm(f => ({ ...f, quantity_kg: e.target.value }))} />
                  {selectedRawMaterial && knForm.quantity_kg && (
                    <p className="text-sm text-muted-foreground mt-1">
                      = {formatCurrency(Number(knForm.quantity_kg) * Number((selectedRawMaterial as any).price_per_kg || 0))} €
                    </p>
                  )}
                </div>
                <div>
                  <Label>{t("comment")}</Label>
                  <Input value={knForm.comment} onChange={e => setKnForm(f => ({ ...f, comment: e.target.value }))} />
                </div>
                <Button className="w-full" onClick={handleAddKnetung}>{t("add_knetung_booking")}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead className="text-right">{t("quantity_kg")}</TableHead>
                <TableHead className="text-right">{t("price_per_kg")}</TableHead>
                <TableHead className="text-right">{t("total")}</TableHead>
                <TableHead>{t("comment")}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(projectKnetung as any[]).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">{t("no_knetung_bookings")}</TableCell></TableRow>
              ) : (
                (projectKnetung as any[]).map((pk: any) => (
                  <TableRow key={pk.id}>
                    <TableCell className="font-medium">{pk.raw_materials?.material_name || "–"}</TableCell>
                    <TableCell className="text-right">{formatQuantity(pk.quantity_kg)} kg</TableCell>
                    <TableCell className="text-right">{formatCurrency(pk.price_per_kg)} €</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(pk.total_cost)} €</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">{pk.comment || "–"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { deleteKnetung.mutateAsync({ id: pk.id, project_id: projectId }); toast.success(t("booking_deleted")); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {(projectKnetung as any[]).length > 0 && (
            <div className="border-t p-4 flex justify-end">
              <span className="font-semibold">{t("total_knetung")}: {formatCurrency(totalKnetung)} €</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
