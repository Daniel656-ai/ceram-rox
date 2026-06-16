import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useRecordContainerMovement, useContainerMovements, useContainerLocationHistory, useContainerAuditLog, useStorageLocations } from "@/hooks/useRawMaterials";
import type { ContainerMovementType } from "@/lib/api/containerMovements";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  container: any | null;
  defaultMovementType?: ContainerMovementType;
}

const MOVEMENT_LABELS: Record<ContainerMovementType, string> = {
  eingang: "Wareneingang",
  umlagerung: "Umlagerung",
  verbrauch: "Verbrauch / Entnahme",
  korrektur_plus: "Korrektur (+)",
  korrektur_minus: "Korrektur (−)",
  inventur: "Inventur",
  entsorgung: "Entsorgung",
  reservierung: "Reservierung",
  freigabe_reservierung: "Reservierung freigeben",
};

// Schema: positive Menge, max 1 Mio., bis zu 3 Nachkommastellen
const qtySchema = z.coerce.number({ invalid_type_error: "Menge muss eine Zahl sein" })
  .positive("Menge muss > 0 sein")
  .max(1_000_000, "Menge unrealistisch hoch (max 1.000.000)");

const newQtySchema = z.coerce.number({ invalid_type_error: "Ist-Bestand muss eine Zahl sein" })
  .min(0, "Bestand darf nicht negativ sein")
  .max(1_000_000, "Wert unrealistisch hoch");

const textSchema = z.string().trim().max(500, "Maximal 500 Zeichen");

function fmtLoc(l: any) {
  if (!l) return "–";
  return [l.name, l.hall, l.room, l.shelf, l.position].filter(Boolean).join(" › ");
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("de-AT", { dateStyle: "short", timeStyle: "short" });
}

