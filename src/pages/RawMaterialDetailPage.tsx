import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useRawMaterialDetail, useRawMaterials, useAddBatch, useDeleteBatch, useUpdateBatch, useAddAnalysis, useDeleteAnalysis, useInventoryMovements, useAddMovement, useAddRawMaterialDocument, useUpdateRawMaterial, useDeleteRawMaterial, useStorageLocations, calculateStock, useContainers, useAddContainer, useUpdateContainer, useDeleteContainer } from "@/hooks/useRawMaterials";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Plus, Upload, Download, Trash2, FileText, Package, FlaskConical, BarChart3, Pencil, AlertTriangle, GitBranch, Container as ContainerIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HazardClassSelector } from "@/components/HazardClassSelector";
import { GhsPictogramList } from "@/components/GhsPictogram";
import { normalizeHazardClasses, type HazardClassKey } from "@/lib/hazardClasses";
import { DerivedSamples } from "@/components/DerivedSamples";
import { ContainerActionsDialog } from "@/components/ContainerActionsDialog";
import { History as HistoryIcon } from "lucide-react";




function formatLocation(loc: any) {
  if (!loc) return "–";
  return [loc.hall, loc.room, loc.shelf, loc.position].filter(Boolean).join(" › ");
}

export default function RawMaterialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation(["raw_materials", "common"]);
  const { user, role } = useAuth();
  const { data: mat, isLoading } = useRawMaterialDetail(id);
  const { data: movements } = useInventoryMovements(id);
  const { data: locations } = useStorageLocations();
  const { data: allMaterials } = useRawMaterials();
  const { data: projects } = useProjects();

  // Extract unique suppliers from all raw materials
  const suppliers = useMemo(() => {
    if (!allMaterials) return [];
    return [...new Set(allMaterials.map((m: any) => m.supplier).filter(Boolean))] as string[];
  }, [allMaterials]);
  const addBatch = useAddBatch();
  const deleteBatch = useDeleteBatch();
  const updateBatch = useUpdateBatch();
  const addAnalysis = useAddAnalysis();
  const deleteAnalysis = useDeleteAnalysis();
  const addMovement = useAddMovement();
  const addDocument = useAddRawMaterialDocument();
  const updateMaterial = useUpdateRawMaterial();
  const deleteMaterial = useDeleteRawMaterial();
  const navigate = useNavigate();

  const canManage = role === "master" || role === "auftraggeber";
  const stock = movements ? calculateStock(movements) : 0;

  // Edit material form
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNumber, setEditNumber] = useState("");
  const [editCasNumber, setEditCasNumber] = useState("");
  const [editMrsNumber, setEditMrsNumber] = useState("");
  const [editEgNumber, setEditEgNumber] = useState("");
  const [editManufacturer, setEditManufacturer] = useState("");
  const [editSupplier, setEditSupplier] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editLocationId, setEditLocationId] = useState<string>("");
  const [editPricePerKg, setEditPricePerKg] = useState("");
  const [editHazardCats, setEditHazardCats] = useState<HazardClassKey[]>([]);

  const openEditDialog = () => {
    if (!mat) return;
    setEditName(mat.material_name);
    setEditNumber(mat.material_number || "");
    setEditCasNumber((mat as any).cas_number || "");
    setEditMrsNumber((mat as any).mrs_number || "");
    setEditEgNumber((mat as any).eg_number || "");
    setEditManufacturer((mat as any).manufacturer || "");
    setEditSupplier(mat.supplier || "");
    setEditDesc(mat.description || "");
    setEditUnit(mat.unit);
    setEditLocationId(mat.default_location_id || "");
    setEditPricePerKg(String((mat as any).price_per_kg || 0));
    setEditHazardCats(normalizeHazardClasses(((mat as any).hazard_categories as string[]) || []));
    setEditOpen(true);
  };


  const handleUpdateMaterial = async () => {
    if (!editName) { toast.error(t("raw_materials:name_required")); return; }
    // Duplicate name check (excluding self)
    const dup = allMaterials?.find(
      (m: any) => m.id !== id && m.material_name.toLowerCase() === editName.trim().toLowerCase(),
    );
    if (dup) { toast.error(t("raw_materials:duplicate_name")); return; }
    try {
      await updateMaterial.mutateAsync({
        id: id!,
        material_name: editName,
        material_number: editNumber.trim() || null,
        cas_number: editCasNumber.trim() || null,
        mrs_number: editMrsNumber.trim() || null,
        eg_number: editEgNumber.trim() || null,
        manufacturer: editManufacturer.trim() || null,
        supplier: editSupplier || undefined,
        description: editDesc || undefined,
        unit: editUnit,
        default_location_id: editLocationId || null,
        price_per_kg: Number(editPricePerKg) || 0,
        is_hazardous: editHazardCats.length > 0,
        hazard_categories: editHazardCats,
      });
      toast.success(t("raw_materials:material_updated"));
      setEditOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteMaterial = async () => {
    if (!id) return;
    try {
      await deleteMaterial.mutateAsync(id);
      toast.success(t("raw_materials:material_deleted", { name: mat?.material_name }));
      navigate("/rohstoffe");
    } catch (e: any) {
      toast.error(t("common:error"), { description: e.message });
    }
  };


  // Batch form
  const [batchOpen, setBatchOpen] = useState(false);
  const [bNum, setBNum] = useState("");
  const [bDate, setBDate] = useState("");
  const [bQty, setBQty] = useState("");
  const [bSupplier, setBSupplier] = useState("");
  const [bNotes, setBNotes] = useState("");
  const [bManufacturerBatch, setBManufacturerBatch] = useState("");
  const [bGoodsReceiptDate, setBGoodsReceiptDate] = useState("");
  const [bReleaseStatus, setBReleaseStatus] = useState<"gesperrt" | "in_pruefung" | "freigegeben" | "abgelehnt">("in_pruefung");
  const [bInspectionStatus, setBInspectionStatus] = useState<"ausstehend" | "laufend" | "bestanden" | "nicht_bestanden">("ausstehend");

  // Container (Gebinde) form
  const { data: containers } = useContainers(id);
  const addContainer = useAddContainer();
  const updateContainer = useUpdateContainer();
  const deleteContainer = useDeleteContainer();
  const [contOpen, setContOpen] = useState(false);
  const [cEditId, setCEditId] = useState<string | null>(null);
  const [cCode, setCCode] = useState("");
  const [cBarcode, setCBarcode] = useState("");
  const [cBatchId, setCBatchId] = useState("");
  const [cKind, setCKind] = useState<"fass" | "kanister" | "sack" | "big_bag" | "ibc" | "tank" | "flasche" | "sonstige">("fass");
  const [cInitial, setCInitial] = useState("");
  const [cCurrent, setCCurrent] = useState("");
  const [cUnit, setCUnit] = useState("kg");
  const [cStatus, setCStatus] = useState<"verfuegbar" | "reserviert" | "in_verwendung" | "leer" | "gesperrt" | "entsorgt">("verfuegbar");
  const [cLocationId, setCLocationId] = useState("");
  const [cLocationNote, setCLocationNote] = useState("");
  const [cNotes, setCNotes] = useState("");

  // Container actions dialog (movements/history/audit)
  const [actionsContainer, setActionsContainer] = useState<any | null>(null);

  const openContainerDialog = (existing?: any) => {
    if (existing) {
      setCEditId(existing.id);
      setCCode(existing.container_code || "");
      setCBarcode(existing.barcode || "");
      setCBatchId(existing.batch_id || "");
      setCKind(existing.kind);
      setCInitial(String(existing.initial_quantity ?? ""));
      setCCurrent(String(existing.current_quantity ?? ""));
      setCUnit(existing.unit || "kg");
      setCStatus(existing.status);
      setCLocationId(existing.location_id || "");
      setCLocationNote(existing.location_note || "");
      setCNotes(existing.notes || "");
    } else {
      setCEditId(null);
      setCCode(""); setCBarcode(""); setCBatchId("");
      setCKind("fass"); setCInitial(""); setCCurrent("");
      setCUnit(mat?.unit || "kg"); setCStatus("verfuegbar");
      setCLocationId(mat?.default_location_id || "");
      setCLocationNote(""); setCNotes("");
    }
    setContOpen(true);
  };

  const handleSaveContainer = async () => {
    if (!id) return;
    if (!cInitial || Number(cInitial) <= 0) { toast.error("Ursprüngliche Menge muss > 0 sein"); return; }
    const payload = {
      raw_material_id: id,
      batch_id: cBatchId || null,
      container_code: cCode.trim() || null,
      barcode: cBarcode.trim() || null,
      kind: cKind,
      initial_quantity: Number(cInitial),
      current_quantity: Number(cCurrent || cInitial),
      unit: cUnit,
      status: cStatus,
      location_id: cLocationId || null,
      location_note: cLocationNote || null,
      notes: cNotes || null,
    };
    try {
      if (cEditId) {
        await updateContainer.mutateAsync({ id: cEditId, raw_material_id: id, ...payload });
        toast.success("Gebinde aktualisiert");
      } else {
        await addContainer.mutateAsync(payload);
        toast.success("Gebinde angelegt");
      }
      setContOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };
  // Analysis form
  const [anaOpen, setAnaOpen] = useState(false);
  const [aType, setAType] = useState("allgemein");
  const [aParam, setAParam] = useState("");
  const [aVal, setAVal] = useState("");
  const [aUnit, setAUnit] = useState("");
  const [aBatchId, setABatchId] = useState("");
  const [aRemarks, setARemarks] = useState("");

  // Movement form
  const [movOpen, setMovOpen] = useState(false);
  const [mType, setMType] = useState("eingang");
  const [mQty, setMQty] = useState("");
  const [mDate, setMDate] = useState("");
  const [mBatchId, setMBatchId] = useState("");
  const [mSupplier, setMSupplier] = useState("");
  const [mProject, setMProject] = useState("");
  const [mExperiment, setMExperiment] = useState("");
  const [mComment, setMComment] = useState("");

  // Document upload
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("zertifikat");
  const [docBatchId, setDocBatchId] = useState("");

  if (isLoading) return <div className="p-8 text-muted-foreground">Laden...</div>;
  if (!mat) return <div className="p-8 text-muted-foreground">Rohstoff nicht gefunden</div>;

  const batches = mat.raw_material_batches || [];
  const documents = mat.raw_material_documents || [];
  const analyses = mat.raw_material_analyses || [];

  const handleAddBatch = async () => {
    if (!bNum) { toast.error("Chargennummer ist Pflicht"); return; }
    try {
      await addBatch.mutateAsync({
        raw_material_id: id!,
        batch_number: bNum,
        delivery_date: bDate || undefined,
        delivery_quantity: bQty ? Number(bQty) : undefined,
        supplier: bSupplier || undefined,
        notes: bNotes || undefined,
        manufacturer_batch: bManufacturerBatch.trim() || null,
        goods_receipt_date: bGoodsReceiptDate || null,
        release_status: bReleaseStatus,
        inspection_status: bInspectionStatus,
      });
      toast.success("Charge angelegt");
      setBatchOpen(false);
      setBNum(""); setBDate(""); setBQty(""); setBSupplier(""); setBNotes("");
      setBManufacturerBatch(""); setBGoodsReceiptDate("");
      setBReleaseStatus("in_pruefung"); setBInspectionStatus("ausstehend");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleAddAnalysis = async () => {
    if (!aParam) { toast.error("Parametername ist Pflicht"); return; }
    try {
      await addAnalysis.mutateAsync({ raw_material_id: id!, batch_id: aBatchId || undefined, analysis_type: aType, parameter_name: aParam, value: aVal ? Number(aVal) : undefined, unit: aUnit || undefined, remarks: aRemarks || undefined });
      toast.success("Analyse hinzugefügt");
      setAnaOpen(false); setAParam(""); setAVal(""); setAUnit(""); setARemarks(""); setABatchId("");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleAddMovement = async () => {
    if (!mQty || Number(mQty) <= 0) { toast.error("Menge muss > 0 sein"); return; }
    const projectRef = [mProject, mExperiment].filter(Boolean).join(" / ") || undefined;
    try {
      await addMovement.mutateAsync({ raw_material_id: id!, batch_id: mBatchId || undefined, movement_type: mType, quantity: Number(mQty), movement_date: mDate || undefined, supplier: mSupplier || undefined, project_reference: projectRef, comment: mComment || undefined });
      toast.success(mType === "eingang" ? "Wareneingang gebucht" : "Verbrauch gebucht");
      setMovOpen(false); setMQty(""); setMDate(""); setMBatchId(""); setMSupplier(""); setMProject(""); setMExperiment(""); setMComment("");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleUploadDoc = async (file: File) => {
    setUploading(true);
    try {
      await addDocument.mutateAsync({ file, raw_material_id: id!, batch_id: docBatchId || undefined, document_type: docType });
      toast.success("Dokument hochgeladen");
    } catch (e: any) { toast.error(e.message); }
    setUploading(false);
  };

  const handleDownload = async (doc: any) => {
    try {
      const data = await api.rawMaterialStorage.download(doc.storage_path);
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url; a.download = doc.file_name; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/rohstoffe"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <span>{mat.material_name}</span>
            <GhsPictogramList hazardClasses={(mat as any).hazard_categories} size="md" />
          </h1>
          <p className="text-sm text-muted-foreground">{mat.material_number || "—"} · {mat.supplier || "Kein Lieferant"} · Lagerort: {formatLocation(mat.storage_locations)} · Preis: {(mat as any).price_per_kg || 0} €/kg{(mat as any).cas_number ? ` · CAS: ${(mat as any).cas_number}` : ""}{(mat as any).mrs_number ? ` · MRS: ${(mat as any).mrs_number}` : ""}{(mat as any).eg_number ? ` · EG: ${(mat as any).eg_number}` : ""}{(mat as any).manufacturer ? ` · Hersteller: ${(mat as any).manufacturer}` : ""}</p>
        </div>
        {canManage && (
          <>
            <Button variant="outline" size="sm" onClick={openEditDialog}><Pencil className="h-4 w-4 mr-1" />{t("common:edit")}</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-1" />{t("common:delete")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("raw_materials:delete_title")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("raw_materials:delete_description", { name: mat.material_name })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDeleteMaterial}
                  >
                    {t("common:delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
        <Badge variant={stock <= 0 ? "destructive" : "secondary"} className="text-lg px-3 py-1">{stock.toFixed(2)} {mat.unit}</Badge>
      </div>

      {/* Hazard warning banner */}
      {(mat as any).is_hazardous && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="font-semibold flex flex-wrap items-center gap-3">
            <span>{t("raw_materials:hazard_warning")}</span>
            <GhsPictogramList hazardClasses={(mat as any).hazard_categories} size="md" />
          </AlertDescription>
        </Alert>
      )}


      {/* Edit Material Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Rohstoff bearbeiten</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name *</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
              <div><Label>{t("raw_materials:material_number")}</Label><Input value={editNumber} onChange={(e) => setEditNumber(e.target.value)} placeholder={t("raw_materials:material_number_placeholder")} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("raw_materials:cas_number")}</Label><Input value={editCasNumber} onChange={(e) => setEditCasNumber(e.target.value)} placeholder={t("raw_materials:cas_number_placeholder")} /></div>
              <div><Label>{t("raw_materials:mrs_number")}</Label><Input value={editMrsNumber} onChange={(e) => setEditMrsNumber(e.target.value)} placeholder={t("raw_materials:mrs_number_placeholder")} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>EG-Nummer</Label><Input value={editEgNumber} onChange={(e) => setEditEgNumber(e.target.value)} placeholder="z.B. 200-578-6" /></div>
              <div><Label>Hersteller</Label><Input value={editManufacturer} onChange={(e) => setEditManufacturer(e.target.value)} placeholder="z.B. BASF" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Einheit</Label>
                <Select value={editUnit} onValueChange={setEditUnit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["kg", "g", "t", "Liter", "ml", "Stück"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Lieferant</Label><Input value={editSupplier} onChange={(e) => setEditSupplier(e.target.value)} /></div>
            </div>
            <div>
              <Label>Lagerort</Label>
              <Select value={editLocationId || "__none__"} onValueChange={(v) => setEditLocationId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Lagerort wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Kein Lagerort</SelectItem>
                  {locations?.map((l) => <SelectItem key={l.id} value={l.id}>{formatLocation(l)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Preis/kg (€)</Label><Input type="number" step="0.01" min="0" value={editPricePerKg} onChange={(e) => setEditPricePerKg(e.target.value)} /></div>
            <div><Label>Beschreibung</Label><Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} /></div>
            <HazardClassSelector
              value={editHazardCats}
              onChange={setEditHazardCats}
              label={t("raw_materials:hazard_section")}
              idPrefix="edit-haz"
            />

            <Button onClick={handleUpdateMaterial} className="w-full" disabled={updateMaterial.isPending}>Speichern</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="chargen">
        <TabsList>
          <TabsTrigger value="chargen"><Package className="h-4 w-4 mr-1" />Chargen</TabsTrigger>
          <TabsTrigger value="gebinde"><ContainerIcon className="h-4 w-4 mr-1" />Gebinde</TabsTrigger>
          <TabsTrigger value="analysen"><FlaskConical className="h-4 w-4 mr-1" />Analysen</TabsTrigger>
          <TabsTrigger value="dokumente"><FileText className="h-4 w-4 mr-1" />Dokumente</TabsTrigger>
          <TabsTrigger value="lager"><BarChart3 className="h-4 w-4 mr-1" />Lagerbewegungen</TabsTrigger>
          <TabsTrigger value="proben"><GitBranch className="h-4 w-4 mr-1" />Proben</TabsTrigger>
        </TabsList>

        {/* CHARGEN */}
        <TabsContent value="chargen">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Chargen ({batches.length})</CardTitle>
              {canManage && (
                <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Charge</Button></DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Neue Charge</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Chargennummer *</Label><Input value={bNum} onChange={(e) => setBNum(e.target.value)} /></div>
                        <div><Label>Herstellercharge</Label><Input value={bManufacturerBatch} onChange={(e) => setBManufacturerBatch(e.target.value)} placeholder="z.B. H-2024-A12" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Lieferdatum</Label><Input type="date" value={bDate} onChange={(e) => setBDate(e.target.value)} /></div>
                        <div><Label>Wareneingangsdatum</Label><Input type="date" value={bGoodsReceiptDate} onChange={(e) => setBGoodsReceiptDate(e.target.value)} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Liefermenge</Label><Input type="number" step="0.001" value={bQty} onChange={(e) => setBQty(e.target.value)} /></div>
                        <div><Label>Lieferant</Label><Input value={bSupplier} onChange={(e) => setBSupplier(e.target.value)} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Freigabestatus</Label>
                          <Select value={bReleaseStatus} onValueChange={(v: any) => setBReleaseStatus(v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gesperrt">Gesperrt</SelectItem>
                              <SelectItem value="in_pruefung">In Prüfung</SelectItem>
                              <SelectItem value="freigegeben">Freigegeben</SelectItem>
                              <SelectItem value="abgelehnt">Abgelehnt</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Prüfstatus</Label>
                          <Select value={bInspectionStatus} onValueChange={(v: any) => setBInspectionStatus(v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ausstehend">Ausstehend</SelectItem>
                              <SelectItem value="laufend">Laufend</SelectItem>
                              <SelectItem value="bestanden">Bestanden</SelectItem>
                              <SelectItem value="nicht_bestanden">Nicht bestanden</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div><Label>Bemerkungen</Label><Textarea value={bNotes} onChange={(e) => setBNotes(e.target.value)} rows={2} /></div>
                      <Button onClick={handleAddBatch} className="w-full">Anlegen</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Chargennr.</TableHead><TableHead>Herstellercharge</TableHead><TableHead>Wareneingang</TableHead><TableHead>Menge</TableHead><TableHead>Lieferant</TableHead><TableHead>Freigabe</TableHead><TableHead>Prüfung</TableHead>{canManage && <TableHead />}
                </TableRow></TableHeader>
                <TableBody>
                  {batches.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Keine Chargen</TableCell></TableRow>
                  ) : batches.map((b: any) => {
                    const rs = b.release_status as string | undefined;
                    const is = b.inspection_status as string | undefined;
                    const rsVariant = rs === "freigegeben" ? "default" : rs === "abgelehnt" || rs === "gesperrt" ? "destructive" : "secondary";
                    const isVariant = is === "bestanden" ? "default" : is === "nicht_bestanden" ? "destructive" : "secondary";
                    const rsLabel: Record<string, string> = { gesperrt: "Gesperrt", in_pruefung: "In Prüfung", freigegeben: "Freigegeben", abgelehnt: "Abgelehnt" };
                    const isLabel: Record<string, string> = { ausstehend: "Ausstehend", laufend: "Laufend", bestanden: "Bestanden", nicht_bestanden: "Nicht best." };
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-sm">{b.batch_number}</TableCell>
                        <TableCell className="font-mono text-xs">{b.manufacturer_batch || "–"}</TableCell>
                        <TableCell className="text-xs">{b.goods_receipt_date ? new Date(b.goods_receipt_date).toLocaleDateString("de-DE") : (b.delivery_date ? new Date(b.delivery_date).toLocaleDateString("de-DE") : "–")}</TableCell>
                        <TableCell>{b.delivery_quantity != null ? `${b.delivery_quantity} ${mat.unit}` : "–"}</TableCell>
                        <TableCell>{b.supplier || "–"}</TableCell>
                        <TableCell><Badge variant={rsVariant as any} className="text-xs">{rsLabel[rs || ""] || "–"}</Badge></TableCell>
                        <TableCell><Badge variant={isVariant as any} className="text-xs">{isLabel[is || ""] || "–"}</Badge></TableCell>
                        {canManage && <TableCell><Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteBatch.mutate({ id: b.id, raw_material_id: id! })}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GEBINDE */}
        <TabsContent value="gebinde">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Gebinde ({containers?.length || 0})</CardTitle>
              {canManage && (
                <Button size="sm" onClick={() => openContainerDialog()}><Plus className="h-4 w-4 mr-1" />Gebinde</Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Gebinde-ID</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Charge</TableHead>
                  <TableHead>Art</TableHead>
                  <TableHead className="text-right">Bestand</TableHead>
                  <TableHead>Lagerort</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead />}
                </TableRow></TableHeader>
                <TableBody>
                  {!containers || containers.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Keine Gebinde</TableCell></TableRow>
                  ) : containers.map((c: any) => {
                    const kindLabel: Record<string, string> = { fass: "Fass", kanister: "Kanister", sack: "Sack", big_bag: "Big Bag", ibc: "IBC", tank: "Tank", flasche: "Flasche", sonstige: "Sonstige" };
                    const statusLabel: Record<string, string> = { verfuegbar: "Verfügbar", reserviert: "Reserviert", in_verwendung: "In Verwendung", leer: "Leer", gesperrt: "Gesperrt", entsorgt: "Entsorgt" };
                    const statusVariant = c.status === "verfuegbar" ? "default" : c.status === "leer" || c.status === "entsorgt" ? "secondary" : c.status === "gesperrt" ? "destructive" : "outline";
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.container_code}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{c.barcode || "–"}</TableCell>
                        <TableCell className="text-xs">{c.raw_material_batches?.batch_number || "–"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{kindLabel[c.kind] || c.kind}</Badge></TableCell>
                        <TableCell className="text-right font-mono text-sm">{Number(c.current_quantity).toFixed(2)} / {Number(c.initial_quantity).toFixed(2)} {c.unit}</TableCell>
                        <TableCell className="text-xs">{formatLocation(c.storage_locations)}{c.location_note ? ` (${c.location_note})` : ""}</TableCell>
                        <TableCell><Badge variant={statusVariant as any} className="text-xs">{statusLabel[c.status] || c.status}</Badge></TableCell>
                        {canManage && (
                          <TableCell className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Bewegungen & Historie" onClick={() => setActionsContainer(c)}><HistoryIcon className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openContainerDialog(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { if (confirm(`Gebinde ${c.container_code} löschen?`)) deleteContainer.mutate({ id: c.id, raw_material_id: id! }); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Container Dialog */}
          <Dialog open={contOpen} onOpenChange={setContOpen}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{cEditId ? "Gebinde bearbeiten" : "Neues Gebinde"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Gebinde-ID</Label>
                    <Input value={cCode} onChange={(e) => setCCode(e.target.value)} placeholder="Auto: GEB-<Charge>-NNN" />
                  </div>
                  <div>
                    <Label>Barcode / QR</Label>
                    <Input value={cBarcode} onChange={(e) => setCBarcode(e.target.value)} placeholder="Optional" />
                  </div>
                </div>
                <div>
                  <Label>Charge</Label>
                  <Select value={cBatchId || "__none__"} onValueChange={(v) => setCBatchId(v === "__none__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Charge wählen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Keine Charge</SelectItem>
                      {batches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.batch_number}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Art</Label>
                    <Select value={cKind} onValueChange={(v: any) => setCKind(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fass">Fass</SelectItem>
                        <SelectItem value="kanister">Kanister</SelectItem>
                        <SelectItem value="sack">Sack</SelectItem>
                        <SelectItem value="big_bag">Big Bag</SelectItem>
                        <SelectItem value="ibc">IBC</SelectItem>
                        <SelectItem value="tank">Tank</SelectItem>
                        <SelectItem value="flasche">Flasche</SelectItem>
                        <SelectItem value="sonstige">Sonstige</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={cStatus} onValueChange={(v: any) => setCStatus(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="verfuegbar">Verfügbar</SelectItem>
                        <SelectItem value="reserviert">Reserviert</SelectItem>
                        <SelectItem value="in_verwendung">In Verwendung</SelectItem>
                        <SelectItem value="leer">Leer</SelectItem>
                        <SelectItem value="gesperrt">Gesperrt</SelectItem>
                        <SelectItem value="entsorgt">Entsorgt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Ursprüngl. Menge *</Label>
                    <Input type="number" step="0.001" value={cInitial} onChange={(e) => setCInitial(e.target.value)} />
                  </div>
                  <div>
                    <Label>Aktueller Bestand</Label>
                    <Input type="number" step="0.001" value={cCurrent} onChange={(e) => setCCurrent(e.target.value)} placeholder="= Ursprüngl." />
                  </div>
                  <div>
                    <Label>Einheit</Label>
                    <Select value={cUnit} onValueChange={setCUnit}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["kg", "g", "t", "Liter", "ml", "Stück"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Lagerort</Label>
                  <Select value={cLocationId || "__none__"} onValueChange={(v) => setCLocationId(v === "__none__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Lagerort wählen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Kein Lagerort</SelectItem>
                      {locations?.map((l) => <SelectItem key={l.id} value={l.id}>{formatLocation(l)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Lagerort-Notiz</Label>
                  <Input value={cLocationNote} onChange={(e) => setCLocationNote(e.target.value)} placeholder="z.B. Stellplatz 5" />
                </div>
                <div>
                  <Label>Bemerkungen</Label>
                  <Textarea value={cNotes} onChange={(e) => setCNotes(e.target.value)} rows={2} />
                </div>
                <Button onClick={handleSaveContainer} className="w-full" disabled={addContainer.isPending || updateContainer.isPending}>
                  {cEditId ? "Speichern" : "Anlegen"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <ContainerActionsDialog open={!!actionsContainer} onOpenChange={(o) => !o && setActionsContainer(null)} container={actionsContainer} />
        </TabsContent>


        {/* ANALYSEN */}
        <TabsContent value="analysen">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Analysedaten ({analyses.length})</CardTitle>
              {canManage && (
                <Dialog open={anaOpen} onOpenChange={setAnaOpen}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Analyse</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Analysedaten hinzufügen</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label>Analyseart</Label>
                        <Select value={aType} onValueChange={setAType}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="allgemein">Allgemein</SelectItem>
                            <SelectItem value="korngroesse">Korngrößenverteilung</SelectItem>
                            <SelectItem value="chemisch">Chemische Analyse</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Charge (optional)</Label>
                        <Select value={aBatchId || "__none__"} onValueChange={(v) => setABatchId(v === "__none__" ? "" : v)}>
                          <SelectTrigger><SelectValue placeholder="Keine Charge" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Keine</SelectItem>
                            {batches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.batch_number}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div><Label>Parameter *</Label><Input value={aParam} onChange={(e) => setAParam(e.target.value)} placeholder={aType === "korngroesse" ? "z.B. <63µm" : aType === "chemisch" ? "z.B. SiO2" : "z.B. Feuchtigkeit"} /></div>
                        <div><Label>Wert</Label><Input type="number" value={aVal} onChange={(e) => setAVal(e.target.value)} /></div>
                        <div><Label>Einheit</Label><Input value={aUnit} onChange={(e) => setAUnit(e.target.value)} placeholder={aType === "korngroesse" ? "%" : aType === "chemisch" ? "wt%" : ""} /></div>
                      </div>
                      <div><Label>Bemerkungen</Label><Textarea value={aRemarks} onChange={(e) => setARemarks(e.target.value)} rows={2} /></div>
                      <Button onClick={handleAddAnalysis} className="w-full">Hinzufügen</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Art</TableHead><TableHead>Charge</TableHead><TableHead>Parameter</TableHead><TableHead className="text-right">Wert</TableHead><TableHead>Einheit</TableHead><TableHead>Bemerkung</TableHead>{canManage && <TableHead />}
                </TableRow></TableHeader>
                <TableBody>
                  {analyses.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Keine Analysedaten</TableCell></TableRow>
                  ) : analyses.map((a: any) => {
                    const batchLabel = batches.find((b: any) => b.id === a.batch_id)?.batch_number;
                    return (
                      <TableRow key={a.id}>
                        <TableCell><Badge variant="outline" className="text-xs">{a.analysis_type}</Badge></TableCell>
                        <TableCell className="text-xs">{batchLabel || "–"}</TableCell>
                        <TableCell className="font-medium">{a.parameter_name}</TableCell>
                        <TableCell className="text-right font-mono">{a.value != null ? a.value : a.text_value || "–"}</TableCell>
                        <TableCell className="text-muted-foreground">{a.unit || "–"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{a.remarks || "–"}</TableCell>
                        {canManage && <TableCell><Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteAnalysis.mutate({ id: a.id, raw_material_id: id! })}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOKUMENTE */}
        <TabsContent value="dokumente">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Dokumente ({documents.length})</CardTitle>
              {canManage && (
                <div className="flex items-center gap-2">
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zertifikat">Zertifikat</SelectItem>
                      <SelectItem value="sicherheitsdatenblatt">Sicherheitsdatenblatt</SelectItem>
                      <SelectItem value="sonstiges">Sonstiges</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={docBatchId || "__none__"} onValueChange={(v) => setDocBatchId(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Charge" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Keine</SelectItem>
                      {batches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.batch_number}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <label className="cursor-pointer">
                    <input type="file" className="hidden" accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg" onChange={(e) => { if (e.target.files?.[0]) handleUploadDoc(e.target.files[0]); e.target.value = ""; }} />
                    <Button size="sm" variant="outline" className="h-8 text-xs" asChild disabled={uploading}>
                      <span><Upload className="h-3 w-3 mr-1" />{uploading ? "Lädt..." : "Hochladen"}</span>
                    </Button>
                  </label>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Datei</TableHead><TableHead>Typ</TableHead><TableHead>Charge</TableHead><TableHead>Hochgeladen</TableHead><TableHead />
                </TableRow></TableHeader>
                <TableBody>
                  {documents.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Keine Dokumente</TableCell></TableRow>
                  ) : documents.map((d: any) => {
                    const batchLabel = batches.find((b: any) => b.id === d.batch_id)?.batch_number;
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /><span className="truncate max-w-[200px]">{d.file_name}</span></TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{d.document_type}</Badge></TableCell>
                        <TableCell className="text-xs">{batchLabel || "–"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(d.uploaded_at).toLocaleDateString("de-DE")}</TableCell>
                        <TableCell><Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDownload(d)}><Download className="h-3.5 w-3.5" /></Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LAGERBEWEGUNGEN */}
        <TabsContent value="lager">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Lagerbewegungen</CardTitle>
              {canManage && (
                <Dialog open={movOpen} onOpenChange={setMovOpen}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Buchung</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Lagerbuchung</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label>Art</Label>
                        <Select value={mType} onValueChange={setMType}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="eingang">Wareneingang</SelectItem>
                            <SelectItem value="verbrauch">Verbrauch</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Menge ({mat.unit}) *</Label><Input type="number" value={mQty} onChange={(e) => setMQty(e.target.value)} /></div>
                        <div><Label>Datum</Label><Input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} /></div>
                      </div>
                      <div>
                        <Label>Charge</Label>
                        <Select value={mBatchId || "__none__"} onValueChange={(v) => setMBatchId(v === "__none__" ? "" : v)}>
                          <SelectTrigger><SelectValue placeholder="Charge wählen" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Keine</SelectItem>
                            {batches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.batch_number}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      {mType === "eingang" && (
                        <div>
                          <Label>Lieferant</Label>
                          <Select value={mSupplier || "__none__"} onValueChange={(v) => setMSupplier(v === "__none__" ? "" : v)}>
                            <SelectTrigger><SelectValue placeholder="Lieferant wählen" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Kein Lieferant</SelectItem>
                              {suppliers.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {mType === "verbrauch" && (
                        <div>
                          <Label>Projekt</Label>
                          <Select value={mProject || "__none__"} onValueChange={(v) => setMProject(v === "__none__" ? "" : v)}>
                            <SelectTrigger><SelectValue placeholder="Projekt wählen" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Kein Projekt</SelectItem>
                              {projects?.map((p: any) => (
                                <SelectItem key={p.id} value={p.project_number}>
                                  {p.project_number}{p.project_name ? ` – ${p.project_name}` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {mType === "verbrauch" && (
                        <div>
                          <Label>Versuchsnummer</Label>
                          <Input value={mExperiment} onChange={(e) => setMExperiment(e.target.value)} placeholder="z.B. V-001" />
                        </div>
                      )}
                      <div><Label>Kommentar</Label><Textarea value={mComment} onChange={(e) => setMComment(e.target.value)} rows={2} /></div>
                      <Button onClick={handleAddMovement} className="w-full">Buchen</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Datum</TableHead><TableHead>Art</TableHead><TableHead>Charge</TableHead><TableHead className="text-right">Menge</TableHead><TableHead>Referenz</TableHead><TableHead>Kommentar</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {!movements || movements.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Keine Buchungen</TableCell></TableRow>
                  ) : movements.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">{new Date(m.movement_date).toLocaleDateString("de-DE")}</TableCell>
                      <TableCell><Badge variant={m.movement_type === "eingang" ? "default" : "destructive"} className="text-xs">{m.movement_type === "eingang" ? "Eingang" : "Verbrauch"}</Badge></TableCell>
                      <TableCell className="text-xs">{m.raw_material_batches?.batch_number || "–"}</TableCell>
                      <TableCell className="text-right font-mono">{m.movement_type === "eingang" ? "+" : "−"}{m.quantity} {mat.unit}</TableCell>
                      <TableCell className="text-xs">{m.supplier || m.project_reference || "–"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{m.comment || "–"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proben">
          {id && <DerivedSamples rawMaterialId={id} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
