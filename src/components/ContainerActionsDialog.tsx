import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
  useEffect(() => {
    if (open && defaultMovementType) setMovementType(defaultMovementType);
  }, [open, defaultMovementType, container?.id]);
  const [qty, setQty] = useState("");
  const [newQty, setNewQty] = useState("");
  const [toLoc, setToLoc] = useState("");
  const [toLocNote, setToLocNote] = useState("");
  const [reference, setReference] = useState("");
  const [comment, setComment] = useState("");

  if (!container) return null;

  const needsQty = ["eingang", "verbrauch", "korrektur_plus", "korrektur_minus", "reservierung", "freigabe_reservierung"].includes(movementType);
  const needsNewQty = movementType === "inventur";
  const needsToLoc = movementType === "umlagerung";

  const handleSubmit = async () => {
    if (needsQty && (!qty || Number(qty) <= 0)) {
      toast.error("Menge muss > 0 sein"); return;
    }
    if (needsToLoc && !toLoc) {
      toast.error("Ziel-Lagerort wählen"); return;
    }
    try {
      await record.mutateAsync({
        container_id: container.id,
        raw_material_id: container.raw_material_id,
        movement_type: movementType,
        quantity: needsQty ? Number(qty) : null,
        new_quantity: needsNewQty ? Number(newQty || "0") : null,
        to_location_id: needsToLoc ? toLoc : null,
        to_location_note: needsToLoc ? toLocNote || null : null,
        reference: reference.trim() || null,
        comment: comment.trim() || null,
      });
      toast.success(`${MOVEMENT_LABELS[movementType]} gebucht`);
      setQty(""); setNewQty(""); setToLoc(""); setToLocNote(""); setReference(""); setComment("");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Gebinde {container.container_code}
            <span className="ml-3 text-sm font-normal text-muted-foreground">
              Bestand: {Number(container.current_quantity).toFixed(3)} {container.unit}
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
                <Input type="number" step="0.001" value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
            )}
            {needsNewQty && (
              <div>
                <Label>Neuer Ist-Bestand ({container.unit}) *</Label>
                <Input type="number" step="0.001" value={newQty} onChange={(e) => setNewQty(e.target.value)} placeholder={`alt: ${Number(container.current_quantity).toFixed(3)}`} />
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
                  <Input value={toLocNote} onChange={(e) => setToLocNote(e.target.value)} placeholder="z.B. Stellplatz 7" />
                </div>
              </>
            )}
            <div>
              <Label>Referenz</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="z.B. Projekt, Lieferschein, Charge" />
            </div>
            <div>
              <Label>Kommentar</Label>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
            </div>
            <Button onClick={handleSubmit} className="w-full" disabled={record.isPending}>
              {MOVEMENT_LABELS[movementType]} buchen
            </Button>
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
