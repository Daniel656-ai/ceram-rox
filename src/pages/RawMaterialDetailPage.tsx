import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useRawMaterialDetail, useAddBatch, useDeleteBatch, useAddAnalysis, useDeleteAnalysis, useInventoryMovements, useAddMovement, useAddRawMaterialDocument, useUpdateRawMaterial, useStorageLocations, calculateStock } from "@/hooks/useRawMaterials";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Plus, Upload, Download, Trash2, FileText, Package, FlaskConical, BarChart3, Pencil } from "lucide-react";

function formatLocation(loc: any) {
  if (!loc) return "–";
  return [loc.hall, loc.room, loc.shelf, loc.position].filter(Boolean).join(" › ");
}

export default function RawMaterialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const { data: mat, isLoading } = useRawMaterialDetail(id);
  const { data: movements } = useInventoryMovements(id);
  const { data: locations } = useStorageLocations();
  const addBatch = useAddBatch();
  const deleteBatch = useDeleteBatch();
  const addAnalysis = useAddAnalysis();
  const deleteAnalysis = useDeleteAnalysis();
  const addMovement = useAddMovement();
  const addDocument = useAddRawMaterialDocument();
  const updateMaterial = useUpdateRawMaterial();

  const canManage = role === "master" || role === "auftraggeber";
  const stock = movements ? calculateStock(movements) : 0;

  // Edit material form
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSupplier, setEditSupplier] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editLocationId, setEditLocationId] = useState<string>("");

  const openEditDialog = () => {
    if (!mat) return;
    setEditName(mat.material_name);
    setEditSupplier(mat.supplier || "");
    setEditDesc(mat.description || "");
    setEditUnit(mat.unit);
    setEditLocationId(mat.default_location_id || "");
    setEditOpen(true);
  };

  const handleUpdateMaterial = async () => {
    if (!editName) { toast.error("Name ist Pflicht"); return; }
    try {
      await updateMaterial.mutateAsync({
        id: id!,
        material_name: editName,
        supplier: editSupplier || undefined,
        description: editDesc || undefined,
        unit: editUnit,
        default_location_id: editLocationId || null,
      });
      toast.success("Rohstoff aktualisiert");
      setEditOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  // Batch form
  const [batchOpen, setBatchOpen] = useState(false);
  const [bNum, setBNum] = useState("");
  const [bDate, setBDate] = useState("");
  const [bQty, setBQty] = useState("");
  const [bSupplier, setBSupplier] = useState("");
  const [bNotes, setBNotes] = useState("");

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
      await addBatch.mutateAsync({ raw_material_id: id!, batch_number: bNum, delivery_date: bDate || undefined, delivery_quantity: bQty ? Number(bQty) : undefined, supplier: bSupplier || undefined, notes: bNotes || undefined });
      toast.success("Charge angelegt");
      setBatchOpen(false); setBNum(""); setBDate(""); setBQty(""); setBSupplier(""); setBNotes("");
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
    try {
      await addMovement.mutateAsync({ raw_material_id: id!, batch_id: mBatchId || undefined, movement_type: mType, quantity: Number(mQty), movement_date: mDate || undefined, supplier: mSupplier || undefined, project_reference: mProject || undefined, comment: mComment || undefined });
      toast.success(mType === "eingang" ? "Wareneingang gebucht" : "Verbrauch gebucht");
      setMovOpen(false); setMQty(""); setMDate(""); setMBatchId(""); setMSupplier(""); setMProject(""); setMComment("");
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
    const { data, error } = await supabase.storage.from("raw-material-documents").download(doc.storage_path);
    if (error) { toast.error(error.message); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = doc.file_name; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/rohstoffe"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{mat.material_name}</h1>
          <p className="text-sm text-muted-foreground">{mat.material_number} · {mat.supplier || "Kein Lieferant"} · Lagerort: {formatLocation(mat.storage_locations)}</p>
        </div>
        {canManage && (
          <Button variant="outline" size="sm" onClick={openEditDialog}><Pencil className="h-4 w-4 mr-1" />Bearbeiten</Button>
        )}
        <Badge variant={stock <= 0 ? "destructive" : "secondary"} className="text-lg px-3 py-1">{stock.toFixed(1)} {mat.unit}</Badge>
      </div>

      {/* Edit Material Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Rohstoff bearbeiten</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name *</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
              <div><Label>Einheit</Label>
                <Select value={editUnit} onValueChange={setEditUnit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["kg", "g", "t", "Liter", "ml", "Stück"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Lieferant</Label><Input value={editSupplier} onChange={(e) => setEditSupplier(e.target.value)} /></div>
            <div>
              <Label>Lagerort</Label>
              <Select value={editLocationId} onValueChange={setEditLocationId}>
                <SelectTrigger><SelectValue placeholder="Lagerort wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Kein Lagerort</SelectItem>
                  {locations?.map((l) => <SelectItem key={l.id} value={l.id}>{formatLocation(l)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Beschreibung</Label><Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} /></div>
            <Button onClick={handleUpdateMaterial} className="w-full" disabled={updateMaterial.isPending}>Speichern</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="chargen">
        <TabsList>
          <TabsTrigger value="chargen"><Package className="h-4 w-4 mr-1" />Chargen</TabsTrigger>
          <TabsTrigger value="analysen"><FlaskConical className="h-4 w-4 mr-1" />Analysen</TabsTrigger>
          <TabsTrigger value="dokumente"><FileText className="h-4 w-4 mr-1" />Dokumente</TabsTrigger>
          <TabsTrigger value="lager"><BarChart3 className="h-4 w-4 mr-1" />Lagerbewegungen</TabsTrigger>
        </TabsList>

        {/* CHARGEN */}
        <TabsContent value="chargen">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Chargen ({batches.length})</CardTitle>
              {canManage && (
                <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Charge</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Neue Charge</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Chargennummer *</Label><Input value={bNum} onChange={(e) => setBNum(e.target.value)} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Lieferdatum</Label><Input type="date" value={bDate} onChange={(e) => setBDate(e.target.value)} /></div>
                        <div><Label>Liefermenge</Label><Input type="number" value={bQty} onChange={(e) => setBQty(e.target.value)} /></div>
                      </div>
                      <div><Label>Lieferant</Label><Input value={bSupplier} onChange={(e) => setBSupplier(e.target.value)} /></div>
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
                  <TableHead>Chargennr.</TableHead><TableHead>Lieferdatum</TableHead><TableHead>Menge</TableHead><TableHead>Lieferant</TableHead><TableHead>Bemerkungen</TableHead>{canManage && <TableHead />}
                </TableRow></TableHeader>
                <TableBody>
                  {batches.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Keine Chargen</TableCell></TableRow>
                  ) : batches.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-sm">{b.batch_number}</TableCell>
                      <TableCell>{b.delivery_date ? new Date(b.delivery_date).toLocaleDateString("de-DE") : "–"}</TableCell>
                      <TableCell>{b.delivery_quantity != null ? `${b.delivery_quantity} ${mat.unit}` : "–"}</TableCell>
                      <TableCell>{b.supplier || "–"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{b.notes || "–"}</TableCell>
                      {canManage && <TableCell><Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteBatch.mutate({ id: b.id, raw_material_id: id! })}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
                        <Select value={aBatchId} onValueChange={setABatchId}>
                          <SelectTrigger><SelectValue placeholder="Keine Charge" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Keine</SelectItem>
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
                  <Select value={docBatchId} onValueChange={setDocBatchId}>
                    <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Charge" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Keine</SelectItem>
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
                        <Select value={mBatchId} onValueChange={setMBatchId}>
                          <SelectTrigger><SelectValue placeholder="Charge wählen" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Keine</SelectItem>
                            {batches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.batch_number}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      {mType === "eingang" && <div><Label>Lieferant</Label><Input value={mSupplier} onChange={(e) => setMSupplier(e.target.value)} /></div>}
                      {mType === "verbrauch" && <div><Label>Projekt / Versuch</Label><Input value={mProject} onChange={(e) => setMProject(e.target.value)} /></div>}
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
      </Tabs>
    </div>
  );
}
