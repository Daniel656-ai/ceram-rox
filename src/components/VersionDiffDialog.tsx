import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useRecipeVersions } from "@/hooks/useMixtureProcess";
import { Plus, Minus, ArrowRightLeft } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mixtureId: string;
}

export function VersionDiffDialog({ open, onOpenChange, mixtureId }: Props) {
  const { data: versions = [] } = useRecipeVersions(mixtureId);
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");

  const { data: diff } = useQuery({
    queryKey: ["mixture_version_diff", a, b],
    queryFn: () => api.mixtureTemplates.diff(a, b),
    enabled: !!a && !!b && a !== b,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" /> Rezepturversionen vergleichen
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Version A (alt)</Label>
            <Select value={a} onValueChange={setA}>
              <SelectTrigger><SelectValue placeholder="Wählen" /></SelectTrigger>
              <SelectContent>
                {(versions as any[]).map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>
                    v{v.version_label || v.version_no}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Version B (neu)</Label>
            <Select value={b} onValueChange={setB}>
              <SelectTrigger><SelectValue placeholder="Wählen" /></SelectTrigger>
              <SelectContent>
                {(versions as any[]).map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>
                    v{v.version_label || v.version_no}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!diff && a && b && a !== b && (
          <p className="text-sm text-muted-foreground">Lade Unterschiede…</p>
        )}

        {diff && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <DiffSection title="Rohstoffe" data={diff.items} renderItem={renderItem} />
            <DiffSection title="Prozessabschnitte" data={diff.sections} renderItem={renderSection} />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiffSection({ title, data, renderItem }: any) {
  if (!data) return null;
  const empty =
    (data.added?.length || 0) + (data.removed?.length || 0) + (data.changed?.length || 0) === 0;
  return (
    <Card className="p-3">
      <h4 className="font-medium mb-2">{title}</h4>
      {empty ? (
        <p className="text-xs text-muted-foreground italic">Keine Änderungen</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {(data.added || []).map((x: any, i: number) => (
            <li key={"a" + i} className="flex items-start gap-2 bg-emerald-50 dark:bg-emerald-950/30 rounded px-2 py-1">
              <Plus className="h-3 w-3 mt-1 text-emerald-700" />
              <span>Neu: {renderItem(x)}</span>
            </li>
          ))}
          {(data.removed || []).map((x: any, i: number) => (
            <li key={"r" + i} className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1">
              <Minus className="h-3 w-3 mt-1 text-red-700" />
              <span>Entfernt: {renderItem(x)}</span>
            </li>
          ))}
          {(data.changed || []).map((x: any, i: number) => (
            <li key={"c" + i} className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1">
              <ArrowRightLeft className="h-3 w-3 mt-1 text-amber-700" />
              <span>Geändert: {renderItem(x, true)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function renderItem(x: any, changed = false) {
  if (changed) {
    return (
      <>
        <strong>{x.material_name}</strong>: {x.old_quantity} {x.old_unit} → {x.new_quantity} {x.new_unit}
      </>
    );
  }
  return (
    <>
      <strong>{x.material_name}</strong> ({x.quantity} {x.unit})
    </>
  );
}

function renderSection(x: any, changed = false) {
  if (changed) {
    return (
      <>
        <strong>{x.name}</strong>: Dauer {x.old_duration ?? "—"} → {x.new_duration ?? "—"} min, Temp{" "}
        {x.old_temperature ?? "—"} → {x.new_temperature ?? "—"} °C
      </>
    );
  }
  return (
    <>
      <strong>{x.name}</strong>
      {x.planned_duration_min != null && ` (${x.planned_duration_min} min)`}
    </>
  );
}
