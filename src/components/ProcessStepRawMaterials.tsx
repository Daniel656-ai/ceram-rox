import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Trash2, Plus, Package, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatQuantity } from "@/lib/formatQuantity";

interface Props {
  stepId: string;
}

/**
 * Verwaltet die Zuordnung von Rohstoffen aus der bestehenden Rohstoffverwaltung
 * zu einem Prozessschritt (mit Sollmenge, Einheit, Toleranz, Bemerkung).
 * Zeigt zusätzlich eine Live-Verfügbarkeitsprüfung auf Basis der Gebinde/LOTs.
 */
export function ProcessStepRawMaterials({ stepId }: Props) {
  const qc = useQueryClient();
  const [selectedRm, setSelectedRm] = useState<string>("");
  const [qty, setQty] = useState<string>("");
  const [tol, setTol] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const { data: assigned = [] } = useQuery({
    queryKey: ["psrm", stepId],
    queryFn: () => api.processStepRawMaterials.listForStep(stepId),
  });

  const { data: availability = [] } = useQuery({
    queryKey: ["psrm-avail", stepId, assigned.length],
    queryFn: () => api.processStepRawMaterials.availability(stepId, 1),
    enabled: assigned.length > 0,
  });

  const { data: rawMaterials = [] } = useQuery({
    queryKey: ["raw-materials-list"],
    queryFn: () => api.rawMaterials.list(),
  });

  const assignedIds = useMemo(() => new Set(assigned.map((a) => a.raw_material_id)), [assigned]);
  const available = (rawMaterials as any[]).filter((m) => !assignedIds.has(m.id));

  const selectedMaterial = (rawMaterials as any[]).find((m) => m.id === selectedRm);

  const addMut = useMutation({
    mutationFn: async () => {
      if (!selectedRm) throw new Error("Rohstoff auswählen");
      const q = Number(qty);
      if (!isFinite(q) || q <= 0) throw new Error("Gültige Sollmenge angeben");
      return api.processStepRawMaterials.create({
        step_id: stepId,
        raw_material_id: selectedRm,
        target_quantity: q,
        unit: selectedMaterial?.unit ?? null,
        tolerance_percent: tol ? Number(tol) : null,
        note: note.trim() || null,
        sort_order: assigned.length,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["psrm", stepId] });
      qc.invalidateQueries({ queryKey: ["psrm-avail", stepId] });
      setSelectedRm(""); setQty(""); setTol(""); setNote("");
      toast.success("Rohstoff hinzugefügt");
    },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => api.processStepRawMaterials.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["psrm", stepId] });
      qc.invalidateQueries({ queryKey: ["psrm-avail", stepId] });
      toast.success("Entfernt");
    },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: any }) =>
      api.processStepRawMaterials.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["psrm", stepId] });
      qc.invalidateQueries({ queryKey: ["psrm-avail", stepId] });
    },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const missingRows = availability.filter((r) => Number(r.missing) > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Package className="h-4 w-4" />
          Benötigte Rohstoffe
          {assigned.length > 0 && <Badge variant="outline">{assigned.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Auswahl aus der bestehenden Rohstoffverwaltung. Diese Vorgaben dienen als Soll-Werte
          für den späteren Prozess und werden vor dem Verwiegen automatisch mit den vorhandenen
          Gebinden / LOTs abgeglichen.
        </p>

        {/* Hinzufügen */}
        <div className="grid grid-cols-12 gap-2 items-end rounded border bg-muted/30 p-3">
          <div className="col-span-5">
            <Label className="text-xs">Rohstoff</Label>
            <Select value={selectedRm} onValueChange={setSelectedRm}>
              <SelectTrigger><SelectValue placeholder="Rohstoff wählen…" /></SelectTrigger>
              <SelectContent>
                {available.length === 0 && (
                  <div className="px-2 py-1 text-xs text-muted-foreground">Keine weiteren Rohstoffe verfügbar.</div>
                )}
                {available.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.material_name}
                    {m.material_number ? ` · ${m.material_number}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Sollmenge</Label>
            <Input type="number" step="0.001" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="col-span-1">
            <Label className="text-xs">Einheit</Label>
            <Input value={selectedMaterial?.unit ?? ""} disabled className="bg-muted" />
          </div>
          <div className="col-span-1">
            <Label className="text-xs">Tol. %</Label>
            <Input type="number" step="0.1" value={tol} onChange={(e) => setTol(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Bemerkung</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="col-span-1">
            <Button size="sm" className="w-full" onClick={() => addMut.mutate()} disabled={!selectedRm || !qty}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Zuordnungen */}
        {assigned.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rohstoff</TableHead>
                <TableHead className="w-28">Sollmenge</TableHead>
                <TableHead className="w-20">Einheit</TableHead>
                <TableHead className="w-20">Tol. %</TableHead>
                <TableHead>Bemerkung</TableHead>
                <TableHead className="w-32">Verfügbarkeit</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assigned.map((row) => {
                const av = availability.find((a) => a.psrm_id === row.id);
                const missing = av ? Number(av.missing) : 0;
                const ok = av && missing <= 0;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.raw_materials?.material_name}
                      {row.raw_materials?.material_number && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({row.raw_materials.material_number})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number" step="0.001"
                        defaultValue={row.target_quantity}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (isFinite(v) && v !== row.target_quantity) {
                            updateMut.mutate({ id: row.id, patch: { target_quantity: v } });
                          }
                        }}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell className="text-xs">{row.unit ?? row.raw_materials?.unit ?? "–"}</TableCell>
                    <TableCell>
                      <Input
                        type="number" step="0.1"
                        defaultValue={row.tolerance_percent ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          updateMut.mutate({ id: row.id, patch: { tolerance_percent: v } });
                        }}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={row.note ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value.trim() || null;
                          if (v !== row.note) updateMut.mutate({ id: row.id, patch: { note: v } });
                        }}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      {av ? (
                        ok ? (
                          <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {formatQuantity(av.available)} {av.unit}
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            fehlt {formatQuantity(missing)} {av.unit}
                          </Badge>
                        )
                      ) : <span className="text-xs text-muted-foreground">–</span>}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => removeMut.mutate(row.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Fehlbedarf-Summary (Design-Zeit-Hinweis, bezogen auf Sollmenge x 1) */}
        {missingRows.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Nicht ausreichend Material verfügbar</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 space-y-1 text-sm">
                {missingRows.map((r) => (
                  <li key={r.psrm_id}>
                    <strong>{r.material_name}</strong>: benötigt {formatQuantity(r.required)} {r.unit},
                    verfügbar {formatQuantity(r.available)} {r.unit},{" "}
                    <strong>fehlt {formatQuantity(r.missing)} {r.unit}</strong>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
