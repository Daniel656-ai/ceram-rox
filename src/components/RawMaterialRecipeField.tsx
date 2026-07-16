import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { formatQuantity } from "@/lib/formatQuantity";

export interface RecipeRow {
  raw_material_id: string;
  quantity: number | string;
  unit: string;
  note?: string;
}

interface Props {
  value: RecipeRow[] | undefined;
  onChange: (rows: RecipeRow[]) => void;
  readonly?: boolean;
}

/**
 * Recipe input for order creators. Uses ONLY existing raw materials from
 * the raw material management; no new materials can be created here.
 * Displays live availability warnings based on current container stock.
 */
export default function RawMaterialRecipeField({ value, onChange, readonly }: Props) {
  const rows: RecipeRow[] = Array.isArray(value) ? value : [];

  const { data: materials = [] } = useQuery({
    queryKey: ["raw-materials"],
    queryFn: () => api.rawMaterials.list(),
  });
  const { data: containers = [] } = useQuery({
    queryKey: ["raw-material-containers", "all"],
    queryFn: () => api.rawMaterialContainers.list(),
  });

  const materialById = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of materials as any[]) m.set(r.id, r);
    return m;
  }, [materials]);

  const availableByMaterial = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of containers as any[]) {
      if (c.status === "entsorgt" || c.status === "gesperrt") continue;
      const avail = Number(c.current_quantity ?? 0) - Number(c.reserved_quantity ?? 0);
      if (avail <= 0) continue;
      m.set(c.raw_material_id, (m.get(c.raw_material_id) ?? 0) + avail);
    }
    return m;
  }, [containers]);

  const update = (idx: number, patch: Partial<RecipeRow>) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange(next);
  };
  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
  const add = () => onChange([...rows, { raw_material_id: "", quantity: "", unit: "", note: "" }]);

  const shortages = useMemo(() => {
    const list: Array<{ name: string; required: number; available: number; unit: string }> = [];
    for (const r of rows) {
      if (!r.raw_material_id) continue;
      const req = Number(r.quantity);
      if (!isFinite(req) || req <= 0) continue;
      const avail = availableByMaterial.get(r.raw_material_id) ?? 0;
      if (avail < req) {
        const mat = materialById.get(r.raw_material_id);
        list.push({
          name: mat?.material_name ?? "Unbekannt",
          required: req,
          available: avail,
          unit: r.unit || mat?.unit || "",
        });
      }
    }
    return list;
  }, [rows, availableByMaterial, materialById]);

  return (
    <div className="space-y-2 border rounded-md p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Rezeptur / Rohstoffliste</span>
        {!readonly && (
          <Button type="button" size="sm" variant="outline" onClick={add} className="h-7">
            <Plus className="h-3 w-3 mr-1" /> Rohstoff hinzufügen
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Noch keine Rohstoffe hinzugefügt.</p>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-[minmax(180px,2fr)_100px_80px_1fr_auto] gap-2 text-[10px] uppercase text-muted-foreground px-1">
            <div>Rohstoff</div>
            <div>Sollmenge</div>
            <div>Einheit</div>
            <div>Bemerkung</div>
            <div />
          </div>
          {rows.map((row, idx) => {
            const mat = materialById.get(row.raw_material_id);
            const req = Number(row.quantity);
            const avail = availableByMaterial.get(row.raw_material_id) ?? 0;
            const short = row.raw_material_id && isFinite(req) && req > 0 && avail < req;
            return (
              <div key={idx} className="grid grid-cols-[minmax(180px,2fr)_100px_80px_1fr_auto] gap-2 items-center">
                <Select
                  value={row.raw_material_id || undefined}
                  onValueChange={(v) => {
                    const chosen: any = materialById.get(v);
                    update(idx, { raw_material_id: v, unit: row.unit || chosen?.unit || "" });
                  }}
                  disabled={readonly}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Rohstoff wählen…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(materials as any[]).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.material_name}
                        {m.material_number ? ` (${m.material_number})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="any"
                  value={row.quantity ?? ""}
                  onChange={(e) => update(idx, { quantity: e.target.value })}
                  disabled={readonly}
                  className="h-8"
                />
                <Input
                  value={row.unit ?? ""}
                  onChange={(e) => update(idx, { unit: e.target.value })}
                  disabled={readonly}
                  className="h-8"
                  placeholder={mat?.unit ?? "kg"}
                />
                <Input
                  value={row.note ?? ""}
                  onChange={(e) => update(idx, { note: e.target.value })}
                  disabled={readonly}
                  className="h-8"
                  placeholder="optional"
                />
                <div className="flex items-center gap-1">
                  {row.raw_material_id && isFinite(req) && req > 0 && (
                    <Badge variant={short ? "destructive" : "secondary"} className="text-[10px]">
                      {short ? (
                        <AlertTriangle className="h-3 w-3 mr-0.5" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3 mr-0.5" />
                      )}
                      {formatQuantity(avail)} {row.unit || mat?.unit || ""}
                    </Badge>
                  )}
                  {!readonly && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => remove(idx)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {shortages.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Nicht ausreichend Material verfügbar</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 space-y-1 text-xs">
              {shortages.map((s, i) => (
                <li key={i}>
                  <strong>{s.name}</strong>: benötigt {formatQuantity(s.required)} {s.unit},
                  verfügbar {formatQuantity(s.available)} {s.unit}
                  {" — "}
                  <strong>fehlt {formatQuantity(s.required - s.available)} {s.unit}</strong>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
