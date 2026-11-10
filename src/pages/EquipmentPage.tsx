import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, ChevronRight, ArrowLeft, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import type { Equipment } from "@/lib/api/testEquipment";
import { equipmentStatus, currentChecks, type EquipmentCheck } from "@/lib/equipment/status";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EquipmentEditor } from "@/components/equipment/EquipmentEditor";
import { EquipmentCheckForm } from "@/components/equipment/EquipmentCheckForm";

function Status({ equipment }: { equipment: Equipment }) {
  const { t } = useTranslation("equipment");
  const status = equipmentStatus(equipment);
  return <Badge variant={status === "red" || status === "locked" ? "destructive" : "secondary"} className={status === "green" ? "bg-success text-success-foreground" : status === "yellow" ? "bg-warning text-warning-foreground" : undefined}>{t(status)}</Badge>;
}

export default function EquipmentPage() {
  const { t, i18n } = useTranslation("equipment");
  const { user, role } = useAuth();
  const { hasPermission } = usePermissions();
  const manage = role === "master" || hasPermission("equipment.manage");
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["equipment", user?.id], queryFn: api.testEquipment.list, enabled: Boolean(user) });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = query.data?.find(e => e.id === selectedId);
  const [editor, setEditor] = useState<Equipment | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("active");
  const [createOpen, setCreateOpen] = useState(false);
  const [assignee, setAssignee] = useState("__none__");
  const [dueDate, setDueDate] = useState("");
  const [action, setAction] = useState<"abort" | "maintenance" | "release_maintenance" | "lock" | "unlock" | "deactivate" | "reactivate" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [correction, setCorrection] = useState<EquipmentCheck | null>(null);
  const history = useQuery({ queryKey: ["equipment-history", selectedId], queryFn: () => selectedId ? api.testEquipment.history(selectedId) : Promise.resolve([]), enabled: Boolean(selectedId) });
  const audit = useQuery({ queryKey: ["equipment-audit", selectedId], queryFn: () => selectedId ? api.testEquipment.audit(selectedId) : Promise.resolve([]), enabled: Boolean(selectedId) });
  const context = useQuery({ queryKey: ["equipment-context", selectedId], queryFn: () => selectedId ? api.testEquipment.context(selectedId) : Promise.resolve(null), enabled: Boolean(selected?.active_measurement_id), refetchOnMount: "always" });
  const qualified = useQuery({ queryKey: ["equipment-qualified", selectedId], queryFn: () => selectedId ? api.testEquipment.qualifiedUsers(selectedId) : Promise.resolve([]), enabled: Boolean(selected) });
  const qualifiedSelf = qualified.data?.some(p => p.user_id === user?.id) ?? false;
  const isAssignee = Boolean(user && context.data?.assigned_to === user.id);
  const refresh = async () => { await Promise.all([qc.invalidateQueries({ queryKey: ["equipment"] }), qc.invalidateQueries({ queryKey: ["equipment-history"] }), qc.invalidateQueries({ queryKey: ["equipment-context"] }), qc.invalidateQueries({ queryKey: ["equipment-audit"] })]); };
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); setError(""); try { await fn(); await refresh(); } catch (err) { setError(err instanceof Error ? err.message : typeof err === "object" && err && "message" in err ? String(err.message) : t("error")); } finally { setBusy(false); } };
  const date = (value: string | null) => value ? new Intl.DateTimeFormat(i18n.language.startsWith("de") ? "de-AT" : "en-GB", { timeZone: "Europe/Vienna" }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value)) : "–";
  const leaves = new Set(currentChecks(history.data ?? []).map(c => c.id));
  if (query.isPending) return <p>{t("loading")}</p>;
  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" />{t("title")}</h1>{manage && !selected && <Button onClick={() => setEditor("new")}><Plus className="h-4 w-4 mr-2" />{t("new")}</Button>}</header>
    {(query.error || error) && <div role="alert" className="border border-destructive rounded-md p-3 text-destructive">{error || String(query.error)}{query.error && <Button variant="outline" onClick={() => query.refetch()}>{t("retry")}</Button>}</div>}
    {!selected ? <>
      <div className="flex flex-wrap items-center gap-3"><Input className="max-w-sm" aria-label={t("search")} placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} /><SearchableSelect triggerClassName="w-44" value={filter} onValueChange={setFilter} options={[{ value: "active", label: t("active") }, { value: "all", label: t("all") }, { value: "inactive", label: t("inactive") }]} /></div>
      <div className="overflow-x-auto border rounded-md"><Table><TableHeader><TableRow>{["name", "status", "responsible", "service", "interval", "due", "details"].map(key => <TableHead key={key}>{t(key)}</TableHead>)}</TableRow></TableHeader><TableBody>
        {(query.data ?? []).filter(e => (filter === "all" || (filter === "active") === e.active) && `${e.name} ${e.responsible_name ?? ""} ${e.measurement_services?.service_name ?? ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(e => <TableRow key={e.id}><TableCell className="font-medium">{e.name}</TableCell><TableCell><Status equipment={e} /></TableCell><TableCell>{e.responsible_name || t("none")}</TableCell><TableCell>{e.measurement_services?.service_name || t("none")}</TableCell><TableCell>{e.interval_days}</TableCell><TableCell>{date(e.next_due_date)}</TableCell><TableCell><Button variant="ghost" size="icon" title={t("details")} aria-label={`${t("details")}: ${e.name}`} onClick={() => setSelectedId(e.id)}><ChevronRight className="h-4 w-4" /></Button></TableCell></TableRow>)}
        {query.data?.length === 0 && <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">{t("empty")}</TableCell></TableRow>}
      </TableBody></Table></div>
    </> : <>
      <Button variant="ghost" onClick={() => { if (selected.active_measurement_id && !window.confirm(t("unsaved"))) return; setSelectedId(null); setCorrection(null); }}><ArrowLeft className="h-4 w-4 mr-2" />{t("all")}</Button>
      <section className="space-y-4"><div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold">{selected.name}</h2><Status equipment={selected} />{manage && <Button variant="outline" size="icon" title={t("edit")} aria-label={t("edit")} onClick={() => setEditor(selected)}><Pencil className="h-4 w-4" /></Button>}</div>
        <dl className="grid grid-cols-2 xl:grid-cols-4 gap-4">{[["service", selected.measurement_services?.service_name || t("none")], ["responsible", selected.responsible_name || t("none")], ["interval", String(selected.interval_days)], ["due", date(selected.next_due_date)]].map(([key, value]) => <div key={key}><dt className="text-sm text-muted-foreground">{t(key)}</dt><dd className="font-medium">{value}</dd></div>)}</dl>
        {selected.description && <p className="whitespace-pre-wrap">{selected.description}</p>}
        <div className="flex flex-wrap gap-2">
          {!selected.active_measurement_id && selected.active && selected.service_id && (manage || qualifiedSelf) && <Button onClick={() => { setAssignee(user?.id && qualifiedSelf ? user.id : "__none__"); setCreateOpen(true); }}>{t("create")}</Button>}
          {selected.active_measurement_id && (manage || isAssignee) && <Button variant="destructive" onClick={() => { setReason(""); setAction("abort"); }}>{t("abort")}</Button>}
          {manage && <>{([selected.maintenance ? "release_maintenance" : "maintenance", selected.manual_lock ? "unlock" : "lock", selected.active ? "deactivate" : "reactivate"] as const).map(a => <Button key={a} variant="outline" onClick={() => { setReason(""); setAction(a); }}>{t(a)}</Button>)}</>}
        </div>
      </section>
      {selected.active_measurement_id && context.isError && <p role="alert" className="text-destructive">{String(context.error)}</p>}
      {selected.active_measurement_id && isAssignee && qualifiedSelf && <section className="border-t pt-5 space-y-4">{context.data?.status === "open" && <Button variant="outline" disabled={busy} onClick={() => run(() => api.testEquipment.start(selected.id, selected.active_measurement_id ?? ""))}>{t("start")}</Button>}<EquipmentCheckForm key={selected.active_measurement_id} equipment={selected} onDone={refresh} /></section>}
      <section className="border-t pt-5 space-y-4"><h3 className="text-lg font-semibold">{t("history")}</h3>{history.isPending ? <p>{t("loading")}</p> : history.error ? <p role="alert">{String(history.error)}</p> : !history.data?.length ? <p className="text-muted-foreground">{t("no_history")}</p> : <div className="space-y-4">{history.data.map(check => <article key={check.id} className="border rounded-md p-4 space-y-2"><div className="flex flex-wrap justify-between gap-2"><div className="flex flex-wrap gap-2 items-center"><strong>{date(check.performed_at)}</strong><Badge variant={check.status === "bestanden" ? "default" : "destructive"}>{t(check.status === "bestanden" ? "passed" : "failed")}</Badge><span>{t("version")} {check.version}</span>{leaves.has(check.id) && <span className="text-sm text-muted-foreground">{t("current")}</span>}</div>{leaves.has(check.id) && (role === "master" || check.performed_by === user?.id) && <Button variant="outline" size="sm" onClick={() => setCorrection(check)}>{t("correct")}</Button>}</div><p className="text-sm text-muted-foreground">{check.performed_by_name} · {t("interval")}: {check.interval_days}</p><p className="whitespace-pre-wrap">{check.result_summary}</p>{check.notes && <p className="whitespace-pre-wrap">{check.notes}</p>}{check.correction_reason && <p>{t("reason")}: {check.correction_reason}</p>}<details><summary className="cursor-pointer text-sm text-primary">{t("values")}</summary><pre className="whitespace-pre-wrap break-words text-xs bg-muted rounded-md p-3 mt-2">{JSON.stringify(check.values, null, 2)}</pre></details></article>)}</div>}</section>
      <section className="border-t pt-5 space-y-3"><h3 className="text-lg font-semibold">{t("audit")}</h3>{audit.error && <p role="alert">{String(audit.error)}</p>}{audit.data?.map(event => <div key={event.id} className="border-b py-2"><p className="text-sm">{date(event.created_at)} · {t(event.event_type)}</p>{Boolean(event.metadata.reason) && <p className="whitespace-pre-wrap">{String(event.metadata.reason)}</p>}</div>)}</section>
    </>}
    {editor && <EquipmentEditor equipment={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSave={async input => { await api.testEquipment.save(editor === "new" ? null : editor.id, input); setEditor(null); await refresh(); }} />}
    {selected && createOpen && <Dialog open onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>{t("create")}</DialogTitle></DialogHeader><Label>{t("assignee")}</Label><SearchableSelect value={assignee} onValueChange={setAssignee} options={[{ value: "__none__", label: t("none") }, ...(qualified.data ?? []).filter(p => manage || p.user_id === user?.id).map(p => ({ value: p.user_id, label: `${p.first_name} ${p.last_name}` }))]} emptyText={t("qualified_missing")} searchPlaceholder={t("search")} /><Label htmlFor="check-due">{t("due")}</Label><Input id="check-due" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />{error && <p role="alert" className="text-destructive">{error}</p>}<Button disabled={busy || assignee === "__none__"} onClick={() => run(async () => { await api.testEquipment.createCheck(selected.id, assignee, dueDate || null); setCreateOpen(false); })}>{t("create")}</Button></DialogContent></Dialog>}
    {selected && action && <Dialog open onOpenChange={open => { if (!open && !busy) setAction(null); }}><DialogContent><DialogHeader><DialogTitle>{t(action)}</DialogTitle></DialogHeader><Label htmlFor="state-reason">{t("reason")}</Label><Textarea id="state-reason" value={reason} onChange={e => setReason(e.target.value)} />{error && <p role="alert" className="text-destructive">{error}</p>}<Button disabled={busy || !reason.trim()} onClick={() => run(async () => { if (action === "abort") await api.testEquipment.cancel(selected.id, selected.active_measurement_id ?? "", reason); else await api.testEquipment.state(selected.id, action, reason); setAction(null); })}>{t("confirmation")}</Button></DialogContent></Dialog>}
    {selected && correction && <Dialog open onOpenChange={open => { if (!open && window.confirm(t("unsaved"))) setCorrection(null); }}><DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{t("correction")} · {selected.name}</DialogTitle></DialogHeader><EquipmentCheckForm key={correction.id} equipment={selected} correction={correction} onDone={async () => { setCorrection(null); await refresh(); }} /></DialogContent></Dialog>}
  </div>;
}