import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Check, PencilLine, MinusCircle, Loader2 } from "lucide-react";
import { useReleaseChanges, useResolveChange } from "@/hooks/useProductionReleases";

const DETECTION_LABEL: Record<string, string> = {
  strikethrough: "alter Wert durchgestrichen",
  red: "neuer Wert rot",
  combined: "durchgestrichen + rot",
  text: "Textvergleich",
  unknown: "unklar",
};
const CONFIDENCE_LABEL: Record<string, string> = { high: "hoch", medium: "mittel", low: "niedrig" };

interface Props {
  releaseId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  readOnly?: boolean;
}

/**
 * Prüfmaske: zeigt ausschließlich die unsicheren Erkennungen.
 * Eindeutige Änderungen wurden bereits automatisch übernommen.
 */
export function ReviewChangesDialog({ releaseId, open, onOpenChange, readOnly }: Props) {
  const { data: changes = [], isLoading } = useReleaseChanges(open ? releaseId : undefined);
  const resolve = useResolveChange();
  const [edit, setEdit] = useState<Record<string, string>>({});

  const pending = changes.filter((c) => c.status === "pending");

  const act = async (
    change: (typeof changes)[number],
    action: "accept" | "correct" | "dismiss",
    value?: string
  ) => {
    try {
      const open = await resolve.mutateAsync({ releaseId, change, action, value });
      toast.success(open ? `Erledigt – noch ${open} Prüfpunkt(e) offen.` : "Alle Prüfpunkte erledigt.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Änderungen prüfen</DialogTitle>
          <DialogDescription>
            ROX konnte diese Angaben nicht eindeutig erkennen. Bereits eindeutige Änderungen
            wurden automatisch übernommen und müssen nicht bestätigt werden.
          </DialogDescription>
        </DialogHeader>

        {isLoading && <p className="text-sm text-muted-foreground">Wird geladen …</p>}
        {!isLoading && !pending.length && (
          <p className="text-sm text-muted-foreground">Keine offenen Prüfpunkte.</p>
        )}

        <div className="space-y-4">
          {pending.map((c, idx) => {
            const hasNew = !!(c.new_value ?? "").trim();
            return (
              <Card key={c.id}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">Änderung {idx + 1}: {c.field_label || c.field_key}</div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{DETECTION_LABEL[c.detection] ?? c.detection}</Badge>
                      <Badge variant="outline">Sicherheit: {CONFIDENCE_LABEL[c.confidence]}</Badge>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">Bisher</div>
                      <div>{c.old_value || "–"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Erkannt</div>
                      <div className={hasNew ? "font-medium" : "text-amber-700 dark:text-amber-300"}>
                        {hasNew ? c.new_value : "nicht eindeutig erkannt"}
                      </div>
                    </div>
                  </div>
                  {c.note && <p className="text-xs text-muted-foreground">{c.note}</p>}

                  {!readOnly && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {hasNew && (
                        <Button size="sm" onClick={() => act(c, "accept")} disabled={resolve.isPending}>
                          {resolve.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                          Übernehmen
                        </Button>
                      )}
                      <Input
                        className="h-9 w-56"
                        placeholder={hasNew ? "Korrigierter Wert" : "Wert eingeben"}
                        value={edit[c.id!] ?? ""}
                        onChange={(e) => setEdit((p) => ({ ...p, [c.id!]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!(edit[c.id!] ?? "").trim() || resolve.isPending}
                        onClick={() => act(c, "correct", edit[c.id!])}
                      >
                        <PencilLine className="h-4 w-4 mr-2" />
                        {hasNew ? "Korrigieren" : "Wert speichern"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={resolve.isPending}
                        onClick={() => act(c, "dismiss")}
                      >
                        <MinusCircle className="h-4 w-4 mr-2" /> Als unverändert markieren
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
