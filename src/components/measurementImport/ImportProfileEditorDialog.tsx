import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ImportMapping, MeasurementImportProfile } from "@/lib/api/measurementImportProfiles";
import type { TargetCandidate } from "@/lib/measurementImport";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** null = neues Profil anlegen */
  profile: MeasurementImportProfile | null;
  /** Zielfelder des aktuellen Formularabschnitts (für die Zuordnung). */
  targets: TargetCandidate[];
  onSaved?: (p: MeasurementImportProfile) => void;
}

const emptyMapping = (): ImportMapping => ({ source_names: [], target_field_key: "", unit: "" });

export default function ImportProfileEditorDialog({ open, onOpenChange, profile, targets, onSaved }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState<MeasurementImportProfile["format"]>("auto");
  const [decimalSeparator, setDecimalSeparator] = useState("auto");
  const [defaultUnit, setDefaultUnit] = useState("");
  const [mappings, setMappings] = useState<ImportMapping[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(profile?.name ?? "");
    setDescription(profile?.description ?? "");
    setFormat(profile?.format ?? "auto");
    setDecimalSeparator(profile?.decimal_separator ?? "auto");
    setDefaultUnit(profile?.default_unit ?? "");
    setMappings(profile?.mappings?.length ? profile.mappings.map((m) => ({ ...m })) : [emptyMapping()]);
  }, [open, profile]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name erforderlich");
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        format,
        decimal_separator: decimalSeparator,
        default_unit: defaultUnit.trim() || null,
        mappings: mappings
          .filter((m) => m.target_field_key && (m.source_names ?? []).length > 0)
          .map((m) => ({ ...m, unit: m.unit?.trim() || null })),
      };
      if (profile) {
        await api.measurementImportProfiles.update(profile.id, payload as any);
        return { ...profile, ...payload } as MeasurementImportProfile;
      }
      return api.measurementImportProfiles.create(payload as any);
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["measurement-import-profiles"] });
      toast.success("Importprofil gespeichert");
      onSaved?.(p as MeasurementImportProfile);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const patch = (i: number, p: Partial<ImportMapping>) =>
    setMappings((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...p } : m)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{profile ? "Importprofil bearbeiten" : "Neues Importprofil"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. RFA" /></div>
            <div><Label>Standard-Einheit (optional)</Label><Input value={defaultUnit} onChange={(e) => setDefaultUnit(e.target.value)} placeholder="z.B. %" /></div>
          </div>
          <div><Label>Beschreibung</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Datenformat</Label>
              <Select value={format} onValueChange={(v: any) => setFormat(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automatisch erkennen</SelectItem>
                  <SelectItem value="key_value">Parameter / Wert (zeilenweise)</SelectItem>
                  <SelectItem value="table_params_in_rows">Tabelle – Parameter in Zeilen, Proben in Spalten</SelectItem>
                  <SelectItem value="table_params_in_columns">Tabelle – Parameter in Spalten, Proben in Zeilen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Dezimaltrennzeichen</Label>
              <Select value={decimalSeparator} onValueChange={setDecimalSeparator}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automatisch</SelectItem>
                  <SelectItem value=",">Komma (1,23)</SelectItem>
                  <SelectItem value=".">Punkt (1.23)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Parameter-Zuordnung</Label>
              <Button size="sm" variant="outline" onClick={() => setMappings((p) => [...p, emptyMapping()])}>
                <Plus className="h-3.5 w-3.5 mr-1" />Zuordnung
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Quellbezeichnungen kommagetrennt (alle Schreibweisen, z.B. „SiO2, SiO₂“). Groß-/Kleinschreibung,
              Leerzeichen und tiefgestellte Ziffern werden automatisch ignoriert.
            </p>
            {mappings.map((m, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded p-2">
                <div className="col-span-5">
                  <Label className="text-xs">Quellbezeichnung(en)</Label>
                  <Input
                    value={(m.source_names ?? []).join(", ")}
                    onChange={(e) => patch(i, { source_names: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                    placeholder="SiO2, SiO₂"
                  />
                </div>
                <div className="col-span-4">
                  <Label className="text-xs">Zielfeld</Label>
                  <Select value={m.target_field_key || "__none__"} onValueChange={(v) => patch(i, { target_field_key: v === "__none__" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="__none__">— nicht zugeordnet —</SelectItem>
                      {targets.map((t) => (
                        <SelectItem key={t.field_key} value={t.field_key}>{t.display_name} ({t.field_key})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Einheit</Label>
                  <Input value={m.unit ?? ""} onChange={(e) => patch(i, { unit: e.target.value })} placeholder="%" />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive"
                    onClick={() => setMappings((p) => p.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {targets.length === 0 && (
              <p className="text-xs text-amber-600">
                Für dieses Formular sind noch keine Zielfelder vorhanden – Zielfelder können auch später ergänzt werden.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
