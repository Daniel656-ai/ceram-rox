import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { PreparationRow } from "@/lib/api/orderPreparation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Split, Lock, CheckCircle2 } from "lucide-react";

const ORIGIN_LABEL: Record<string, string> = {
  booked: "Gebucht",
  package: "Servicepaket",
  workflow: "Workflow",
};

/**
 * Integrierte Probenvorbereiter-Ansicht.
 *
 * Zeigt je Auftrag alle Dienstleistungen mit Probe/Teilprobe, Herkunft
 * (gebucht / Servicepaket / automatisch durch Workflow erzeugt), Status und
 * Startbereitschaft. Teilproben werden über die bestehende Probenverwaltung
 * erzeugt – es entsteht keine parallele Statusführung.
 */
export default function OrderPreparationTab({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<PreparationRow | null>(null);
  const [subName, setSubName] = useState("");
  const [subDesc, setSubDesc] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["order-preparation", orderId],
    queryFn: () => api.orderPreparation.overview(orderId),
  });

  const createSub = useMutation({
    mutationFn: () =>
      api.orderPreparation.createSubsample({
        parentSampleId: target!.sample_id!,
        measurementId: target!.measurement_id,
        name: subName.trim() || null,
        description: subDesc.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Teilprobe erzeugt");
      setTarget(null); setSubName(""); setSubDesc("");
      qc.invalidateQueries({ queryKey: ["order-preparation", orderId] });
      qc.invalidateQueries({ queryKey: ["order-samples"] });
    },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Split className="h-4 w-4" />Probenvorbereitung</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Dienstleistungen für diesen Auftrag.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dienstleistung</TableHead>
                <TableHead>Herkunft</TableHead>
                <TableHead>Probe / Teilprobe</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Bereit</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.measurement_id}>
                  <TableCell>
                    <div className="font-medium">{r.service_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.measurement_number}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.origin === "workflow" ? "secondary" : "outline"}>
                      {ORIGIN_LABEL[r.origin] ?? r.origin}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.sample_number ?? "—"}
                    {r.subsample_suffix && (
                      <Badge variant="outline" className="ml-2">Teilprobe {r.subsample_suffix}</Badge>
                    )}
                    {r.parent_sample_number && (
                      <div className="text-xs text-muted-foreground">aus {r.parent_sample_number}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{r.status}</TableCell>
                  <TableCell>
                    {r.is_ready
                      ? <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="h-3 w-3" />bereit</span>
                      : <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" />wartet</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.sample_id && (
                      <Button size="sm" variant="outline" onClick={() => { setTarget(r); setSubName(""); setSubDesc(""); }}>
                        Teilprobe erzeugen
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Teilprobe erzeugen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Aus Probe <strong>{target?.sample_number}</strong> für{" "}
              <strong>{target?.service_name}</strong>. Die Prüfung wird auf die Teilprobe umgehängt.
            </p>
            <div><Label>Bezeichnung (optional)</Label><Input value={subName} onChange={e => setSubName(e.target.value)} /></div>
            <div><Label>Bemerkung (optional)</Label><Input value={subDesc} onChange={e => setSubDesc(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Abbrechen</Button>
            <Button onClick={() => createSub.mutate()} disabled={createSub.isPending}>
              {createSub.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Erzeugen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
