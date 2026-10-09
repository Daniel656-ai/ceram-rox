import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useReassignMeasurement } from "@/hooks/useMeasurements";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/** Übersetzt Serverfehler von reassign_measurement in verständliche Meldungen. */
export function reassignErrorText(msg: string): string {
  if (msg.includes("reason required")) return "Bitte einen Grund angeben.";
  if (msg.includes("already completed")) return "Abgeschlossene Aufgaben können nicht neu zugewiesen werden.";
  if (msg.includes("target not qualified")) return "Die gewählte Person ist für diese Dienstleistung nicht qualifiziert.";
  if (msg.includes("not permitted")) return "Keine Berechtigung, diese Zuweisung zu ändern.";
  if (msg.includes("not assigned")) return "Die Aufgabe ist derzeit niemandem zugewiesen.";
  if (msg.includes("already assigned to this user")) return "Die Aufgabe ist dieser Person bereits zugewiesen.";
  return msg || "Zuweisung konnte nicht geändert werden.";
}

export default function ReassignMeasurementDialog({
  open, onOpenChange, measurementId, serviceId, currentAssignee, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  measurementId: string;
  serviceId: string;
  currentAssignee: string | null;
  onDone?: () => void;
}) {
  const [target, setTarget] = useState("__none__");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"assign" | "unassign">("assign");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const reassign = useReassignMeasurement();
  const { data: candidates = [] } = useQuery({
    queryKey: ["qualified-users", serviceId],
    queryFn: () => api.measurements.listQualifiedUsers(serviceId),
    enabled: open && !!serviceId,
  });
  const options = candidates.filter((c) => c.user_id !== currentAssignee);

  const submit = async () => {
    const unassign = mode === "unassign";
    try {
      await reassign.mutateAsync({ id: measurementId, newUserId: unassign ? null : target, reason: reason.trim() });
      toast.success(unassign ? "Zuweisung entfernt" : "Zuweisung geändert");
      setTarget("__none__");
      setReason("");
      setMode("assign");
      setConfirmOpen(false);
      onOpenChange(false);
      onDone?.();
    } catch (err: any) {
      toast.error(reassignErrorText(String(err?.message || "")));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !reassign.isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Zuweisung ändern / Vertretung</DialogTitle>
          <DialogDescription>
            Alle bisherigen Eingaben und Zwischenstände bleiben erhalten. Der bisherige Bearbeiter kann danach
            nicht mehr speichern. Die Änderung wird mit Grund protokolliert.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={mode === "assign" ? "default" : "outline"} onClick={() => setMode("assign")}>
              Einer Person zuweisen
            </Button>
            <Button type="button" size="sm" variant={mode === "unassign" ? "destructive" : "outline"}
              onClick={() => setMode("unassign")} disabled={!currentAssignee}>
              Zuweisung löschen
            </Button>
          </div>
          {mode === "unassign" ? (
            <p className="text-sm text-muted-foreground">
              Entfernt nur die Personenzuweisung. Aufgabe, Status, Messwerte und Zwischenstände bleiben erhalten;
              die Aufgabe ist danach wieder frei.
            </p>
          ) : (
          <div className="space-y-1">
            <Label>Neuer Bearbeiter (qualifiziert)</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue placeholder="Person wählen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" disabled>Person wählen</SelectItem>
                {options.map((c) => (
                  <SelectItem key={c.user_id} value={c.user_id}>
                    {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Ohne Namen"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {open && options.length === 0 && (
              <p className="text-xs text-muted-foreground">Keine weitere qualifizierte Person laut Kompetenzmatrix.</p>
            )}
          </div>
          )}
          <div className="space-y-1">
            <Label>Grund (Pflicht)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="z. B. Urlaubsvertretung" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={reassign.isPending}>Abbrechen</Button>
          {mode === "unassign" ? (
            <Button variant="destructive" onClick={() => setConfirmOpen(true)} disabled={reassign.isPending || !currentAssignee || !reason.trim()}>
              Zuweisung löschen
            </Button>
          ) : (
            <Button onClick={submit} disabled={reassign.isPending || target === "__none__" || !reason.trim()}>
              Zuweisung ändern
            </Button>
          )}
        </DialogFooter>
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Zuweisung wirklich löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Nur die Personenzuweisung wird entfernt. Die Messaufgabe und alle Daten bleiben erhalten.
                Der Vorgang wird mit Grund im Auftragsverlauf protokolliert.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={reassign.isPending}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); submit(); }} disabled={reassign.isPending}>
                Zuweisung löschen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
