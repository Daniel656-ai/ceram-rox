import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus, Trash2, Play, FlaskConical, GitBranch, Settings2, ExternalLink, Copy as CopyIcon, ArrowRightLeft, History, ScanLine, Camera, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { CreateSampleFromBatchDialog } from "@/components/CreateSampleFromBatchDialog";
import { EditBatchDialog } from "@/components/EditBatchDialog";
import { BatchAuditTimeline } from "@/components/BatchAuditTimeline";
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
  useWeighMixtureBatch,
  useFinalizeMixtureBatch,
  useMixtureInventory,
  useRawMaterials,
} from "@/hooks/useMixtures";
import { useContainers } from "@/hooks/useRawMaterials";
import { calculateMixtureStock } from "@/lib/api/mixtures";
import { formatQuantity } from "@/lib/formatQuantity";
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

  // Verwiegen (Phase 1): only documents, no inventory movement
  const weighBatch = useWeighMixtureBatch();
  const finalizeBatch = useFinalizeMixtureBatch(id);
  const [prodOpen, setProdOpen] = useState(false);
  const [prodQuantity, setProdQuantity] = useState("");
  const [prodConc, setProdConc] = useState("");
  const [prodNotes, setProdNotes] = useState("");
  // Per recipe item: chosen container + actual weighed quantity + confirm flag
  const [prodLines, setProdLines] = useState<
    Record<string, { quantity: string; container_id: string; confirmed: boolean; notes: string }>
  >({});

  const openProduce = () => {
    if (!mixture) return;
    setProdQuantity("");
    setProdConc(mixture.target_concentration || "");
    setProdNotes("");
    const init: typeof prodLines = {};
    for (const item of recipe as any[]) {
      init[item.id] = { quantity: String(item.quantity), container_id: "", confirmed: false, notes: "" };
    }
    setProdLines(init);
    setProdOpen(true);
  };

  const handleProduce = async () => {
    if (!id || (recipe as any[]).length === 0) return;
    const weighings = (recipe as any[])
      .map((item) => {
        const line = prodLines[item.id];
        if (!line) return null;
        const qty = Number(line.quantity);
        return {
          raw_material_id: item.raw_material_id,
          container_id: line.container_id || null,
          target_quantity: Number(item.quantity),
          actual_quantity: qty || 0,
          unit: item.unit,
          notes: line.notes || null,
          confirmed: !!line.confirmed,
        };
      })
      .filter(Boolean) as any[];

    try {
      await weighBatch.mutateAsync({
        mixture_id: id,
        unit: mixture!.unit,
        concentration: prodConc.trim() || null,
        notes: prodNotes.trim() || null,
        planned_quantity: prodQuantity ? Number(prodQuantity) : null,
        weighings,
      });
      toast({ title: t("mixtures:weighing_saved") });
      setProdOpen(false);
    } catch (e: any) {
      toast({
        title: t("mixtures:production_error"),
        description: e.message,
        variant: "destructive",
      });
    }
  };

  // Finalize (Chargenabschluss)
  const [finOpen, setFinOpen] = useState(false);
  const [finBatchId, setFinBatchId] = useState<string | null>(null);
  const [finQty, setFinQty] = useState("");

  const openFinalize = (batch: any) => {
    setFinBatchId(batch.id);
    setFinQty(String(batch.produced_quantity ?? ""));
    setFinOpen(true);
  };

  const handleFinalize = async () => {
    if (!finBatchId || !finQty) return;
    try {
      await finalizeBatch.mutateAsync({ batch_id: finBatchId, produced_quantity: Number(finQty) });
      toast({ title: t("mixtures:batch_finalized") });
      setFinOpen(false);
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
  };

  // Edit/Correction dialog
  const [editBatchOpen, setEditBatchOpen] = useState(false);
  const [editBatch, setEditBatch] = useState<any | null>(null);
  const openEditBatch = (batch: any) => {
    setEditBatch(batch);
    setEditBatchOpen(true);
  };

  // Audit-Trail dialog
  const [auditBatch, setAuditBatch] = useState<any | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const openAudit = (batch: any) => {
    setAuditBatch(batch);
    setAuditOpen(true);
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
              {formatQuantity(stock)} {mixture.unit}
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
                      <TableCell>{formatQuantity(item.quantity)}</TableCell>
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
                    <TableHead>Status</TableHead>
                    <TableHead className="w-40">Proben</TableHead>
                    <TableHead className="w-56">Aktion</TableHead>
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
                        {formatQuantity(b.produced_quantity)} {b.unit}
                      </TableCell>
                      <TableCell>{b.concentration || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {(b.mixture_batch_consumptions || []).map((c: any) => (
                          <div key={c.id}>
                            {c.raw_materials?.material_name}: {formatQuantity(c.quantity)} {c.unit}
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
                        {b.status === "abgeschlossen" ? (
                          <Badge variant="secondary">{t("mixtures:status_completed")}</Badge>
                        ) : b.status === "laufend" ? (
                          <Badge variant="outline">{t("mixtures:status_running")}</Badge>
                        ) : (
                          <Badge>{t("mixtures:status_weighed")}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <BatchSamplesCell batchId={b.id} batchNumber={b.batch_number} mixtureName={mixture.name} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {b.status !== "abgeschlossen" && canProduce && (
                            <Button size="sm" variant="outline" onClick={() => openFinalize(b)}>
                              Abschließen
                            </Button>
                          )}
                          {canProduce && (
                            <Button size="sm" variant="ghost" onClick={() => openEditBatch(b)}>
                              Bearbeiten
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => openAudit(b)}>
                            <History className="h-3 w-3 mr-1" /> Historie
                          </Button>
                        </div>
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
                        {formatQuantity(m.quantity)} {m.unit}
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

      {/* Verwiegemaske */}
      <Dialog open={prodOpen} onOpenChange={setProdOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("mixtures:weighing_dialog_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>
                  Geplante Menge ({mixture.unit})
                </Label>
                <Input
                  type="number"
                  step="0.001"
                  value={prodQuantity}
                  onChange={(e) => setProdQuantity(e.target.value)}
                  placeholder="Optional – Zielmenge der Charge"
                />
              </div>
              <div>
                <Label>{t("mixtures:concentration")}</Label>
                <Input value={prodConc} onChange={(e) => setProdConc(e.target.value)} />
              </div>
            </div>

            <BarcodeScannerRow
              recipe={recipe as any[]}
              onFound={(item, containerId) =>
                setProdLines((p) => ({
                  ...p,
                  [item.id]: { ...(p[item.id] || { quantity: "", container_id: "", confirmed: false, notes: "" }), container_id: containerId },
                }))
              }
            />

            <div>
              <Label className="mb-2 block">Verwiegung pro Rohstoff</Label>
              <div className="space-y-3 border rounded-md p-3">
                {(recipe as any[]).map((item) => (
                  <WeighingLine
                    key={item.id}
                    item={item}
                    line={prodLines[item.id] || { quantity: "", container_id: "", confirmed: false, notes: "" }}
                    onChange={(patch) =>
                      setProdLines((p) => ({
                        ...p,
                        [item.id]: { ...(p[item.id] || { quantity: "", container_id: "", confirmed: false, notes: "" }), ...patch },
                      }))
                    }
                  />
                ))}
                {(recipe as any[]).length === 0 && (
                  <div className="text-sm text-muted-foreground">Keine Rohstoffe in der Rezeptur.</div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Hinweis: Die Verwiegung dokumentiert nur. Der Lagerbestand wird erst beim Chargenabschluss gebucht.
              </p>
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
              disabled={weighBatch.isPending || (recipe as any[]).length === 0}
            >
              Verwiegung speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chargenabschluss */}
      <Dialog open={finOpen} onOpenChange={setFinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("mixtures:finalize_batch")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Beim Abschluss werden die tatsächlichen Verbrauchsmengen (FIFO je Gebinde) aus dem Lager gebucht und die hergestellte Menge dem Bestand gutgeschrieben.
            </p>
            <div>
              <Label>Hergestellte Menge ({mixture.unit}) *</Label>
              <Input type="number" step="0.001" value={finQty} onChange={(e) => setFinQty(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinOpen(false)}>{t("mixtures:cancel")}</Button>
            <Button onClick={handleFinalize} disabled={!finQty || finalizeBatch.isPending}>
              {t("mixtures:finalize_batch")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Correction dialog */}
      {editBatch && (
        <EditBatchDialog
          open={editBatchOpen}
          onOpenChange={(v) => { setEditBatchOpen(v); if (!v) setEditBatch(null); }}
          batch={editBatch}
          mixtureId={id}
        />
      )}

      {auditBatch && (
        <BatchAuditTimeline
          open={auditOpen}
          onOpenChange={(v) => { setAuditOpen(v); if (!v) setAuditBatch(null); }}
          batch={auditBatch}
        />
      )}



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

function WeighingLine({
  item,
  line,
  onChange,
}: {
  item: any;
  line: { quantity: string; container_id: string; confirmed: boolean; notes: string };
  onChange: (patch: Partial<{ quantity: string; container_id: string; confirmed: boolean; notes: string }>) => void;
}) {
  const { data: containers = [] } = useContainers(item.raw_material_id);
  const available = (containers as any[]).filter(
    (c: any) => Number(c.current_quantity ?? 0) > 0 && c.status !== "gesperrt" && c.status !== "entsorgt"
  );
  const selected = available.find((c: any) => c.id === line.container_id);

  const tare = selected?.tare_weight ? Number(selected.tare_weight) : null;
  const [gross, setGross] = useState("");

  const applyGross = (g: string) => {
    setGross(g);
    if (g && tare != null) {
      const net = Math.max(0, Number(g) - tare);
      onChange({ quantity: net.toFixed(3) });
    }
  };

  return (
    <div className="border rounded-md p-3 space-y-2 bg-muted/20">
      <div className="grid grid-cols-12 gap-2 items-center">
        <div className="col-span-4">
          <div className="font-medium text-sm">{item.raw_materials?.material_name}</div>
          <div className="text-xs text-muted-foreground">
            Soll: {formatQuantity(item.quantity)} {item.unit}
          </div>
        </div>
        <div className="col-span-5">
          <Label className="text-xs">Gebinde</Label>
          <Select
            value={line.container_id || "__none__"}
            onValueChange={(v) => onChange({ container_id: v === "__none__" ? "" : v })}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Gebinde wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— kein Gebinde —</SelectItem>
              {available.length === 0 && (
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  Kein Gebinde verfügbar
                </div>
              )}
              {available.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.container_code}
                  {c.container_name ? ` – ${c.container_name}` : ""}
                  {" · "}
                  {formatQuantity(c.current_quantity)} {c.unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-3">
          <Label className="text-xs">Istmenge ({item.unit})</Label>
          <Input
            type="number"
            step="0.001"
            value={line.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
          />
        </div>
      </div>

      {selected && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground bg-background rounded p-2 border">
          <div>
            <span className="font-medium">Gebinde-ID:</span> {selected.container_code}
          </div>
          <div>
            <span className="font-medium">LOT:</span>{" "}
            {selected.raw_material_batches?.batch_number || "—"}
          </div>
          <div>
            <span className="font-medium">Bestand:</span>{" "}
            {formatQuantity(selected.current_quantity)} {selected.unit}
          </div>
          <div>
            <span className="font-medium">Tara:</span>{" "}
            {tare != null ? `${formatQuantity(tare)} ${selected.tare_unit || "kg"}` : "—"}
          </div>
          <div>
            <span className="font-medium">Lagerort:</span>{" "}
            {selected.storage_locations?.name || selected.location_note || "—"}
          </div>
          <div>
            <span className="font-medium">Verfall:</span>{" "}
            {selected.expiry_date ? format(new Date(selected.expiry_date), "dd.MM.yyyy") : "—"}
          </div>
        </div>
      )}

      {tare != null && (
        <div className="grid grid-cols-3 gap-2 items-end">
          <div>
            <Label className="text-xs">Bruttogewicht</Label>
            <Input
              type="number"
              step="0.001"
              value={gross}
              onChange={(e) => applyGross(e.target.value)}
              placeholder="→ Netto = Brutto − Tara"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Netto = Brutto − Tara ({formatQuantity(tare)} {selected?.tare_unit || "kg"})
          </div>
          <ScaleOcrButton onValue={(v) => (tare != null ? applyGross(String(v)) : onChange({ quantity: String(v) }))} />
        </div>
      )}

      <div className="grid grid-cols-12 gap-2 items-center">
        <div className="col-span-9">
          <Input
            placeholder="Bemerkung (optional)"
            value={line.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </div>
        <label className="col-span-3 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={line.confirmed}
            onChange={(e) => onChange({ confirmed: e.target.checked })}
          />
          Verwiegung bestätigt
        </label>
      </div>
    </div>
  );
}
