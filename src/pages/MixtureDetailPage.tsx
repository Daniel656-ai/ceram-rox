import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus, Trash2, Play, FlaskConical, GitBranch, Settings2, ExternalLink, Copy as CopyIcon, ArrowRightLeft } from "lucide-react";
import { api } from "@/lib/api";
import { CreateSampleFromBatchDialog } from "@/components/CreateSampleFromBatchDialog";
import { ProcessEditor } from "@/components/ProcessEditor";
import { RecipeAvailability } from "@/components/RecipeAvailability";
import { VersionDiffDialog } from "@/components/VersionDiffDialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useRecipeVersions,
  useActiveRecipeVersion,
  useCreateRecipeVersion,
  useActivateRecipeVersion,
} from "@/hooks/useMixtureProcess";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { usePermissions } from "@/hooks/usePermissions";

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

  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("mixtures.edit") || hasPermission("raw_materials.manage");
  const canCreate = hasPermission("mixtures.create") || hasPermission("raw_materials.manage");
  const canProduce = hasPermission("mixtures.produce") || hasPermission("raw_materials.manage");

  const stock = useMemo(() => calculateMixtureStock(movements as any), [movements]);

  // Edit master data
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNumber, setEditNumber] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState<"mischung" | "loesung">("mischung");
  const [editUnit, setEditUnit] = useState("kg");
  const [editConc, setEditConc] = useState("");
  const [editIsTemplate, setEditIsTemplate] = useState(false);
  const [editTemplateKind, setEditTemplateKind] = useState<string>("");

  // Copy dialog
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyName, setCopyName] = useState("");
  const [copyNumber, setCopyNumber] = useState("");
  const [copyAsTemplate, setCopyAsTemplate] = useState(false);

  const openEdit = () => {
    if (!mixture) return;
    setEditName(mixture.name);
    setEditNumber(mixture.mixture_number || "");
    setEditDescription(mixture.description || "");
    setEditCategory(mixture.category);
    setEditUnit(mixture.unit);
    setEditConc(mixture.target_concentration || "");
    setEditIsTemplate(!!(mixture as any).is_template);
    setEditTemplateKind((mixture as any).template_kind || "");
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
      is_template: editIsTemplate,
      template_kind: editIsTemplate ? (editTemplateKind || null) : null,
    } as any);
    setEditOpen(false);
  };

  const handleCopy = async () => {
    if (!id || !copyName.trim()) return;
    try {
      const newId = await api.mixtureTemplates.copy(
        id,
        copyName.trim(),
        copyNumber.trim() || null,
        copyAsTemplate
      );
      toast({ title: "Knetung dupliziert" });
      setCopyOpen(false);
      setCopyName(""); setCopyNumber(""); setCopyAsTemplate(false);
      navigate(`/mischungen/${newId}`);
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
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
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
            {mixture.mixture_number && <span>{mixture.mixture_number}</span>}
            <Badge variant="secondary">{t(`mixtures:category_${mixture.category}`)}</Badge>
            {(mixture as any).is_template && (
              <Badge variant="default" className="bg-blue-600">
                Vorlage{(mixture as any).template_kind ? ` · ${(mixture as any).template_kind}` : ""}
              </Badge>
            )}
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
            {canCreate && (
              <Button variant="outline" size="sm" onClick={() => { setCopyName(mixture.name + " (Kopie)"); setCopyOpen(true); }}>
                <CopyIcon className="h-4 w-4 mr-2" /> Duplizieren
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" size="sm" onClick={openEdit}>
                {t("mixtures:edit")}
              </Button>
            )}
            {canProduce && (
              <Button
                size="sm"
                onClick={openProduce}
                disabled={(recipe as any[]).length === 0}
              >
                <Play className="h-4 w-4 mr-2" />
                {t("mixtures:produce_batch")}
              </Button>
            )}
          </div>
        </div>
      </div>



      <RecipeVersionBar mixtureId={id!} />

      <Tabs defaultValue="recipe">
        <TabsList>
          <TabsTrigger value="recipe">{t("mixtures:recipe")}</TabsTrigger>
          <TabsTrigger value="process"><Settings2 className="h-4 w-4 mr-2" />Prozess</TabsTrigger>
          <TabsTrigger value="batches">{t("mixtures:batches")}</TabsTrigger>
          <TabsTrigger value="inventory">{t("mixtures:inventory")}</TabsTrigger>
        </TabsList>

        <TabsContent value="process">
          <ProcessTab mixtureId={id!} />
        </TabsContent>

        {/* Recipe */}
        <TabsContent value="recipe">
          <Card className="p-4 space-y-4">
            <div className="flex justify-end" hidden={!canEdit}>
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
                      <RawMaterialCombobox
                        materials={rawMaterials as any[]}
                        value={recMaterial}
                        onChange={setRecMaterial}
                        placeholder={t("mixtures:select_raw_material")}
                      />
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
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              deleteRecipeItem.mutate({ id: item.id, mixture_id: id! })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
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
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="tpl" checked={editIsTemplate} onCheckedChange={(c) => setEditIsTemplate(!!c)} />
                <Label htmlFor="tpl" className="cursor-pointer">Als Vorlage markieren</Label>
              </div>
              {editIsTemplate && (
                <div>
                  <Label>Vorlagentyp</Label>
                  <Select value={editTemplateKind} onValueChange={setEditTemplateKind}>
                    <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standardprodukt</SelectItem>
                      <SelectItem value="customer">Kundenprodukt</SelectItem>
                      <SelectItem value="development">Entwicklungsrezeptur</SelectItem>
                      <SelectItem value="pilot">Pilotanlage</SelectItem>
                      <SelectItem value="production">Produktionsanlage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="justify-between">
            {(hasPermission("mixtures.delete") || hasPermission("raw_materials.manage")) ? (
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
            ) : <span />}
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

      {/* Copy mixture dialog */}
      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Knetung duplizieren</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Eine neue Knetung wird mit allen Rohstoffen, Prozessabschnitten, Schritten und Messpunkten als neue Version 1.0 angelegt.
            </p>
            <div>
              <Label>Neuer Name *</Label>
              <Input value={copyName} onChange={(e) => setCopyName(e.target.value)} />
            </div>
            <div>
              <Label>Neue Nummer (optional)</Label>
              <Input value={copyNumber} onChange={(e) => setCopyNumber(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="cpyTpl" checked={copyAsTemplate} onCheckedChange={(c) => setCopyAsTemplate(!!c)} />
              <Label htmlFor="cpyTpl" className="cursor-pointer">Als Vorlage speichern</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyOpen(false)}>Abbrechen</Button>
            <Button onClick={handleCopy} disabled={!copyName.trim()}>Duplizieren</Button>
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

function RecipeVersionBar({ mixtureId }: { mixtureId: string }) {
  const { data: versions = [] } = useRecipeVersions(mixtureId);
  const { data: active } = useActiveRecipeVersion(mixtureId);
  const createVersion = useCreateRecipeVersion();
  const activate = useActivateRecipeVersion(mixtureId);

  const [newOpen, setNewOpen] = useState(false);
  const [vLabel, setVLabel] = useState("");
  const [vSummary, setVSummary] = useState("");
  const [vReason, setVReason] = useState("");
  const [diffOpen, setDiffOpen] = useState(false);

  const submitNewVersion = async () => {
    await createVersion.mutateAsync({
      mixtureId,
      copyFrom: active?.id ?? null,
      versionLabel: vLabel.trim() || null,
      changeSummary: vSummary.trim() || null,
      changeReason: vReason.trim() || null,
    });
    setVLabel(""); setVSummary(""); setVReason("");
    setNewOpen(false);
  };

  return (
    <>
      <Card className="p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Rezepturversionen:</span>
          {(versions as any[]).length === 0 && (
            <span className="text-xs italic text-muted-foreground">Noch keine Version angelegt</span>
          )}
          {(versions as any[]).map((v: any) => (
            <Button
              key={v.id}
              size="sm"
              variant={v.is_active ? "default" : "outline"}
              onClick={() => activate.mutate(v.id)}
              title={v.change_summary || v.notes || ""}
            >
              v{v.version_label || v.version_no}
              {v.is_active && " ✓"}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          {(versions as any[]).length >= 2 && (
            <Button size="sm" variant="outline" onClick={() => setDiffOpen(true)}>
              <ArrowRightLeft className="h-4 w-4 mr-2" /> Vergleichen
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Neue Version
          </Button>
        </div>
        <RecipeAvailability versionId={active?.id} />
      </Card>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Rezepturversion</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Eine neue Version wird auf Basis der aktuell aktiven Version erstellt. Bereits produzierte Chargen bleiben mit ihrer ursprünglichen Version verknüpft.
            </p>
            <div>
              <Label>Versionsbezeichnung (optional)</Label>
              <Input value={vLabel} onChange={(e) => setVLabel(e.target.value)} placeholder="z. B. 1.1 oder 2.0" />
            </div>
            <div>
              <Label>Was wurde geändert?</Label>
              <Textarea rows={2} value={vSummary} onChange={(e) => setVSummary(e.target.value)} />
            </div>
            <div>
              <Label>Warum wurde geändert? (Begründung)</Label>
              <Textarea rows={2} value={vReason} onChange={(e) => setVReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Abbrechen</Button>
            <Button onClick={submitNewVersion}>Anlegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VersionDiffDialog open={diffOpen} onOpenChange={setDiffOpen} mixtureId={mixtureId} />
    </>
  );
}

function ProcessTab({ mixtureId }: { mixtureId: string }) {
  const { data: active } = useActiveRecipeVersion(mixtureId);
  const createVersion = useCreateRecipeVersion();

  if (!active) {
    return (
      <Card className="p-8 text-center space-y-3">
        <p className="text-muted-foreground">Keine aktive Rezepturversion. Bitte zuerst Version anlegen.</p>
        <Button onClick={() => createVersion.mutate({ mixtureId })}>
          <Plus className="h-4 w-4 mr-2" /> Erste Version anlegen
        </Button>
      </Card>
    );
  }
  return <ProcessEditor versionId={active.id} />;
}

function RawMaterialCombobox({
  materials,
  value,
  onChange,
  placeholder,
}: {
  materials: any[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = materials.find((m) => m.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selected
              ? `${selected.material_name}${selected.material_number ? ` (${selected.material_number})` : ""}`
              : placeholder || "..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(itemValue, search) => {
            const q = search.toLowerCase().trim();
            if (!q) return 1;
            return itemValue.toLowerCase().includes(q) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Name oder RK-Code suchen..." />
          <CommandList>
            <CommandEmpty>Keine Treffer.</CommandEmpty>
            <CommandGroup>
              {materials.map((m) => {
                const label = `${m.material_name}${m.material_number ? ` ${m.material_number}` : ""}`;
                return (
                  <CommandItem
                    key={m.id}
                    value={label}
                    onSelect={() => {
                      onChange(m.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === m.id ? "opacity-100" : "opacity-0")} />
                    <span className="flex-1 truncate">{m.material_name}</span>
                    {m.material_number && (
                      <span className="ml-2 text-xs text-muted-foreground">{m.material_number}</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
