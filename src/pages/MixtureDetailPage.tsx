import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus, Trash2, Play, FlaskConical } from "lucide-react";
import { api } from "@/lib/api";
import { CreateSampleFromBatchDialog } from "@/components/CreateSampleFromBatchDialog";
import {
  useMixture,
  useUpdateMixture,
  useDeleteMixture,
  useMixtureRecipe,
  useAddRecipeItem,
  useDeleteRecipeItem,
  useMixtureBatches,
  useProduceMixtureBatch,
  useMixtureInventory,
  useRawMaterials,
} from "@/hooks/useMixtures";
import { calculateMixtureStock } from "@/lib/api/mixtures";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function MixtureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation(["mixtures", "common"]);
  const { data: mixture } = useMixture(id);
  const { data: recipe = [] } = useMixtureRecipe(id);
  const { data: batches = [] } = useMixtureBatches(id);
  const { data: movements = [] } = useMixtureInventory(id);
  const { data: rawMaterials = [] } = useRawMaterials();

  const updateMixture = useUpdateMixture();
  const deleteMixture = useDeleteMixture();
  const addRecipeItem = useAddRecipeItem();
  const deleteRecipeItem = useDeleteRecipeItem();
  const produce = useProduceMixtureBatch();

  const stock = useMemo(() => calculateMixtureStock(movements as any), [movements]);

  // Edit master data
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNumber, setEditNumber] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState<"mischung" | "loesung">("mischung");
  const [editUnit, setEditUnit] = useState("kg");
  const [editConc, setEditConc] = useState("");

  const openEdit = () => {
    if (!mixture) return;
    setEditName(mixture.name);
    setEditNumber(mixture.mixture_number || "");
    setEditDescription(mixture.description || "");
    setEditCategory(mixture.category);
    setEditUnit(mixture.unit);
    setEditConc(mixture.target_concentration || "");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!id) return;
    await updateMixture.mutateAsync({
      id,
      name: editName.trim(),
      mixture_number: editNumber.trim() || null,
      description: editDescription.trim() || null,
      category: editCategory,
      unit: editUnit,
      target_concentration: editConc.trim() || null,
    });
    setEditOpen(false);
  };

  // Add recipe item
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [recMaterial, setRecMaterial] = useState("");
  const [recQuantity, setRecQuantity] = useState("");
  const [recUnit, setRecUnit] = useState("kg");
  const [recNotes, setRecNotes] = useState("");

  const handleAddRecipe = async () => {
    if (!id || !recMaterial || !recQuantity) return;
    await addRecipeItem.mutateAsync({
      mixture_id: id,
      raw_material_id: recMaterial,
      quantity: Number(recQuantity),
      unit: recUnit,
      position: recipe.length,
      notes: recNotes.trim() || null,
    });
    setRecMaterial("");
    setRecQuantity("");
    setRecNotes("");
    setRecipeOpen(false);
  };

  // Produce batch
  const [prodOpen, setProdOpen] = useState(false);
  const [prodQuantity, setProdQuantity] = useState("");
  const [prodConc, setProdConc] = useState("");
  const [prodNotes, setProdNotes] = useState("");
  // For each recipe item the user can override batch + quantity
  const [prodLines, setProdLines] = useState<
    Record<string, { quantity: string; raw_material_batch_id: string }>
  >({});

  const openProduce = () => {
    if (!mixture) return;
    setProdQuantity("");
    setProdConc(mixture.target_concentration || "");
    setProdNotes("");
    // scale = 1 by default — quantities equal recipe
    const init: typeof prodLines = {};
    for (const item of recipe as any[]) {
      init[item.id] = { quantity: String(item.quantity), raw_material_batch_id: "" };
    }
    setProdLines(init);
    setProdOpen(true);
  };

  const handleProduce = async () => {
    if (!id || !prodQuantity || (recipe as any[]).length === 0) return;
    const consumptions = (recipe as any[])
      .map((item) => {
        const line = prodLines[item.id];
        if (!line) return null;
        const qty = Number(line.quantity);
        if (!qty || qty <= 0) return null;
        return {
          raw_material_id: item.raw_material_id,
          raw_material_batch_id: line.raw_material_batch_id || null,
          quantity: qty,
          unit: item.unit,
        };
      })
      .filter(Boolean) as any[];

    try {
      await produce.mutateAsync({
        mixture_id: id,
        produced_quantity: Number(prodQuantity),
        unit: mixture!.unit,
        concentration: prodConc.trim() || null,
        notes: prodNotes.trim() || null,
        consumptions,
      });
      toast({ title: t("mixtures:production_success") });
      setProdOpen(false);
    } catch (e: any) {
      toast({
        title: t("mixtures:production_error"),
        description: e.message,
        variant: "destructive",
      });
    }
  };

  if (!mixture) {
    return <div className="p-6 text-muted-foreground">…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/mischungen")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("common:back", "Zurück")}
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{mixture.name}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            {mixture.mixture_number && <span>{mixture.mixture_number}</span>}
            <Badge variant="secondary">{t(`mixtures:category_${mixture.category}`)}</Badge>
            {mixture.target_concentration && (
              <span>· {mixture.target_concentration}</span>
            )}
          </div>
          {mixture.description && (
            <p className="text-sm mt-2 max-w-2xl">{mixture.description}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">{t("mixtures:stock")}</div>
            <div className="text-2xl font-bold">
              {stock.toFixed(2)} {mixture.unit}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={openEdit}>
              {t("mixtures:edit")}
            </Button>
            <Button
              size="sm"
              onClick={openProduce}
              disabled={(recipe as any[]).length === 0}
            >
              <Play className="h-4 w-4 mr-2" />
              {t("mixtures:produce_batch")}
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="recipe">
        <TabsList>
          <TabsTrigger value="recipe">{t("mixtures:recipe")}</TabsTrigger>
          <TabsTrigger value="batches">{t("mixtures:batches")}</TabsTrigger>
          <TabsTrigger value="inventory">{t("mixtures:inventory")}</TabsTrigger>
        </TabsList>

        {/* Recipe */}
        <TabsContent value="recipe">
          <Card className="p-4 space-y-4">
            <div className="flex justify-end">
              <Dialog open={recipeOpen} onOpenChange={setRecipeOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    {t("mixtures:add_recipe_item")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("mixtures:add_recipe_item")}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>{t("mixtures:raw_material")} *</Label>
                      <Select value={recMaterial} onValueChange={setRecMaterial}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("mixtures:select_raw_material")} />
                        </SelectTrigger>
                        <SelectContent>
                          {(rawMaterials as any[]).map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.material_name}
                              {r.material_number ? ` (${r.material_number})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>{t("mixtures:quantity")} *</Label>
                        <Input
                          type="number"
                          step="0.001"
                          value={recQuantity}
                          onChange={(e) => setRecQuantity(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>{t("mixtures:unit")}</Label>
                        <Input value={recUnit} onChange={(e) => setRecUnit(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <Label>{t("mixtures:notes")}</Label>
                      <Textarea
                        value={recNotes}
                        onChange={(e) => setRecNotes(e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRecipeOpen(false)}>
                      {t("mixtures:cancel")}
                    </Button>
                    <Button
                      onClick={handleAddRecipe}
                      disabled={!recMaterial || !recQuantity}
                    >
                      {t("mixtures:save")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {(recipe as any[]).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {t("mixtures:no_recipe_items")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("mixtures:raw_material")}</TableHead>
                    <TableHead>{t("mixtures:quantity")}</TableHead>
                    <TableHead>{t("mixtures:unit")}</TableHead>
                    <TableHead>{t("mixtures:notes")}</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(recipe as any[]).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.raw_materials?.material_name || "—"}
                        {item.raw_materials?.material_number && (
                          <span className="text-muted-foreground ml-1">
                            ({item.raw_materials.material_number})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{Number(item.quantity)}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.notes || "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            deleteRecipeItem.mutate({ id: item.id, mixture_id: id! })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Batches */}
        <TabsContent value="batches">
          <Card>
            {(batches as any[]).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {t("mixtures:no_batches")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("mixtures:batch_number")}</TableHead>
                    <TableHead>{t("mixtures:produced_at")}</TableHead>
                    <TableHead>{t("mixtures:produced_by")}</TableHead>
                    <TableHead>{t("mixtures:produced_quantity")}</TableHead>
                    <TableHead>{t("mixtures:concentration")}</TableHead>
                    <TableHead>{t("mixtures:consumptions")}</TableHead>
                    <TableHead className="w-40">Proben</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(batches as any[]).map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono">{b.batch_number}</TableCell>
                      <TableCell>
                        {format(new Date(b.produced_at), "dd.MM.yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        {b.profiles
                          ? `${b.profiles.first_name} ${b.profiles.last_name}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {Number(b.produced_quantity)} {b.unit}
                      </TableCell>
                      <TableCell>{b.concentration || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {(b.mixture_batch_consumptions || []).map((c: any) => (
                          <div key={c.id}>
                            {c.raw_materials?.material_name}: {Number(c.quantity)} {c.unit}
                            {c.raw_material_batches?.batch_number && (
                              <span className="text-muted-foreground">
                                {" "}
                                · Charge {c.raw_material_batches.batch_number}
                              </span>
                            )}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell>
                        <BatchSamplesCell batchId={b.id} batchNumber={b.batch_number} mixtureName={mixture.name} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Inventory */}
        <TabsContent value="inventory">
          <Card>
            {(movements as any[]).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">—</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("mixtures:movement_type")}</TableHead>
                    <TableHead>{t("mixtures:quantity")}</TableHead>
                    <TableHead>{t("mixtures:batch_number")}</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>{t("mixtures:notes")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(movements as any[]).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Badge variant={m.movement_type === "eingang" ? "default" : "secondary"}>
                          {t(`mixtures:movement_${m.movement_type}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {Number(m.quantity)} {m.unit}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {m.mixture_batches?.batch_number || "—"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(m.movement_date), "dd.MM.yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-sm">{m.comment || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit master data dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("mixtures:edit")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("mixtures:name")} *</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("mixtures:number")}</Label>
                <Input value={editNumber} onChange={(e) => setEditNumber(e.target.value)} />
              </div>
              <div>
                <Label>{t("mixtures:category")}</Label>
                <Select value={editCategory} onValueChange={(v) => setEditCategory(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mischung">{t("mixtures:category_mischung")}</SelectItem>
                    <SelectItem value="loesung">{t("mixtures:category_loesung")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("mixtures:unit")}</Label>
                <Input value={editUnit} onChange={(e) => setEditUnit(e.target.value)} />
              </div>
              <div>
                <Label>{t("mixtures:target_concentration")}</Label>
                <Input value={editConc} onChange={(e) => setEditConc(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>{t("mixtures:description")}</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="justify-between">
            <Button
              variant="destructive"
              onClick={async () => {
                if (!id) return;
                if (!confirm("Wirklich löschen?")) return;
                try {
                  await deleteMixture.mutateAsync(id);
                  navigate("/mischungen");
                } catch (e: any) {
                  toast({
                    title: "Fehler",
                    description: e.message,
                    variant: "destructive",
                  });
                }
              }}
            >
              {t("mixtures:delete")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                {t("mixtures:cancel")}
              </Button>
              <Button onClick={saveEdit}>{t("mixtures:save")}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Produce batch dialog */}
      <Dialog open={prodOpen} onOpenChange={setProdOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("mixtures:produce_batch")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>
                  {t("mixtures:produced_quantity")} ({mixture.unit}) *
                </Label>
                <Input
                  type="number"
                  step="0.001"
                  value={prodQuantity}
                  onChange={(e) => setProdQuantity(e.target.value)}
                />
              </div>
              <div>
                <Label>{t("mixtures:concentration")}</Label>
                <Input value={prodConc} onChange={(e) => setProdConc(e.target.value)} />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">{t("mixtures:consumptions")}</Label>
              <div className="space-y-2 border rounded-md p-3">
                {(recipe as any[]).map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 gap-2 items-center text-sm"
                  >
                    <div className="col-span-5">
                      {item.raw_materials?.material_name}
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        step="0.001"
                        value={prodLines[item.id]?.quantity || ""}
                        onChange={(e) =>
                          setProdLines((p) => ({
                            ...p,
                            [item.id]: {
                              ...p[item.id],
                              quantity: e.target.value,
                              raw_material_batch_id:
                                p[item.id]?.raw_material_batch_id || "",
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="col-span-1 text-muted-foreground">{item.unit}</div>
                    <div className="col-span-3">
                      <Input
                        placeholder={t("mixtures:select_batch")}
                        value={prodLines[item.id]?.raw_material_batch_id || ""}
                        onChange={(e) =>
                          setProdLines((p) => ({
                            ...p,
                            [item.id]: {
                              ...p[item.id],
                              raw_material_batch_id: e.target.value,
                              quantity: p[item.id]?.quantity || "",
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>{t("mixtures:notes")}</Label>
              <Textarea
                value={prodNotes}
                onChange={(e) => setProdNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProdOpen(false)}>
              {t("mixtures:cancel")}
            </Button>
            <Button
              onClick={handleProduce}
              disabled={!prodQuantity || produce.isPending}
            >
              {t("mixtures:produce_batch")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BatchSamplesCell({
  batchId,
  batchNumber,
  mixtureName,
}: {
  batchId: string;
  batchNumber: string;
  mixtureName: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: samples = [] } = useQuery({
    queryKey: ["mixture_batch_samples", batchId],
    queryFn: () => api.mixtureBatches.listSamples(batchId),
  });

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col text-xs">
        {(samples as any[]).length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          (samples as any[]).slice(0, 3).map((s) => (
            <Link
              key={s.id}
              to={`/proben/${s.id}`}
              className="font-mono hover:underline text-primary"
            >
              {s.sample_number}
            </Link>
          ))
        )}
        {(samples as any[]).length > 3 && (
          <span className="text-muted-foreground">
            +{(samples as any[]).length - 3}
          </span>
        )}
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => setOpen(true)}
        title="Probe erzeugen"
      >
        <FlaskConical className="h-4 w-4" />
      </Button>
      <CreateSampleFromBatchDialog
        open={open}
        onOpenChange={setOpen}
        mixtureBatchId={batchId}
        mixtureBatchNumber={batchNumber}
        mixtureName={mixtureName}
      />
    </div>
  );
}