export function ContainerActionsDialog({ open, onOpenChange, container, defaultMovementType }: Props) {
  const { data: locations } = useStorageLocations();
  const { data: movements } = useContainerMovements(container?.id);
  const { data: history } = useContainerLocationHistory(container?.id);
  const { data: audit } = useContainerAuditLog(container?.id);
  const record = useRecordContainerMovement();

  const [movementType, setMovementType] = useState<ContainerMovementType>(defaultMovementType ?? "verbrauch");
  const [qty, setQty] = useState("");
  const [newQty, setNewQty] = useState("");
  const [toLoc, setToLoc] = useState("");
  const [toLocNote, setToLocNote] = useState("");
  const [reference, setReference] = useState("");
  const [comment, setComment] = useState("");

  const resetForm = () => {
    setQty(""); setNewQty(""); setToLoc(""); setToLocNote(""); setReference(""); setComment("");
  };

  useEffect(() => {
    if (open && defaultMovementType) setMovementType(defaultMovementType);
    if (open) resetForm();
  }, [open, defaultMovementType, container?.id]);

  // ----- Pre-flight Validierung -----
  const validation = useMemo(() => {
    if (!container) return { blockers: [] as string[], warnings: [] as string[], preview: null as number | null };
    const current = Number(container.current_quantity || 0);
    const reserved = Number(container.reserved_quantity || 0);
    const available = Math.max(current - reserved, 0);
    const qtyNum = Number(qty || 0);
    const newQtyNum = Number(newQty || 0);

    const blockers: string[] = [];
    const warnings: string[] = [];
    let preview: number | null = null;

    // Status-basierte Sperren
    if (container.status === "entsorgt" && movementType !== "inventur") {
      blockers.push("Gebinde wurde entsorgt – nur Inventur ist möglich.");
    }
    if (container.status === "gesperrt" && !["inventur", "freigabe_reservierung", "umlagerung"].includes(movementType)) {
      blockers.push("Gebinde ist gesperrt – keine Mengenbuchung möglich. Bitte zuerst Status ändern.");
    }

    // Mengenlogik pro Bewegungsart
    switch (movementType) {
      case "verbrauch":
      case "korrektur_minus":
        preview = current - qtyNum;
        if (qtyNum > 0 && qtyNum > current) {
          blockers.push(`Bestand reicht nicht aus: angefordert ${qtyNum.toFixed(3)} ${container.unit}, vorhanden ${current.toFixed(3)} ${container.unit}.`);
        } else if (qtyNum > 0 && qtyNum > available && movementType === "verbrauch") {
          warnings.push(`Achtung: ${reserved.toFixed(3)} ${container.unit} sind reserviert – frei verfügbar wären nur ${available.toFixed(3)} ${container.unit}.`);
        }
        break;
      case "eingang":
      case "korrektur_plus":
        preview = current + qtyNum;
        if (qtyNum > 0 && preview > Number(container.initial_quantity || 0) * 1.5 && container.initial_quantity > 0) {
          warnings.push(`Neuer Bestand (${preview.toFixed(3)}) übersteigt 150 % der Ursprungsmenge (${Number(container.initial_quantity).toFixed(3)}).`);
        }
        break;
      case "reservierung":
        if (qtyNum > 0 && qtyNum > available) {
          blockers.push(`Reservierung übersteigt freien Bestand: angefordert ${qtyNum.toFixed(3)}, frei ${available.toFixed(3)} ${container.unit}.`);
        }
        break;
      case "freigabe_reservierung":
        if (qtyNum > 0 && qtyNum > reserved) {
          blockers.push(`Es sind nur ${reserved.toFixed(3)} ${container.unit} reserviert, ${qtyNum.toFixed(3)} können nicht freigegeben werden.`);
        }
        break;
      case "inventur":
        preview = newQtyNum;
        if (newQty !== "" && Math.abs(newQtyNum - current) > current * 0.5 && current > 0) {
          warnings.push(`Große Abweichung von ${(newQtyNum - current).toFixed(3)} ${container.unit} – bitte verifizieren.`);
        }
        break;
      case "umlagerung":
        if (toLoc && toLoc === container.location_id) {
          warnings.push("Ziel-Lagerort entspricht dem aktuellen Lagerort.");
        }
        break;
      case "entsorgung":
        preview = 0;
        if (current > 0) {
          warnings.push(`Restbestand von ${current.toFixed(3)} ${container.unit} wird auf 0 gesetzt.`);
        }
        break;
    }

    return { blockers, warnings, preview };
  }, [container, movementType, qty, newQty, toLoc]);

  if (!container) return null;

  const needsQty = ["eingang", "verbrauch", "korrektur_plus", "korrektur_minus", "reservierung", "freigabe_reservierung"].includes(movementType);
  const needsNewQty = movementType === "inventur";
  const needsToLoc = movementType === "umlagerung";

  const handleSubmit = async () => {
    // Schema-Validierung
    if (needsQty) {
      const r = qtySchema.safeParse(qty);
      if (!r.success) { toast.error(r.error.issues[0].message); return; }
    }
    if (needsNewQty) {
      const r = newQtySchema.safeParse(newQty);
      if (!r.success) { toast.error(r.error.issues[0].message); return; }
    }
    if (needsToLoc && !toLoc) { toast.error("Ziel-Lagerort wählen"); return; }
    const refR = textSchema.safeParse(reference);
    if (!refR.success) { toast.error(`Referenz: ${refR.error.issues[0].message}`); return; }
    const cmtR = textSchema.safeParse(comment);
    if (!cmtR.success) { toast.error(`Kommentar: ${cmtR.error.issues[0].message}`); return; }

    if (validation.blockers.length > 0) {
      toast.error("Buchung blockiert", { description: validation.blockers[0] });
      return;
    }

    try {
      await record.mutateAsync({
        container_id: container.id,
        raw_material_id: container.raw_material_id,
        movement_type: movementType,
        quantity: needsQty ? Number(qty) : null,
        new_quantity: needsNewQty ? Number(newQty || "0") : null,
        to_location_id: needsToLoc ? toLoc : null,
        to_location_note: needsToLoc ? toLocNote.trim() || null : null,
        reference: reference.trim() || null,
        comment: comment.trim() || null,
      });
      toast.success(`${MOVEMENT_LABELS[movementType]} gebucht`);
      resetForm();
    } catch (e: any) {
      // Server-seitige Fehlermeldungen freundlich übersetzen
      const msg = String(e?.message || e);
      if (msg.includes("negativ")) {
        toast.error("Bestand würde negativ – bitte Menge prüfen.");
      } else if (msg.includes("Berechtigung")) {
        toast.error("Keine Berechtigung für diese Buchung.");
      } else {
        toast.error("Buchung fehlgeschlagen", { description: msg });
      }
    }
  };

  const canSubmit = validation.blockers.length === 0 && !record.isPending &&
    (!needsQty || qty !== "") && (!needsNewQty || newQty !== "") && (!needsToLoc || !!toLoc);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Gebinde {container.container_code}
            <span className="ml-3 text-sm font-normal text-muted-foreground">
              Bestand: {Number(container.current_quantity).toFixed(3)} {container.unit}
              {Number(container.reserved_quantity) > 0 && (
                <> · reserviert {Number(container.reserved_quantity).toFixed(3)}</>
              )}
            </span>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="aktion">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="aktion">Neue Buchung</TabsTrigger>
            <TabsTrigger value="bewegungen">Bewegungen ({movements?.length || 0})</TabsTrigger>
            <TabsTrigger value="lager">Lagerort-Historie ({history?.length || 0})</TabsTrigger>
            <TabsTrigger value="audit">Audit ({audit?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="aktion" className="space-y-3 pt-3">
            <div>
              <Label>Art der Buchung</Label>
              <Select value={movementType} onValueChange={(v: any) => setMovementType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MOVEMENT_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {needsQty && (
              <div>
                <Label>Menge ({container.unit}) *</Label>
                <Input type="number" step="0.001" min="0" max="1000000" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
            )}
            {needsNewQty && (
              <div>
                <Label>Neuer Ist-Bestand ({container.unit}) *</Label>
                <Input type="number" step="0.001" min="0" max="1000000" value={newQty} onChange={(e) => setNewQty(e.target.value)} placeholder={`alt: ${Number(container.current_quantity).toFixed(3)}`} />
              </div>
            )}
            {needsToLoc && (
              <>
                <div>
                  <Label>Ziel-Lagerort *</Label>
                  <Select value={toLoc} onValueChange={setToLoc}>
                    <SelectTrigger><SelectValue placeholder="Lagerort wählen" /></SelectTrigger>
                    <SelectContent>
                      {locations?.map((l) => <SelectItem key={l.id} value={l.id}>{fmtLoc(l)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ziel-Lagerort-Notiz</Label>
                  <Input value={toLocNote} maxLength={200} onChange={(e) => setToLocNote(e.target.value)} placeholder="z.B. Stellplatz 7" />
                </div>
              </>
            )}

            {/* Validierungs-Hinweise */}
            {validation.blockers.map((b, i) => (
              <Alert key={`b${i}`} variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{b}</AlertDescription>
              </Alert>
            ))}
            {validation.warnings.map((w, i) => (
              <Alert key={`w${i}`}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{w}</AlertDescription>
              </Alert>
            ))}
            {validation.preview !== null && validation.blockers.length === 0 && (qty || newQty) && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Neuer Bestand nach Buchung: </span>
                <span className="font-mono font-semibold">{validation.preview.toFixed(3)} {container.unit}</span>
              </div>
            )}

            <div>
              <Label>Referenz</Label>
              <Input value={reference} maxLength={500} onChange={(e) => setReference(e.target.value)} placeholder="z.B. Projekt, Lieferschein, Charge" />
            </div>
            <div>
              <Label>Kommentar</Label>
              <Textarea value={comment} maxLength={500} onChange={(e) => setComment(e.target.value)} rows={2} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} className="flex-1" disabled={!canSubmit}>
                {MOVEMENT_LABELS[movementType]} buchen
              </Button>
              <Button variant="outline" type="button" onClick={resetForm} disabled={record.isPending}>
                <RotateCcw className="h-4 w-4 mr-1" />Zurücksetzen
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="bewegungen" className="pt-3">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Art</TableHead>
                <TableHead className="text-right">Menge</TableHead>
                <TableHead className="text-right">Bestand neu</TableHead>
                <TableHead>Lagerort</TableHead>
                <TableHead>Kommentar</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {!movements?.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">Keine Bewegungen</TableCell></TableRow>
                ) : movements.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(m.created_at)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{MOVEMENT_LABELS[m.movement_type as ContainerMovementType] || m.movement_type}</Badge></TableCell>
                    <TableCell className="text-right font-mono text-xs">{Number(m.quantity).toFixed(3)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{m.quantity_after !== null ? Number(m.quantity_after).toFixed(3) : "–"}</TableCell>
                    <TableCell className="text-xs">{m.movement_type === "umlagerung" ? `${fmtLoc(m.from_loc)} → ${fmtLoc(m.to_loc)}` : fmtLoc(m.from_loc)}</TableCell>
                    <TableCell className="text-xs">{[m.reference, m.comment].filter(Boolean).join(" · ") || "–"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="lager" className="pt-3">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Von</TableHead>
                <TableHead>Nach</TableHead>
                <TableHead>Notiz</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {!history?.length ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Keine Lagerortwechsel</TableCell></TableRow>
                ) : history.map((h: any) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(h.changed_at)}</TableCell>
                    <TableCell className="text-xs">{fmtLoc(h.from_loc)}{h.from_location_note ? ` (${h.from_location_note})` : ""}</TableCell>
                    <TableCell className="text-xs">{fmtLoc(h.to_loc)}{h.to_location_note ? ` (${h.to_location_note})` : ""}</TableCell>
                    <TableCell className="text-xs">{h.comment || "–"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="audit" className="pt-3">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Aktion</TableHead>
                <TableHead>Feld</TableHead>
                <TableHead>Alt</TableHead>
                <TableHead>Neu</TableHead>
                <TableHead>Kommentar</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {!audit?.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">Kein Audit-Eintrag</TableCell></TableRow>
                ) : audit.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(a.changed_at)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{a.action}</Badge></TableCell>
                    <TableCell className="text-xs">{a.field_name || "–"}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{a.old_value || "–"}</TableCell>
                    <TableCell className="text-xs font-mono">{a.new_value || "–"}</TableCell>
                    <TableCell className="text-xs">{a.comment || "–"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
