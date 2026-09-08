import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Check, Plus, Trash2 } from "lucide-react";
import type { ProductionReleaseSpecSet } from "@/lib/api/productionReleases";
import {
  releaseTypeDef, parameterLabel, formatSpecValue, parseSpecNumber,
} from "@/lib/productionRelease/releaseTypes";

interface Props {
  releaseType: string;
  sets: ProductionReleaseSpecSet[];
  onChange?: (sets: ProductionReleaseSpecSet[]) => void;
  /** Wer bestätigt (für unsichere Werte) */
  userId?: string | null;
  readOnly?: boolean;
}

/**
 * Anzeige/Bearbeitung typabhängiger Vorgabensätze (z. B. NOx-Messpunkte).
 * Unsichere Werte müssen bestätigt oder korrigiert werden – eine Korrektur
 * gilt als Bestätigung.
 */
export function SpecSetsEditor({ releaseType, sets, onChange, userId, readOnly }: Props) {
  const type = releaseTypeDef(releaseType);
  const edit = !readOnly && !!onChange;

  const update = (si: number, vi: number, patch: Partial<ProductionReleaseSpecSet["values"][number]>) => {
    onChange?.(sets.map((s, i) =>
      i !== si ? s : { ...s, values: s.values.map((v, j) => (j !== vi ? v : { ...v, ...patch })) }
    ));
  };
  const confirm = (si: number, vi: number) =>
    update(si, vi, { needs_review: false, confirmed_at: new Date().toISOString(), confirmed_by: userId ?? null });

  const open = sets.flatMap((s) => s.values).filter((v) => v.needs_review && !v.confirmed_at).length;

  if (!sets.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Keine Vorgabensätze ({type.labelDe}) vorhanden.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {open > 0 && (
        <div className="flex items-center gap-2 text-sm text-warning">
          <AlertTriangle className="h-4 w-4" />
          {open} Vorgabe{open === 1 ? "" : "n"} unsicher erkannt – bitte prüfen und bestätigen oder korrigieren.
        </div>
      )}
      {sets.map((s, si) => (
        <div key={s.id ?? si} className="rounded-md border">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{s.label || `${type.setLabelDe} ${si + 1}`}</span>
              {s.page ? <Badge variant="outline">Seite {s.page}</Badge> : null}
            </div>
            {edit && (
              <Button
                size="sm" variant="ghost" aria-label="Vorgabensatz entfernen"
                onClick={() => onChange?.(sets.filter((_, i) => i !== si))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/3">Vorgabe</TableHead>
                <TableHead>Wert</TableHead>
                <TableHead className="w-28">Einheit</TableHead>
                <TableHead className="w-40">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.values.map((v, vi) => {
                const unsure = !!v.needs_review && !v.confirmed_at;
                return (
                  <TableRow key={v.id ?? `${v.parameter_key}-${vi}`} className={unsure ? "bg-warning/5" : undefined}>
                    <TableCell className="text-sm">
                      {parameterLabel(type, v.parameter_key, v.parameter_label)}
                    </TableCell>
                    <TableCell>
                      {edit ? (
                        <Input
                          value={v.value_text ?? ""}
                          aria-invalid={unsure}
                          onChange={(e) => update(si, vi, {
                            value_text: e.target.value,
                            value_num: parseSpecNumber(e.target.value),
                            needs_review: false,
                            confirmed_at: new Date().toISOString(),
                            confirmed_by: userId ?? null,
                          })}
                        />
                      ) : (
                        <span className="text-sm">{formatSpecValue(v)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {edit ? (
                        <Input value={v.unit ?? ""} onChange={(e) => update(si, vi, { unit: e.target.value })} />
                      ) : (
                        <span className="text-sm text-muted-foreground">{v.unit ?? ""}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {unsure ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-warning text-warning">unsicher</Badge>
                          {edit && (
                            <Button size="sm" variant="secondary" onClick={() => confirm(si, vi)}>
                              <Check className="h-3.5 w-3.5 mr-1" /> Bestätigen
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Badge variant="secondary">{v.confirmed_at ? "bestätigt" : "erkannt"}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {edit && (
            <div className="px-3 py-2 border-t">
              <Button
                size="sm" variant="ghost"
                onClick={() => {
                  const used = new Set(s.values.map((v) => v.parameter_key));
                  const next = type.parameters.find((p) => !used.has(p.key)) ?? type.parameters[0];
                  onChange?.(sets.map((x, i) => i !== si ? x : {
                    ...x,
                    values: [...x.values, {
                      parameter_key: next.key, parameter_label: next.labelDe, value_text: "",
                      unit: next.defaultUnit || null, confidence: "high", needs_review: false,
                      confirmed_at: new Date().toISOString(), confirmed_by: userId ?? null,
                    }],
                  }));
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Vorgabe ergänzen
              </Button>
            </div>
          )}
        </div>
      ))}
      {edit && (
        <Button
          size="sm" variant="outline"
          onClick={() => onChange?.([...sets, {
            release_type: releaseType, label: `${type.setLabelDe} ${sets.length + 1}`,
            sort_order: sets.length, source_type: "manual", page: null, values: [],
          }])}
        >
          <Plus className="h-4 w-4 mr-1" /> {type.setLabelDe} hinzufügen
        </Button>
      )}
    </div>
  );
}
