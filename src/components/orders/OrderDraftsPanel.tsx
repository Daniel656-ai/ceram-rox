import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Trash2, Copy, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { useMyOrderDrafts, useDeleteOrderDraft } from "@/hooks/useOrderDrafts";
import { usePermissions } from "@/hooks/usePermissions";
import UseAsTemplateDialog from "./UseAsTemplateDialog";
import type { OrderDraft } from "@/lib/api/orderDrafts";

/** „Meine Entwürfe" — optionaler Bereich, nur bei entsprechender Berechtigung. */
export default function OrderDraftsPanel({ activeDraftId }: { activeDraftId?: string | null }) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { data: drafts = [] } = useMyOrderDrafts();
  const del = useDeleteOrderDraft();
  const [templateSource, setTemplateSource] = useState<OrderDraft | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const canDrafts = hasPermission("orders.drafts.manage");
  const canTemplate = hasPermission("orders.use_as_template");
  if (!canDrafts && !canTemplate) return null;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("de-AT", { dateStyle: "short", timeStyle: "short" });

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Meine Entwürfe
            </CardTitle>
            {canTemplate && (
              <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Auftrag als Vorlage
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!canDrafts ? (
            <p className="text-sm text-muted-foreground">
              Keine Berechtigung zum Verwalten von Auftragsentwürfen.
            </p>
          ) : drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Entwürfe. Ihre Eingaben werden automatisch zwischengespeichert.
            </p>
          ) : (
            <div className="rounded-md border divide-y">
              {drafts.map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-3 py-2 flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-sm font-medium flex items-center gap-2 flex-wrap">
                      {d.title || "Unbenannter Entwurf"}
                      <Badge variant="secondary" className="font-normal">Entwurf</Badge>
                      {d.id === activeDraftId && (
                        <Badge variant="outline" className="font-normal">aktuell</Badge>
                      )}
                      {d.source_label && (
                        <Badge variant="outline" className="font-normal">
                          aus Vorlage: {d.source_label}
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.projects?.project_number
                        ? `${d.projects.project_number}${d.projects.project_name ? " – " + d.projects.project_name : ""} · `
                        : ""}
                      {d.service_count} Dienstleistung(en) · zuletzt geändert {fmt(d.updated_at)}
                    </p>
                  </div>
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={() => navigate(`/auftraege/neu?draft=${d.id}`)}
                  >
                    <FolderOpen className="h-3.5 w-3.5 mr-1.5" /> Weiterbearbeiten
                  </Button>
                  {canTemplate && (
                    <Button
                      type="button" variant="ghost" size="icon" className="h-8 w-8"
                      title="Als Vorlage verwenden"
                      onClick={() => setTemplateSource(d)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="h-8 w-8 text-destructive"
                    title="Entwurf löschen"
                    onClick={async () => {
                      try {
                        await del.mutateAsync(d.id);
                        toast.success("Entwurf gelöscht");
                        if (d.id === activeDraftId) navigate("/auftraege/neu", { replace: true });
                      } catch (e: any) {
                        toast.error(e.message);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <UseAsTemplateDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      />
      <UseAsTemplateDialog
        open={!!templateSource}
        onOpenChange={(v) => !v && setTemplateSource(null)}
        sourceDraft={templateSource}
      />
    </>
  );
}
