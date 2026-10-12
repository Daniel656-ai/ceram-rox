import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  type RenumberPreview, isValidStartValue, isValidYear, isValidReason, canExecute, expectedIds, isStalePreviewError, MIN_REASON_LENGTH,
} from "@/lib/orders/renumber";

interface Props {
  user: { user_id: string; first_name?: string | null; last_name?: string | null; short_code?: string | null } | null;
  onClose: () => void;
}

export function RenumberOrdersDialog({ user, onClose }: Props) {
  const { t, i18n } = useTranslation(["admin", "common"]);
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [start, setStart] = useState(1);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState<RenumberPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const dateFmt = i18n.language === "en" ? "en-GB" : "de-DE";

  const reset = () => { setPreview(null); setConfirmed(false); };
  const close = () => { reset(); setReason(""); setStart(1); setYear(new Date().getFullYear()); onClose(); };

  const loadPreview = async () => {
    if (!user) return;
    if (!isValidYear(year) || !isValidStartValue(start)) { toast.error(t("admin:renumber_invalid_input")); return; }
    setLoading(true); setConfirmed(false);
    try { setPreview(await api.orders.previewRenumberUserOrders(user.user_id, year, start)); }
    catch (e: any) { setPreview(null); toast.error(e?.message ?? String(e)); }
    finally { setLoading(false); }
  };

  const execute = async () => {
    if (!user || !preview || running || !canExecute(preview, reason, confirmed)) return;
    setRunning(true);
    try {
      const n = await api.orders.renumberUserOrders({
        userId: user.user_id, year: preview.year, startValue: preview.start_value,
        reason: reason.trim(), expectedOrderIds: expectedIds(preview),
      });
      toast.success(t("admin:renumber_success", { count: n }));
      await qc.invalidateQueries();
      close();
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (isStalePreviewError(msg)) reset();
      toast.error(msg);
    } finally { setRunning(false); }
  };

  const blocked = preview && (preview.count === 0 || preview.overflow || preview.collision_count > 0);

  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!o && !running) close(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("admin:renumber_title")}</DialogTitle>
          <DialogDescription>
            {user ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() : ""} · {t("admin:short_code")}: <span className="font-mono">{user?.short_code ?? "–"}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("admin:renumber_year")}</Label>
            <Input type="number" min={2000} max={2099} value={year} onChange={(e) => { setYear(Number(e.target.value)); reset(); }} />
          </div>
          <div className="space-y-2">
            <Label>{t("admin:renumber_start")}</Label>
            <Input type="number" min={1} max={9999} value={start} onChange={(e) => { setStart(Number(e.target.value)); reset(); }} />
          </div>
        </div>
        <Button variant="outline" onClick={loadPreview} disabled={loading}>{loading ? t("common:loading") : t("admin:renumber_preview")}</Button>

        {preview && (
          <div className="space-y-3">
            {preview.count === 0 && <p className="text-sm text-muted-foreground">{t("admin:renumber_empty")}</p>}
            {preview.overflow && <p className="text-sm text-destructive">{t("admin:renumber_overflow", { last: preview.last_counter })}</p>}
            {preview.collision_count > 0 && <p className="text-sm text-destructive">{t("admin:renumber_collision", { count: preview.collision_count })}</p>}
            {preview.count > 0 && (
              <div className="max-h-64 overflow-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0"><tr>
                    <th className="p-2 text-left">{t("admin:renumber_col_current")}</th>
                    <th className="p-2 text-left">{t("admin:renumber_col_new")}</th>
                    <th className="p-2 text-left">{t("admin:renumber_col_created")}</th>
                    <th className="p-2 text-left">{t("admin:renumber_col_status")}</th>
                  </tr></thead>
                  <tbody>
                    {preview.orders.map((o) => (
                      <tr key={o.id} className={o.collision || !o.new_number ? "text-destructive" : ""}>
                        <td className="p-2 font-mono">{o.current_number ?? "–"}</td>
                        <td className="p-2 font-mono">{o.new_number ?? "> 9999"}</td>
                        <td className="p-2">{new Date(o.created_at).toLocaleString(dateFmt)}</td>
                        <td className="p-2">{o.workflow_status ?? o.status ?? "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!blocked && (
              <>
                <div className="space-y-2">
                  <Label>{t("admin:renumber_reason", { min: MIN_REASON_LENGTH })}</Label>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={confirmed} onCheckedChange={(c) => setConfirmed(c === true)} />
                  {t("admin:renumber_confirm", { count: preview.count })}
                </label>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={running}>{t("common:cancel")}</Button>
          <Button variant="destructive" onClick={execute} disabled={running || !canExecute(preview, reason, confirmed) || !isValidReason(reason)}>
            {running ? t("common:saving") : t("admin:renumber_execute")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
