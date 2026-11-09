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
  buildValidatedPayloadFromDraft, buildPayloadFromOrder, COPY_OPTION_LABELS,
  DEFAULT_COPY_OPTIONS, type CopyOptions, type TemplateCopyWarning,
} from "@/lib/orderTemplateCopy";
import type { OrderDraft } from "@/lib/api/orderDrafts";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { orderIdentity } from "@/lib/orders/orderIdentity";

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
  const { t } = useTranslation("orders");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const { user } = useAuth();
  const [opts, setOpts] = useState<CopyOptions>(DEFAULT_COPY_OPTIONS);
  const [pickedOrderId, setPickedOrderId] = useState<string>(sourceOrderId ?? "");
  const [busy, setBusy] = useState(false);
  const [copyWarnings, setCopyWarnings] = useState<TemplateCopyWarning[]>([]);
  const [createdDraftId, setCreatedDraftId] = useState<string | null>(null);

  const needsOrderPicker = !sourceDraft && !sourceOrderId;
  const { data: orders = [], isLoading, isError } = useQuery({
    queryKey: ["orders", "template-picker"],
    queryFn: () => api.orders.list(),
    enabled: open && needsOrderPicker,
  });
  const filteredOrders = orders.filter(o => [orderIdentity(o).number, o.order_number, o.projects?.project_number, o.projects?.project_name, o.notes].join(" ").toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()));

  const toggle = (k: keyof CopyOptions) =>
    setOpts((p) => ({ ...p, [k]: !p[k] }));

  const handleCreate = async () => {
    if (!user) return;
    setBusy(true);
    try {
      let payload;
      let label: string;
      let warnings: TemplateCopyWarning[] = [];
      const orderId = sourceOrderId || pickedOrderId || null;

      if (sourceDraft) {
        payload = await buildValidatedPayloadFromDraft(sourceDraft.payload, opts);
        label = sourceDraft.title || "Entwurf";
      } else if (orderId) {
        const res = await buildPayloadFromOrder(orderId, opts);
        payload = res.payload;
        label = res.label;
        warnings = res.warnings;
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
      if (warnings.length) {
        setCopyWarnings(warnings);
        setCreatedDraftId(draft.id);
        return;
      }
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
    <Dialog open={open} onOpenChange={value => {
      if (!value) { setCopyWarnings([]); setCreatedDraftId(null); }
      onOpenChange(value);
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Als Vorlage für neuen Auftrag verwenden</DialogTitle>
          <DialogDescription>
            Es entsteht ein neuer, unabhängiger Entwurf. Die Vorlage selbst wird nicht verändert.
          </DialogDescription>
        </DialogHeader>

        {createdDraftId ? (
          <Alert role="alert">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <p>Der Entwurf wurde erstellt. Folgende Vorgaben konnten nicht eindeutig zugeordnet werden und müssen manuell geprüft werden:</p>
              <ul className="mt-2 max-h-64 overflow-y-auto space-y-2 break-words">
                {copyWarnings.map(w => <li key={`${w.measurementId}:${w.parameterName}`}>
                  <strong>{w.serviceName}</strong>: {w.parameterName}
                  {w.formIds.length > 0 && <span className="block text-xs text-muted-foreground">Formulare: {w.formIds.join(", ")}</span>}
                </li>)}
              </ul>
            </AlertDescription>
          </Alert>
        ) : <>
        {needsOrderPicker && (
          <div className="space-y-2">
            <Label>Vorlage (bestehender Auftrag)</Label>
            <Input value={search} onChange={event => setSearch(event.target.value)} aria-label={t("draftSafety.search")} placeholder={t("draftSafety.search")} />
            <div className="max-h-56 overflow-y-auto border rounded-md" role="listbox" aria-label={t("draftSafety.template")}>
              {isLoading ? <p className="p-3 text-sm">{t("draftSafety.loading")}</p> : isError ? <p className="p-3 text-sm text-destructive">{t("draftSafety.error")}</p> : filteredOrders.length === 0 ? <p className="p-3 text-sm">{t("draftSafety.empty")}</p> : filteredOrders.map(o => (
                <Button key={o.id} type="button" variant={pickedOrderId === o.id ? "secondary" : "ghost"} className="w-full justify-start h-auto whitespace-normal text-left" role="option" aria-selected={pickedOrderId === o.id} onClick={() => setPickedOrderId(o.id)}>
                  {orderIdentity(o).number || "–"} · {o.projects?.project_number ?? ""} {o.projects?.project_name ?? ""}
                </Button>
              ))}
            </div>
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
        </>}

        <DialogFooter>
          {createdDraftId ? <Button onClick={() => {
            const id = createdDraftId;
            setCopyWarnings([]);
            setCreatedDraftId(null);
            onOpenChange(false);
            navigate(`/auftraege/neu?draft=${id}`);
          }}>Entwurf prüfen</Button> : <>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleCreate} disabled={busy || (needsOrderPicker && (!pickedOrderId || isLoading || isError))}>
            <Copy className="h-4 w-4 mr-2" />
            {busy ? "Erstelle…" : "Entwurf erstellen"}
          </Button>
          </>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
