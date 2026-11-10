import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import type { Equipment } from "@/lib/api/testEquipment";
import type { EquipmentCheck } from "@/lib/equipment/status";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import ServiceLinkedForms from "@/components/ServiceLinkedForms";
import ServiceBookingForm from "@/components/ServiceBookingForm";
import { useRefreshGuard } from "@/lib/refreshGuard";

export function EquipmentCheckForm({ equipment, correction, onDone }: { equipment: Equipment; correction?: EquipmentCheck; onDone: () => Promise<void> }) {
  const { t } = useTranslation("equipment");
  const { data: context, isLoading, isFetchedAfterMount, error: loadError, refetch } = useQuery({ queryKey: ["equipment-context", equipment.id], queryFn: () => api.testEquipment.context(equipment.id), enabled: !correction, refetchOnMount: "always" });
  const [values, setValues] = useState<Record<string, unknown>>(correction?.values ?? {});
  const [summary, setSummary] = useState(correction?.result_summary ?? "");
  const [notes, setNotes] = useState(correction?.notes ?? "");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState(correction?.status ?? "bestanden");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(Boolean(correction));
  const dirtyRef = useRef(false);
  useEffect(() => { if (context && isFetchedAfterMount && !dirtyRef.current) { setValues(context.values); setSummary(String(context.values.__check_summary ?? "")); setNotes(String(context.values.__check_notes ?? "")); setStatus(context.values.__check_status === "nicht_bestanden" ? "nicht_bestanden" : "bestanden"); setHydrated(true); } }, [context, isFetchedAfterMount]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", handler); return () => window.removeEventListener("beforeunload", handler);
  }, []);
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (link && dirtyRef.current && !window.confirm(t("unsaved"))) { event.preventDefault(); event.stopPropagation(); }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [t]);
  const markDirty = () => { dirtyRef.current = true; setDirty(true); };
  const saveDraft = async () => { if (correction || !hydrated) return; await api.testEquipment.saveDraft(equipment.id, { ...values, __check_summary: summary, __check_notes: notes, __check_status: status }); dirtyRef.current = false; setDirty(false); };
  useRefreshGuard(async () => { if (dirtyRef.current) { if (correction) throw new Error(t("dirty")); await saveDraft(); } });
  if (loadError) return <div role="alert">{String(loadError)}<Button onClick={() => refetch()}>{t("retry")}</Button></div>;
  if (!correction && (isLoading || !hydrated)) return <p>{t("loading")}</p>;
  if (!correction && !context) return null;
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{t(correction ? "correction" : "open_check")}</h3><span className="text-sm text-muted-foreground">{t(dirty ? "dirty" : "saved")}</span></div>
    {context && <p className="text-sm text-muted-foreground">{context.order_number} · {context.measurement_number}</p>}
    {(correction?.service_id ?? equipment.service_id) && <>
      <ServiceBookingForm serviceId={correction?.service_id ?? equipment.service_id ?? ""} roleView="employee" values={values} onChange={(key, value) => { markDirty(); setValues(previous => ({ ...previous, [key]: value })); }} />
      <ServiceLinkedForms serviceId={correction?.service_id ?? equipment.service_id ?? ""} context="employee" values={values} onChange={(key, value) => { markDirty(); setValues(previous => ({ ...previous, [key]: value })); }} linkSourcesReady={hydrated} />
    </>}
    <div className="space-y-1"><Label>{t("result")}</Label><SearchableSelect value={status} onValueChange={value => { markDirty(); setStatus(value as typeof status); }} options={[{ value: "bestanden", label: t("passed") }, { value: "nicht_bestanden", label: t("failed") }]} /></div>
    <div className="space-y-1"><Label htmlFor="check-summary">{t("summary")}</Label><Textarea id="check-summary" required value={summary} onChange={e => { markDirty(); setSummary(e.target.value); }} /></div>
    <div className="space-y-1"><Label htmlFor="check-notes">{t("notes")}</Label><Textarea id="check-notes" value={notes} onChange={e => { markDirty(); setNotes(e.target.value); }} /></div>
    {correction && <div className="space-y-1"><Label htmlFor="check-reason">{t("reason")}</Label><Textarea id="check-reason" required value={reason} onChange={e => { markDirty(); setReason(e.target.value); }} /></div>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2">
      {!correction && <Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { await saveDraft(); } catch (err) { setError(err instanceof Error ? err.message : t("error")); } finally { setBusy(false); } }}>{t("save")}</Button>}
      <Button disabled={busy || !summary.trim() || (Boolean(correction) && !reason.trim())} onClick={async () => { setBusy(true); setError(""); try { if (correction) await api.testEquipment.correct(correction.id, status, summary, notes, reason, values); else await api.testEquipment.record(equipment.id, status, summary, notes, values); dirtyRef.current = false; setDirty(false); await onDone(); } catch (err) { setError(err instanceof Error ? err.message : t("error")); } finally { setBusy(false); } }}>{t(correction ? "save" : "finish")}</Button>
    </div>
  </div>;
}