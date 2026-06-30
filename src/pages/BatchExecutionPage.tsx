import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Play, CheckCircle2, ShieldCheck, AlertTriangle, Plus, Scale, Beaker, FileWarning } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  useBatch,
  useWeighings,
  useBatchMeasurements,
  useBatchDeviations,
  useRecordWeighing,
  useRecordMeasurement,
  useRecordDeviation,
  useStartBatch,
  useCompleteBatch,
  useReleaseBatch,
  useProcessSections,
} from "@/hooks/useMixtureProcess";
import { useRawMaterials } from "@/hooks/useMixtures";
import { usePermissions } from "@/hooks/usePermissions";

const STATUS_LABEL: Record<string, string> = {
  geplant: "Geplant",
  laufend: "Läuft",
  abgeschlossen: "Abgeschlossen",
  freigegeben: "Freigegeben",
  abgebrochen: "Abgebrochen",
};

const STATUS_COLOR: Record<string, string> = {
  geplant: "secondary",
  laufend: "default",
  abgeschlossen: "outline",
  freigegeben: "default",
  abgebrochen: "destructive",
};

function deviationLight(pct: number | null) {
  if (pct === null || pct === undefined) return "bg-muted";
  const a = Math.abs(pct);
  if (a <= 2) return "bg-emerald-500";
  if (a <= 5) return "bg-amber-500";
  return "bg-red-500";
}

