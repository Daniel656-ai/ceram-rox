import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  buildPayloadFromDraft, buildPayloadFromOrder, COPY_OPTION_LABELS,
  DEFAULT_COPY_OPTIONS, type CopyOptions,
} from "@/lib/orderTemplateCopy";
import type { OrderDraft } from "@/lib/api/orderDrafts";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Vorbelegte Quelle: bestehender Entwurf. */
  sourceDraft?: OrderDraft | null;
  /** Vorbelegte Quelle: bestehender Auftrag. */
  sourceOrderId?: string | null;
}

export default function UseAsTemplateDialog({
  open, onOpenChange, sourceDraft = null, sourceOrderId = null,
}: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [opts, setOpts] = useState<CopyOptions>(DEFAULT_COPY_OPTIONS);
  const [pickedOrderId, setPickedOrderId] = useState<string>(sourceOrderId ?? "");
  const [busy, setBusy] = useState(false);

  const needsOrderPicker = !sourceDraft && !sourceOrderId;
  const { data: orders = [] } = useQuery({
    queryKey: ["orders", "template-picker"],
    queryFn: () => api.orders.list(),
    enabled: open && needsOrderPicker,
  });

  const toggle = (k: keyof CopyOptions) =>
    setOpts((p) => ({ ...p, [k]: !p[k] }));

  const handleCreate = async () => {
    if (!user) return;
    setBusy(true);
    try {
      let payload;
      let label: string;
      const orderId = sourceOrderId || pickedOrderId || null;

      if (sourceDraft) {
        payload = buildPayloadFromDraft(sourceDraft.payload, opts);
        label = sourceDraft.title || "Entwurf";
      } else if (orderId) {
        const res = await buildPayloadFromOrder(orderId, opts);
        payload = res.payload;
        label = res.label;
      } else {
        toast.error("Bitte eine Vorlage auswählen");
        setBusy(false);
        return;
      }

      const draft = await api.orderDrafts.create({
        created_by: user.id,
        title: `Kopie von ${label}`,
        project_id: payload.selectedProjectId || null,
        order_kind: payload.orderKind ?? null,
        service_count: payload.measurements?.length ?? 0,
        payload,
        source_order_id: sourceDraft ? null : orderId,
        source_draft_id: sourceDraft?.id ?? null,
        source_label: label,
        copy_options: opts as unknown as Record<string, boolean>,
        // Vergleichsstand („unverändert / geändert") — reine Kopie, keine Referenz.
        template_baseline: JSON.parse(JSON.stringify(payload)),
        copied_at: new Date().toISOString(),
        copied_by: user.id,
      });

      qc.invalidateQueries({ queryKey: ["order-drafts"] });
      onOpenChange(false);
      toast.success("Neuer Entwurf aus Vorlage erstellt");
      navigate(`/auftraege/neu?draft=${draft.id}`);
    } catch (e: any) {
      toast.error("Vorlage konnte nicht übernommen werden", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Als Vorlage für neuen Auftrag verwenden</DialogTitle>
          <DialogDescription>
            Es entsteht ein neuer, unabhängiger Entwurf. Die Vorlage selbst wird nicht verändert.
          </DialogDescription>
        </DialogHeader>

        {needsOrderPicker && (
          <div className="space-y-2">
            <Label>Vorlage (bestehender Auftrag)</Label>
            <Select value={pickedOrderId} onValueChange={setPickedOrderId}>
              <SelectTrigger><SelectValue placeholder="Auftrag wählen" /></SelectTrigger>
              <SelectContent>
                {(orders as any[]).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.order_number ?? "–"} · {o.projects?.project_number ?? ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-sm font-medium">Inhalte aus Vorlage übernehmen</Label>
          <div className="rounded-md border divide-y">
            {(Object.keys(COPY_OPTION_LABELS) as (keyof CopyOptions)[]).map((k) => (
              <label
                key={k}
                className={`flex items-center gap-3 px-3 py-2 text-sm ${
                  k === "attachments" ? "opacity-60" : "cursor-pointer hover:bg-muted/50"
                }`}
              >
                <Checkbox
                  checked={opts[k]}
                  disabled={k === "attachments"}
                  onCheckedChange={() => toggle(k)}
                />
                <span>{COPY_OPTION_LABELS[k]}</span>
                {k === "attachments" && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    nicht unterstützt
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Auftragsnummer, Status, Messnummern, Messergebnisse, Arbeitszeiten, Aufgaben und
            Workflowinformationen werden niemals übernommen. Proben werden nicht mit ihren
            bisherigen Identifikationen weiterverwendet – prüfen Sie die Probenauswahl im neuen
            Entwurf.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleCreate} disabled={busy}>
            <Copy className="h-4 w-4 mr-2" />
            {busy ? "Erstelle…" : "Entwurf erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
