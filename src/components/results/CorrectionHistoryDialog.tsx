import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { History, PencilLine, FlaskConical } from "lucide-react";
import { useMeasurementCorrections, useCorrectionAuthors } from "@/hooks/useResultCorrections";
import type { ResultCorrection } from "@/lib/api/resultCorrections";

const nf = new Intl.NumberFormat("de-AT", { maximumFractionDigits: 6 });

function fmtValue(v: number | null, text: string | null, unit: string | null) {
  const base = v !== null && v !== undefined ? nf.format(v) : text ?? "–";
  return unit ? `${base} ${unit}` : base;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "–"
    : d.toLocaleString("de-AT", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Chronologische, unveränderbare Änderungshistorie eines Messdatensatzes.
 * Optional auf ein einzelnes Ergebnis eingeschränkt.
 */
export default function CorrectionHistoryDialog({
  open,
  onOpenChange,
  measurementId,
  measurementNumber,
  resultId,
  title,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  measurementId: string;
  measurementNumber?: string;
  resultId?: string;
  title?: string;
}) {
  const { data: all = [], isLoading } = useMeasurementCorrections(open ? measurementId : undefined);
  const entries: ResultCorrection[] = resultId
    ? all.filter((c) => c.measurement_result_id === resultId)
    : all;
  const { data: authors } = useCorrectionAuthors(entries.map((e) => e.changed_by));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Änderungshistorie
          </DialogTitle>
          <DialogDescription>
            {title ?? "Alle nachträglichen Korrekturen"}
            {measurementNumber ? ` · ${measurementNumber}` : ""}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Historie wird geladen…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Für diesen Datensatz wurden bisher keine Korrekturen dokumentiert.
          </p>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {entries.map((e) => (
              <div key={e.id} className="border rounded-md p-3 space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {e.change_type === "value" ? (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <PencilLine className="h-3 w-3" /> Wertkorrektur
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <FlaskConical className="h-3 w-3" /> Probenzuordnung geändert
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{fmtDateTime(e.changed_at)}</span>
                  <span className="text-xs text-muted-foreground">
                    · {authors?.get(e.changed_by) || "Benutzer"}
                  </span>
                </div>

                {e.change_type === "value" ? (
                  <div className="space-y-0.5">
                    <div className="font-medium">{e.parameter_label || e.parameter_name}</div>
                    <div className="font-mono text-xs">
                      <span className="text-muted-foreground line-through">
                        {fmtValue(e.old_value, e.old_text, e.unit)}
                      </span>
                      <span className="mx-2">→</span>
                      <span>{fmtValue(e.new_value, e.new_text, e.unit)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <div className="font-mono text-xs">
                      <span className="text-muted-foreground line-through">
                        {e.old_sample_number || "ohne Probe"}
                      </span>
                      <span className="mx-2">→</span>
                      <span>{e.new_sample_number || "ohne Probe"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Betroffene Ergebnisse: {e.affected_result_count ?? 0}
                    </div>
                  </div>
                )}

                <div className="text-xs">
                  <span className="text-muted-foreground">Begründung: </span>
                  {e.reason}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
