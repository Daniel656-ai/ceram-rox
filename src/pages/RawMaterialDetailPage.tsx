import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useRawMaterialDetail, useRawMaterials, useAddBatch, useDeleteBatch, useUpdateBatch, useAddAnalysis, useDeleteAnalysis, useInventoryMovements, useAddMovement, useBookContainerConsumption, useAddRawMaterialDocument, useUpdateRawMaterial, useDeleteRawMaterial, useStorageLocations, calculateStock, useContainers, useAddContainer, useUpdateContainer, useDeleteContainer } from "@/hooks/useRawMaterials";
import { useUsers } from "@/hooks/useUsers";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
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
import { PsaSymbolSelector } from "@/components/PsaSymbolSelector";
import { PsaSymbolList } from "@/components/PsaSymbolList";
import { normalizeHazardClasses, type HazardClassKey } from "@/lib/hazardClasses";
import { DerivedSamples } from "@/components/DerivedSamples";
import { ContainerActionsDialog } from "@/components/ContainerActionsDialog";
import { PrintLabelDialog } from "@/components/labels/PrintLabelDialog";
import { History as HistoryIcon, Tag } from "lucide-react";





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
  const { data: allUsers } = useUsers();

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
  const bookConsumption = useBookContainerConsumption();
  const addDocument = useAddRawMaterialDocument();
  const updateMaterial = useUpdateRawMaterial();
  const deleteMaterial = useDeleteRawMaterial();
  const navigate = useNavigate();

  const { hasPermission } = usePermissions();
  const canManage = role === "master" || hasPermission("raw_materials.manage");
  const canManageBatches = role === "master" || hasPermission("raw_materials.batches.manage");
  const stock = movements ? calculateStock(movements) : 0;

  // Edit material form
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNumber, setEditNumber] = useState("");
  const [editOtherDesignation, setEditOtherDesignation] = useState("");
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
  const [editPsaSymbols, setEditPsaSymbols] = useState<string[]>([]);
  const [editResponsibleUserId, setEditResponsibleUserId] = useState<string>("");



  const openEditDialog = () => {
    if (!mat) return;
    setEditName(mat.material_name);
    setEditNumber(mat.material_number || "");
    setEditOtherDesignation((mat as any).other_designation || "");
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
    setEditPsaSymbols(Array.isArray((mat as any).psa_symbols) ? (mat as any).psa_symbols : []);
    setEditResponsibleUserId((mat as any).responsible_user_id || "");
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
        other_designation: editOtherDesignation.trim() || null,
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
        psa_symbols: editPsaSymbols,
        responsible_user_id: editResponsibleUserId || null,
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


  // Batch form (kombiniert mit Gebinde + automatischem Wareneingang)
  const [batchOpen, setBatchOpen] = useState(false);
  const [bNum, setBNum] = useState("");                       // LOT-Nummer
  const [bDate, setBDate] = useState("");                     // Lieferdatum
  const [bQty, setBQty] = useState("");                       // Liefermenge
  const [bSupplier, setBSupplier] = useState("");
  const [bNotes, setBNotes] = useState("");
  const [bManufacturerBatch, setBManufacturerBatch] = useState(""); // BigBag Nr.
  const [bGoodsReceiptDate, setBGoodsReceiptDate] = useState("");
  const [bMoisture, setBMoisture] = useState("");                   // Feuchte %
  const [bPh, setBPh] = useState("");                               // pH-Wert
  // Gebinde-Felder
  const [bContainerKind, setBContainerKind] = useState<"fass" | "kanister" | "sack" | "big_bag" | "ibc" | "tank" | "flasche" | "sonstige">("big_bag");
  const [bContainerCode, setBContainerCode] = useState("");


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
  const [labelContainer, setLabelContainer] = useState<any | null>(null);


  const openContainerDialog = (existing?: any) => {
    if (existing && existing.id) {
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
      // New container — optionally prefill from a partial (e.g. batch_id)
      const pre = existing || {};
      setCEditId(null);
      setCCode(""); setCBarcode("");
      setCBatchId(pre.batch_id || "");
      setCKind(pre.kind || "fass");
      setCInitial(""); setCCurrent("");
      setCUnit(pre.unit || mat?.unit || "kg");
      setCStatus(pre.status || "verfuegbar");
      setCLocationId(pre.location_id || mat?.default_location_id || "");
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
  const [mContainerId, setMContainerId] = useState("");
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
    if (!bNum) { toast.error("LOT-Nummer ist Pflicht"); return; }
    const qty = bQty ? Number(bQty) : 0;
    if (!qty || qty <= 0) { toast.error("Liefermenge muss > 0 sein"); return; }
    const moisture = bMoisture.trim() ? Number(bMoisture.replace(",", ".")) : null;
    const ph = bPh.trim() ? Number(bPh.replace(",", ".")) : null;
    if (moisture != null && (isNaN(moisture) || moisture < 0 || moisture > 100)) { toast.error("Feuchte muss zwischen 0 und 100 % liegen"); return; }
    if (ph != null && (isNaN(ph) || ph < 0 || ph > 14)) { toast.error("pH-Wert muss zwischen 0 und 14 liegen"); return; }
    try {
      // 1) Charge anlegen
      const newBatch: any = await addBatch.mutateAsync({
        raw_material_id: id!,
        batch_number: bNum,
        delivery_date: bDate || undefined,
        delivery_quantity: qty,
        supplier: bSupplier || undefined,
        notes: bNotes || undefined,
        manufacturer_batch: bManufacturerBatch.trim() || null,
        goods_receipt_date: bGoodsReceiptDate || bDate || null,
        moisture_percent: moisture,
        ph_value: ph,
      });

      // 2) Gebinde automatisch anlegen
      await addContainer.mutateAsync({
        raw_material_id: id!,
        batch_id: newBatch?.id || null,
        container_code: bContainerCode.trim() || null,
        kind: bContainerKind,
        initial_quantity: qty,
        current_quantity: qty,
        unit: mat.unit,
        status: "verfuegbar",
        location_id: mat.default_location_id || null,
      });

      // 3) Wareneingang automatisch buchen
      await addMovement.mutateAsync({
        raw_material_id: id!,
        batch_id: newBatch?.id || undefined,
        movement_type: "eingang",
        quantity: qty,
        movement_date: bGoodsReceiptDate || bDate || undefined,
        supplier: bSupplier || undefined,
        comment: `Automatischer Wareneingang Charge ${bNum}`,
      });

      toast.success("Charge & Gebinde angelegt, Wareneingang verbucht");
      setBatchOpen(false);
      setBNum(""); setBDate(""); setBQty(""); setBSupplier(""); setBNotes("");
      setBManufacturerBatch(""); setBGoodsReceiptDate("");
      setBMoisture(""); setBPh("");
      setBContainerKind("big_bag"); setBContainerCode("");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleBatchQualityEdit = async (batch: any, field: "moisture_percent" | "ph_value", raw: string) => {
    const trimmed = raw.trim();
    let val: number | null = null;
    if (trimmed !== "") {
      val = Number(trimmed.replace(",", "."));
      if (isNaN(val)) { toast.error("Ungültiger Zahlenwert"); return; }
      if (field === "moisture_percent" && (val < 0 || val > 100)) { toast.error("Feuchte 0–100 %"); return; }
      if (field === "ph_value" && (val < 0 || val > 14)) { toast.error("pH 0–14"); return; }
    }
    if ((batch[field] ?? null) === val) return;
    try {
      await updateBatch.mutateAsync({ id: batch.id, raw_material_id: id!, [field]: val } as any);
      toast.success("Aktualisiert");
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
    const qty = Number(mQty);
    if (!mQty || qty <= 0) { toast.error("Menge muss > 0 sein"); return; }
    const selectedProject = (projects || []).find((p: any) => p.id === mProject);
    const projectRef = [selectedProject?.project_number, mExperiment].filter(Boolean).join(" / ") || undefined;
    try {
      if (mType === "verbrauch") {
        if (!mContainerId) { toast.error("Bitte LOT-Nummer und Gebinde auswählen"); return; }
        const cont = (containers || []).find((c: any) => c.id === mContainerId);
        if (!cont) { toast.error("Gebinde nicht gefunden"); return; }
        if (Number(cont.current_quantity) <= 0) {
          toast.error(`Bestand des Gebindes ${cont.container_code} ist 0 – kein Verbrauch möglich`);
          return;
        }
        if (qty > Number(cont.current_quantity)) {
          toast.error(`Verbrauchsmenge (${qty} ${mat.unit}) überschreitet den Bestand (${cont.current_quantity} ${mat.unit}) des Gebindes ${cont.container_code}`);
          return;
        }
        await bookConsumption.mutateAsync({
          container_id: mContainerId,
          raw_material_id: id!,
          quantity: qty,
          movement_date: mDate || undefined,
          project_reference: projectRef,
          comment: mComment || undefined,
          project_id: mProject || undefined,
        });
        toast.success(
          `Verbrauch gebucht – neuer Bestand: ${Number(cont.current_quantity) - qty} ${mat.unit}` +
          (selectedProject ? ` · Projekt ${selectedProject.project_number} aktualisiert` : "")
        );
      } else {
        await addMovement.mutateAsync({ raw_material_id: id!, batch_id: mBatchId || undefined, movement_type: mType, quantity: qty, movement_date: mDate || undefined, supplier: mSupplier || undefined, project_reference: projectRef, comment: mComment || undefined });
        toast.success("Wareneingang gebucht");
      }
      setMovOpen(false); setMQty(""); setMDate(""); setMBatchId(""); setMContainerId(""); setMSupplier(""); setMProject(""); setMExperiment(""); setMComment("");
    } catch (e: any) {
      console.error("Lagerbuchung fehlgeschlagen", e);
      toast.error(e?.message || "Lagerbuchung fehlgeschlagen");
    }
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
          <h1 className="text-2xl font-bold flex items-center gap-3 flex-wrap">
            <span>{mat.material_name}</span>
            <GhsPictogramList hazardClasses={(mat as any).hazard_categories} size="md" />
            <PsaSymbolList psaSymbols={(mat as any).psa_symbols} size="md" />
          </h1>
          <p className="text-sm text-muted-foreground">{mat.material_number || "—"}{(mat as any).other_designation ? ` · ${(mat as any).other_designation}` : ""} · {mat.supplier || "Kein Lieferant"} · Lagerort: {formatLocation(mat.storage_locations)} · Preis: {(mat as any).price_per_kg || 0} €/kg{(mat as any).cas_number ? ` · CAS: ${(mat as any).cas_number}` : ""}{(mat as any).mrs_number ? ` · MRS: ${(mat as any).mrs_number}` : ""}{(mat as any).eg_number ? ` · EG: ${(mat as any).eg_number}` : ""}{(mat as any).manufacturer ? ` · Hersteller: ${(mat as any).manufacturer}` : ""}</p>
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
            <PsaSymbolList psaSymbols={(mat as any).psa_symbols} size="md" />
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
              <div><Label>RK-Code</Label><Input value={editNumber} onChange={(e) => setEditNumber(e.target.value)} placeholder={t("raw_materials:material_number_placeholder")} /></div>
            </div>
            <div>
              <Label>Sonstige Bezeichnung</Label>
              <Input value={editOtherDesignation} onChange={(e) => setEditOtherDesignation(e.target.value)} placeholder="Genauere Beschreibung des Rohstoffs" />
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
            <div><Label>Bemerkung</Label><Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} /></div>
            <div>
              <Label>Verantwortlicher</Label>
              <Select value={editResponsibleUserId || "__none__"} onValueChange={(v) => setEditResponsibleUserId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Verantwortlichen wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Kein Verantwortlicher</SelectItem>
                  {allUsers?.filter((u: any) => u.is_active !== false).map((u: any) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || u.user_id}{u.short_code ? ` (${u.short_code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <HazardClassSelector
              value={editHazardCats}
              onChange={setEditHazardCats}
              label="GHS-Gefahrensymbole"
              idPrefix="edit-haz"
            />
            <PsaSymbolSelector
              value={editPsaSymbols}
              onChange={setEditPsaSymbols}
              label="PSA-Schutzausrüstung"
              idPrefix="edit-psa"
            />

            <Button onClick={handleUpdateMaterial} className="w-full" disabled={updateMaterial.isPending}>Speichern</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="chargen">
        <TabsList>
          <TabsTrigger value="chargen"><Package className="h-4 w-4 mr-1" />LOT-Nummern</TabsTrigger>
          <TabsTrigger value="gebinde"><ContainerIcon className="h-4 w-4 mr-1" />Gebinde</TabsTrigger>
          <TabsTrigger value="analysen"><FlaskConical className="h-4 w-4 mr-1" />Analysen</TabsTrigger>
          <TabsTrigger value="dokumente"><FileText className="h-4 w-4 mr-1" />Dokumente</TabsTrigger>
          <TabsTrigger value="lager"><BarChart3 className="h-4 w-4 mr-1" />Lagerbewegungen</TabsTrigger>
          <TabsTrigger value="proben"><GitBranch className="h-4 w-4 mr-1" />Proben</TabsTrigger>
        </TabsList>

        {/* LOT-NUMMERN */}
        <TabsContent value="chargen">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">LOT-Nummern ({batches.length})</CardTitle>
              {canManageBatches && (
                <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />LOT-Nummer</Button></DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Neue LOT-Nummer & Gebinde</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>LOT-Nummer *</Label><Input value={bNum} onChange={(e) => setBNum(e.target.value)} /></div>
                        <div><Label>BigBag Nr.</Label><Input value={bManufacturerBatch} onChange={(e) => setBManufacturerBatch(e.target.value)} placeholder="z.B. BB-2024-A12" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Lieferdatum</Label><Input type="date" value={bDate} onChange={(e) => setBDate(e.target.value)} /></div>
                        <div><Label>Wareneingangsdatum</Label><Input type="date" value={bGoodsReceiptDate} onChange={(e) => setBGoodsReceiptDate(e.target.value)} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Liefermenge ({mat.unit}) *</Label><Input type="number" step="0.001" value={bQty} onChange={(e) => setBQty(e.target.value)} /></div>
                        <div><Label>Lieferant</Label><Input value={bSupplier} onChange={(e) => setBSupplier(e.target.value)} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Gebinde-Art *</Label>
                          <Select value={bContainerKind} onValueChange={(v: any) => setBContainerKind(v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fass">Fass</SelectItem>
                              <SelectItem value="kanister">Kanister</SelectItem>
                              <SelectItem value="sack">Sack</SelectItem>
                              <SelectItem value="big_bag">Big Bag</SelectItem>
                              <SelectItem value="ibc">IBC</SelectItem>
                              <SelectItem value="tank">Tank</SelectItem>
                              <SelectItem value="flasche">Flasche</SelectItem>
                              <SelectItem value="kiste">Kiste</SelectItem>
                              <SelectItem value="sonstige">Sonstige</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Gebinde-ID</Label>
                          <Input value={bContainerCode} onChange={(e) => setBContainerCode(e.target.value)} placeholder="Auto, falls leer" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Feuchte (%)</Label>
                          <Input type="number" step="0.1" min="0" max="100" value={bMoisture} onChange={(e) => setBMoisture(e.target.value)} placeholder="z. B. 12.5" />
                        </div>
                        <div>
                          <Label>pH-Wert</Label>
                          <Input type="number" step="0.1" min="0" max="14" value={bPh} onChange={(e) => setBPh(e.target.value)} placeholder="0.0 – 14.0" />
                        </div>
                      </div>
                      <div><Label>Bemerkungen</Label><Textarea value={bNotes} onChange={(e) => setBNotes(e.target.value)} rows={2} /></div>
                      <p className="text-xs text-muted-foreground">Die Liefermenge wird automatisch als Wareneingang verbucht und ein erstes Gebinde angelegt. Weitere Gebinde zur selben LOT können später unter „Gebinde" hinzugefügt werden.</p>
                      <Button onClick={handleAddBatch} className="w-full" disabled={addBatch.isPending || addContainer.isPending || addMovement.isPending}>Anlegen</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>LOT-Nummer</TableHead>
                  <TableHead>BigBag Nr.</TableHead>
                  <TableHead>Wareneingang</TableHead>
                  <TableHead>Liefermenge</TableHead>
                  <TableHead>Lieferant</TableHead>
                  <TableHead>Feuchte (%)</TableHead>
                  <TableHead>pH-Wert</TableHead>
                  <TableHead>Gebinde</TableHead>
                  {canManage && <TableHead />}
                </TableRow></TableHeader>
                <TableBody>
                  {batches.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Keine Chargen</TableCell></TableRow>
                  ) : batches.map((b: any) => {
                    const batchContainers = (containers || []).filter((c: any) => c.batch_id === b.id);
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-sm">{b.batch_number}</TableCell>
                        <TableCell className="font-mono text-xs">{b.manufacturer_batch || "–"}</TableCell>
                        <TableCell className="text-xs">{b.goods_receipt_date ? new Date(b.goods_receipt_date).toLocaleDateString("de-DE") : (b.delivery_date ? new Date(b.delivery_date).toLocaleDateString("de-DE") : "–")}</TableCell>
                        <TableCell>{b.delivery_quantity != null ? `${b.delivery_quantity} ${mat.unit}` : "–"}</TableCell>
                        <TableCell>{b.supplier || "–"}</TableCell>
                        <TableCell>
                          {canManage ? (
                            <Input
                              defaultValue={b.moisture_percent ?? ""}
                              type="number" step="0.1" min="0" max="100"
                              className="h-7 w-20 text-xs"
                              onBlur={(e) => handleBatchQualityEdit(b, "moisture_percent", e.target.value)}
                              placeholder="–"
                            />
                          ) : (b.moisture_percent != null ? `${b.moisture_percent} %` : "–")}
                        </TableCell>
                        <TableCell>
                          {canManage ? (
                            <Input
                              defaultValue={b.ph_value ?? ""}
                              type="number" step="0.1" min="0" max="14"
                              className="h-7 w-20 text-xs"
                              onBlur={(e) => handleBatchQualityEdit(b, "ph_value", e.target.value)}
                              placeholder="–"
                            />
                          ) : (b.ph_value != null ? b.ph_value : "–")}
                        </TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{batchContainers.length}</Badge></TableCell>
                        {canManage && (
                          <TableCell className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteBatch.mutate({ id: b.id, raw_material_id: id! })}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </TableCell>
                        )}
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
                  <TableHead>LOT-Nummer</TableHead>
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
                    const kindLabel: Record<string, string> = { fass: "Fass", kanister: "Kanister", sack: "Sack", big_bag: "Big Bag", ibc: "IBC", tank: "Tank", flasche: "Flasche", kiste: "Kiste", sonstige: "Sonstige" };
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
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Etikett drucken" onClick={() => setLabelContainer(c)}><Tag className="h-3.5 w-3.5" /></Button>

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
                  <Label>LOT-Nummer</Label>
                  <Select value={cBatchId || "__none__"} onValueChange={(v) => setCBatchId(v === "__none__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="LOT-Nummer wählen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Keine LOT-Nummer</SelectItem>
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
                        <SelectItem value="kiste">Kiste</SelectItem>
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

          {labelContainer && (
            <PrintLabelDialog
              open={!!labelContainer}
              onOpenChange={(o) => !o && setLabelContainer(null)}
              container={labelContainer}
              material={mat}
              batch={labelContainer.raw_material_batches}
              location={labelContainer.storage_locations}
            />
          )}

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
                        <Label>LOT-Nummer (optional)</Label>
                        <Select value={aBatchId || "__none__"} onValueChange={(v) => setABatchId(v === "__none__" ? "" : v)}>
                          <SelectTrigger><SelectValue placeholder="Keine LOT-Nummer" /></SelectTrigger>
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
                  <TableHead>Art</TableHead><TableHead>LOT-Nummer</TableHead><TableHead>Parameter</TableHead><TableHead className="text-right">Wert</TableHead><TableHead>Einheit</TableHead><TableHead>Bemerkung</TableHead>{canManage && <TableHead />}
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
                    <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="LOT-Nummer" /></SelectTrigger>
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
                  <TableHead>Datei</TableHead><TableHead>Typ</TableHead><TableHead>LOT-Nummer</TableHead><TableHead>Hochgeladen</TableHead><TableHead />
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
                        <Label>LOT-Nummer{mType === "verbrauch" ? " *" : ""}</Label>
                        {(() => {
                          const isAvailableContainer = (c: any) =>
                            Number(c.current_quantity) > 0 &&
                            !["leer", "entsorgt", "gesperrt"].includes(c.status);
                          const selectableBatches = mType === "verbrauch"
                            ? batches.filter((b: any) =>
                                (containers || []).some((c: any) => c.batch_id === b.id && isAvailableContainer(c)))
                            : batches;
                          return (
                            <Select value={mBatchId || "__none__"} onValueChange={(v) => { setMBatchId(v === "__none__" ? "" : v); setMContainerId(""); }}>
                              <SelectTrigger><SelectValue placeholder={mType === "verbrauch" && selectableBatches.length === 0 ? "Keine LOT mit verfügbarem Gebinde" : "LOT-Nummer wählen"} /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Keine</SelectItem>
                                {selectableBatches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.batch_number}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          );
                        })()}
                      </div>
                      {mType === "verbrauch" && (() => {
                        const isAvailableContainer = (c: any) =>
                          Number(c.current_quantity) > 0 &&
                          !["leer", "entsorgt", "gesperrt"].includes(c.status);
                        const lotContainers = (containers || []).filter((c: any) =>
                          (mBatchId ? c.batch_id === mBatchId : true) && isAvailableContainer(c));
                        const selectedContainer = lotContainers.find((c: any) => c.id === mContainerId);
                        const current = selectedContainer ? Number(selectedContainer.current_quantity) : 0;
                        const qtyNum = Number(mQty) || 0;
                        const remaining = current - qtyNum;
                        const overdraw = selectedContainer && qtyNum > 0 && qtyNum > current;
                        const empty = selectedContainer && current <= 0;
                        return (
                          <>
                            <div>
                              <Label>Gebinde *</Label>
                              <Select value={mContainerId || "__none__"} onValueChange={(v) => setMContainerId(v === "__none__" ? "" : v)} disabled={lotContainers.length === 0}>
                                <SelectTrigger><SelectValue placeholder={lotContainers.length === 0 ? "Keine verfügbaren Gebinde" : "Gebinde wählen"} /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Bitte wählen</SelectItem>
                                  {lotContainers.map((c: any) => (
                                    <SelectItem key={c.id} value={c.id}>
                                      {c.container_code} – Bestand: {Number(c.current_quantity)} {c.unit}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {selectedContainer && (
                              <Alert variant={overdraw || empty ? "destructive" : "default"}>
                                <AlertDescription className="text-xs space-y-1">
                                  <div>Aktueller Bestand: <span className="font-mono font-medium">{current} {selectedContainer.unit}</span></div>
                                  {qtyNum > 0 && !overdraw && !empty && (
                                    <div>Restbestand nach Buchung: <span className="font-mono font-medium">{remaining} {selectedContainer.unit}</span></div>
                                  )}
                                  {empty && <div className="font-medium">Bestand des Gebindes ist 0 – kein Verbrauch möglich.</div>}
                                  {overdraw && <div className="font-medium">Verbrauchsmenge überschreitet den verfügbaren Bestand!</div>}
                                </AlertDescription>
                              </Alert>
                            )}
                          </>
                        );
                      })()}
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
                                <SelectItem key={p.id} value={p.id}>
                                  {p.project_number}{p.project_name ? ` – ${p.project_name}` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">Bei Auswahl wird der Verbrauch automatisch in den Projektkosten verbucht.</p>
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
                  <TableHead>Datum</TableHead><TableHead>Art</TableHead><TableHead>LOT-Nummer</TableHead><TableHead className="text-right">Menge</TableHead><TableHead>Referenz</TableHead><TableHead>Kommentar</TableHead>
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