export default function BatchExecutionPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const { data: batch } = useBatch(batchId);
  const { data: sections = [] } = useProcessSections(batch?.recipe_version_id);
  const { data: weighings = [] } = useWeighings(batchId);
  const { data: measurements = [] } = useBatchMeasurements(batchId);
  const { data: deviations = [] } = useBatchDeviations(batchId);
  const { data: rawMaterials = [] } = useRawMaterials();

  const startBatch = useStartBatch(batchId);
  const completeBatch = useCompleteBatch(batchId);
  const releaseBatch = useReleaseBatch(batchId);
  const recordWeighing = useRecordWeighing(batchId);
  const recordMeasurement = useRecordMeasurement(batchId);
  const recordDeviation = useRecordDeviation(batchId);

  // Weighing dialog
  const [wOpen, setWOpen] = useState(false);
  const [wMaterial, setWMaterial] = useState("");
  const [wTarget, setWTarget] = useState("");
  const [wActual, setWActual] = useState("");
  const [wUnit, setWUnit] = useState("kg");
  const [wBatchNo, setWBatchNo] = useState("");
  const [wNotes, setWNotes] = useState("");

  // Measurement dialog
  const [mOpen, setMOpen] = useState(false);
  const [mSection, setMSection] = useState("");
  const [mName, setMName] = useState("");
  const [mUnit, setMUnit] = useState("");
  const [mTarget, setMTarget] = useState("");
  const [mActual, setMActual] = useState("");
  const [mComment, setMComment] = useState("");

  // Deviation dialog
  const [dOpen, setDOpen] = useState(false);
  const [dKind, setDKind] = useState<"time" | "quantity" | "additional_raw" | "process">("process");
  const [dOld, setDOld] = useState("");
  const [dNew, setDNew] = useState("");
  const [dReason, setDReason] = useState("");

  // Complete dialog
  const [cOpen, setCOpen] = useState(false);
  const [cQty, setCQty] = useState("");

  const allSteps = useMemo(
    () =>
      (sections as any[]).flatMap((s: any) =>
        (s.mixture_process_steps || []).map((st: any) => ({ ...st, section: s }))
      ),
    [sections]
  );

  if (!batch) return <div className="p-6 text-muted-foreground">Lade…</div>;

  const submitWeighing = async () => {
    if (!wMaterial || !wActual) return;
    try {
      await recordWeighing.mutateAsync({
        batch_id: batchId!,
        raw_material_id: wMaterial,
        raw_material_batch_id: wBatchNo || null,
        target_quantity: wTarget ? Number(wTarget) : null,
        actual_quantity: Number(wActual),
        unit: wUnit,
        notes: wNotes.trim() || null,
      });
      toast({ title: "Verwiegung erfasst" });
      setWMaterial(""); setWTarget(""); setWActual(""); setWBatchNo(""); setWNotes("");
      setWOpen(false);
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
  };

  const submitMeasurement = async () => {
    if (!mName || !mActual) return;
    await recordMeasurement.mutateAsync({
      batch_id: batchId!,
      section_id: mSection || null,
      parameter_name: mName,
      unit: mUnit || null,
      target_value: mTarget ? Number(mTarget) : null,
      actual_value: Number(mActual),
      comment: mComment.trim() || null,
    });
    toast({ title: "Messwert erfasst" });
    setMSection(""); setMName(""); setMUnit(""); setMTarget(""); setMActual(""); setMComment("");
    setMOpen(false);
  };

  const submitDeviation = async () => {
    if (!dReason.trim()) return;
    await recordDeviation.mutateAsync({
      batch_id: batchId!,
      kind: dKind,
      old_value: dOld.trim() || null,
      new_value: dNew.trim() || null,
      reason: dReason.trim(),
    });
    toast({ title: "Abweichung dokumentiert" });
    setDOld(""); setDNew(""); setDReason(""); setDKind("process");
    setDOpen(false);
  };

  const submitComplete = async () => {
    try {
      await completeBatch.mutateAsync(cQty ? Number(cQty) : null);
      toast({ title: "Charge abgeschlossen" });
      setCOpen(false);
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
  };

  const submitRelease = async () => {
    try {
      await releaseBatch.mutateAsync();
      toast({ title: "Charge freigegeben" });
    } catch (e: any) {
      toast({ title: "Freigabe nicht möglich", description: e.message, variant: "destructive" });
    }
  };

  const status = batch.execution_status as string;
  const canEdit = status === "geplant" || status === "laufend";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/mischungen/${batch.mixture_id}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Zurück
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground">Charge</div>
          <h1 className="text-2xl font-bold font-mono">{batch.batch_number}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Link
              to={`/mischungen/${batch.mixture_id}`}
              className="text-sm hover:underline"
            >
              {batch.mixtures?.name}
            </Link>
            <Badge variant={STATUS_COLOR[status] as any}>{STATUS_LABEL[status] || status}</Badge>
            {batch.released_at && (
              <Badge variant="default" className="bg-emerald-600">
                <ShieldCheck className="h-3 w-3 mr-1" /> Freigegeben
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-2 space-x-3">
            {batch.started_at && <span>Start: {format(new Date(batch.started_at), "Pp", { locale: de })}</span>}
            {batch.ended_at && <span>Ende: {format(new Date(batch.ended_at), "Pp", { locale: de })}</span>}
            {batch.profiles && (
              <span>Hersteller: {batch.profiles.first_name} {batch.profiles.last_name}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {status === "geplant" && (
            <Button onClick={() => startBatch.mutate()}>
              <Play className="h-4 w-4 mr-2" /> Charge starten
            </Button>
          )}
          {status === "laufend" && (
            <Button onClick={() => { setCQty(String(batch.produced_quantity ?? "")); setCOpen(true); }}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Abschließen
            </Button>
          )}
          {status === "abgeschlossen" && (
            <Button onClick={submitRelease}>
              <ShieldCheck className="h-4 w-4 mr-2" /> Freigeben (4-Augen)
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="weighings">
        <TabsList>
          <TabsTrigger value="weighings">
            <Scale className="h-4 w-4 mr-2" /> Verwiegeprotokoll ({weighings.length})
          </TabsTrigger>
          <TabsTrigger value="measurements">
            <Beaker className="h-4 w-4 mr-2" /> Messwerte ({measurements.length})
          </TabsTrigger>
          <TabsTrigger value="deviations">
            <FileWarning className="h-4 w-4 mr-2" /> Abweichungen ({deviations.length})
          </TabsTrigger>
          <TabsTrigger value="process">Prozessablauf</TabsTrigger>
        </TabsList>

        {/* Weighings */}
        <TabsContent value="weighings">
          <Card>
            <div className="p-4 flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Soll/Ist-Vergleich mit automatischer Abweichungsberechnung. Buchung erfolgt direkt aus dem Lagerbestand.
              </p>
              {canEdit && (
                <Button size="sm" onClick={() => setWOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Verwiegung erfassen
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zeit</TableHead>
                  <TableHead>Rohstoff</TableHead>
                  <TableHead>Soll</TableHead>
                  <TableHead>Ist</TableHead>
                  <TableHead>Abweichung</TableHead>
                  <TableHead>Rohstoffcharge</TableHead>
                  <TableHead>Mitarbeiter</TableHead>
                  <TableHead>Notiz</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weighings.map((w: any) => (
                  <TableRow key={w.id}>
                    <TableCell className="text-xs">{format(new Date(w.weighed_at), "HH:mm:ss")}</TableCell>
                    <TableCell>
                      {w.raw_materials?.material_name}
                      {w.raw_materials?.material_number && (
                        <span className="text-xs text-muted-foreground"> ({w.raw_materials.material_number})</span>
                      )}
                    </TableCell>
                    <TableCell>{w.target_quantity != null ? `${Number(w.target_quantity)} ${w.unit}` : "—"}</TableCell>
                    <TableCell className="font-medium">{Number(w.actual_quantity)} {w.unit}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${deviationLight(w.deviation_pct)}`} />
                        <span className="text-sm">
                          {w.deviation_abs != null ? `${Number(w.deviation_abs) > 0 ? "+" : ""}${Number(w.deviation_abs).toFixed(3)}` : "—"}
                          {w.deviation_pct != null && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({Number(w.deviation_pct) > 0 ? "+" : ""}{Number(w.deviation_pct).toFixed(2)} %)
                            </span>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{w.raw_material_batches?.batch_number || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {w.profiles ? `${w.profiles.first_name} ${w.profiles.last_name}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{w.notes || "—"}</TableCell>
                  </TableRow>
                ))}
                {weighings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Noch keine Verwiegungen erfasst
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Measurements */}
        <TabsContent value="measurements">
          <Card>
            <div className="p-4 flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Prozessmesswerte (Temperatur, pH, Feuchte, PM, Stromaufnahme, ...).
              </p>
              {canEdit && (
                <Button size="sm" onClick={() => setMOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Messwert erfassen
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zeit</TableHead>
                  <TableHead>Parameter</TableHead>
                  <TableHead>Soll</TableHead>
                  <TableHead>Ist</TableHead>
                  <TableHead>Einheit</TableHead>
                  <TableHead>Mitarbeiter</TableHead>
                  <TableHead>Kommentar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {measurements.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{format(new Date(m.measured_at), "HH:mm:ss")}</TableCell>
                    <TableCell>{m.parameter_name}</TableCell>
                    <TableCell>{m.target_value ?? "—"}</TableCell>
                    <TableCell className="font-medium">{m.actual_value}</TableCell>
                    <TableCell>{m.unit || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {m.profiles ? `${m.profiles.first_name} ${m.profiles.last_name}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.comment || "—"}</TableCell>
                  </TableRow>
                ))}
                {measurements.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Noch keine Messwerte
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Deviations */}
        <TabsContent value="deviations">
          <Card>
            <div className="p-4 flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Dokumentierte Änderungen am geplanten Prozess (Zeit, Menge, Zusatzstoffe, Prozessparameter).
              </p>
              {canEdit && (
                <Button size="sm" onClick={() => setDOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Abweichung dokumentieren
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zeit</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Alt</TableHead>
                  <TableHead>Neu</TableHead>
                  <TableHead>Begründung</TableHead>
                  <TableHead>Mitarbeiter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deviations.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs">{format(new Date(d.created_at), "Pp", { locale: de })}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{d.kind}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{d.old_value || "—"}</TableCell>
                    <TableCell className="text-sm font-medium">{d.new_value || "—"}</TableCell>
                    <TableCell className="text-sm">{d.reason}</TableCell>
                    <TableCell className="text-xs">
                      {d.profiles ? `${d.profiles.first_name} ${d.profiles.last_name}` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {deviations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Keine Abweichungen dokumentiert
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Process timeline */}
        <TabsContent value="process">
          <Card className="p-4 space-y-3">
            {(sections as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Prozessabschnitte definiert.</p>
            ) : (
              (sections as any[]).map((s: any, i: number) => (
                <div key={s.id} className="border-l-2 border-primary pl-4 py-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{i + 1}</Badge>
                    <h3 className="font-semibold">{s.name}</h3>
                    {s.planned_duration_min != null && (
                      <span className="text-xs text-muted-foreground">{s.planned_duration_min} min</span>
                    )}
                    {s.target_temperature != null && (
                      <span className="text-xs text-muted-foreground">{s.target_temperature} {s.target_unit || "°C"}</span>
                    )}
                  </div>
                  {s.description && <p className="text-sm mt-1">{s.description}</p>}
                  {(s.mixture_process_steps || []).length > 0 && (
                    <ul className="mt-2 text-sm space-y-1">
                      {(s.mixture_process_steps || []).map((st: any) => (
                        <li key={st.id} className="flex items-center gap-2">
                          {st.offset_minutes != null && (
                            <Badge variant="secondary" className="font-mono text-xs">+{st.offset_minutes}'</Badge>
                          )}
                          {st.raw_materials ? (
                            <span>
                              <strong>{st.raw_materials.material_name}</strong>{" "}
                              {st.planned_quantity != null && <span className="text-muted-foreground">{st.planned_quantity} {st.unit}</span>}
                            </span>
                          ) : (
                            <span className="italic">{st.instruction}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Weighing dialog */}
      <Dialog open={wOpen} onOpenChange={setWOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verwiegung erfassen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Schritt aus Rezeptur (optional)</Label>
              <Select onValueChange={(stepId) => {
                const step = allSteps.find((s: any) => s.id === stepId);
                if (step) {
                  setWMaterial(step.raw_material_id || "");
                  setWTarget(step.planned_quantity != null ? String(step.planned_quantity) : "");
                  setWUnit(step.unit || "kg");
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Aus Plan übernehmen…" />
                </SelectTrigger>
                <SelectContent>
                  {allSteps.filter((s: any) => s.raw_material_id).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      [{s.section.name}] {s.raw_materials?.material_name} {s.planned_quantity ?? ""} {s.unit ?? ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rohstoff *</Label>
              <Select value={wMaterial} onValueChange={setWMaterial}>
                <SelectTrigger>
                  <SelectValue placeholder="Rohstoff wählen" />
                </SelectTrigger>
                <SelectContent>
                  {(rawMaterials as any[]).map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.material_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Soll-Menge</Label>
                <Input type="number" step="0.001" value={wTarget} onChange={(e) => setWTarget(e.target.value)} />
              </div>
              <div>
                <Label>Ist-Menge *</Label>
                <Input type="number" step="0.001" value={wActual} onChange={(e) => setWActual(e.target.value)} />
              </div>
              <div>
                <Label>Einheit</Label>
                <Input value={wUnit} onChange={(e) => setWUnit(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Rohstoffcharge (optional)</Label>
              <Input value={wBatchNo} onChange={(e) => setWBatchNo(e.target.value)} placeholder="Charge-ID (UUID) — leer für FIFO" />
              <p className="text-xs text-muted-foreground mt-1">
                Falls eine spezifische Eingangscharge dokumentiert werden soll.
              </p>
            </div>
            <div>
              <Label>Notiz</Label>
              <Textarea rows={2} value={wNotes} onChange={(e) => setWNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWOpen(false)}>Abbrechen</Button>
            <Button onClick={submitWeighing} disabled={!wMaterial || !wActual}>Erfassen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Measurement dialog */}
      <Dialog open={mOpen} onOpenChange={setMOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Messwert erfassen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Prozessabschnitt</Label>
              <Select value={mSection} onValueChange={setMSection}>
                <SelectTrigger>
                  <SelectValue placeholder="(beliebig)" />
                </SelectTrigger>
                <SelectContent>
                  {(sections as any[]).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Parameter *</Label>
              <Input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="Temperatur, pH, Feuchte, …" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Sollwert</Label>
                <Input type="number" step="0.01" value={mTarget} onChange={(e) => setMTarget(e.target.value)} />
              </div>
              <div>
                <Label>Istwert *</Label>
                <Input type="number" step="0.01" value={mActual} onChange={(e) => setMActual(e.target.value)} />
              </div>
              <div>
                <Label>Einheit</Label>
                <Input value={mUnit} onChange={(e) => setMUnit(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Kommentar</Label>
              <Textarea rows={2} value={mComment} onChange={(e) => setMComment(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMOpen(false)}>Abbrechen</Button>
            <Button onClick={submitMeasurement} disabled={!mName || !mActual}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deviation dialog */}
      <Dialog open={dOpen} onOpenChange={setDOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prozessabweichung dokumentieren</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Typ *</Label>
              <Select value={dKind} onValueChange={(v: any) => setDKind(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">Zeitanpassung</SelectItem>
                  <SelectItem value="quantity">Mengenanpassung</SelectItem>
                  <SelectItem value="additional_raw">Zusätzlicher Rohstoff</SelectItem>
                  <SelectItem value="process">Prozessparameter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Alter Wert</Label>
                <Input value={dOld} onChange={(e) => setDOld(e.target.value)} />
              </div>
              <div>
                <Label>Neuer Wert</Label>
                <Input value={dNew} onChange={(e) => setDNew(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Begründung *</Label>
              <Textarea rows={3} value={dReason} onChange={(e) => setDReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDOpen(false)}>Abbrechen</Button>
            <Button onClick={submitDeviation} disabled={!dReason.trim()}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete dialog */}
      <Dialog open={cOpen} onOpenChange={setCOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Charge abschließen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Nach dem Abschluss wird die hergestellte Menge im Knetungsbestand verbucht. Eine Freigabe ist erst durch eine zweite Person möglich (4-Augen-Prinzip).
            </p>
            <div>
              <Label>Hergestellte Menge ({batch.unit})</Label>
              <Input type="number" step="0.001" value={cQty} onChange={(e) => setCQty(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCOpen(false)}>Abbrechen</Button>
            <Button onClick={submitComplete}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Abschließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
