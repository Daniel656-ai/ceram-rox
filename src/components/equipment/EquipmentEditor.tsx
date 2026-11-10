import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import type { Equipment, EquipmentInput } from "@/lib/api/testEquipment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function EquipmentEditor({ equipment, onClose, onSave }: { equipment?: Equipment; onClose: () => void; onSave: (input: EquipmentInput) => Promise<void> }) {
  const { t } = useTranslation("equipment");
  const [input, setInput] = useState<EquipmentInput>({ name: equipment?.name ?? "", description: equipment?.description ?? "", service_id: equipment?.service_id ?? null, responsible_user_id: equipment?.responsible_user_id ?? null, responsible_name: equipment?.responsible_name ?? "", interval_days: equipment?.interval_days ?? 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const { data: services = [] } = useQuery({ queryKey: ["equipment-services"], queryFn: api.measurementServices.listActive });
  const { data: users = [] } = useQuery({ queryKey: ["equipment-users"], queryFn: api.measurementUsers.listDurchfuehrer });
  const update = (value: Partial<EquipmentInput>) => { setDirty(true); setInput(previous => ({ ...previous, ...value })); };
  const close = () => { if (!busy && (!dirty || window.confirm(t("unsaved")))) onClose(); };
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent><DialogHeader><DialogTitle>{t(equipment ? "edit" : "new")}</DialogTitle></DialogHeader>
    <form className="space-y-4" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try { await onSave(input); } catch (err) { setError(err instanceof Error ? err.message : t("error")); } finally { setBusy(false); } }}>
      <div className="space-y-1"><Label htmlFor="equipment-name">{t("name")}</Label><Input id="equipment-name" required value={input.name} onChange={e => update({ name: e.target.value })} /></div>
      <div className="space-y-1"><Label htmlFor="equipment-interval">{t("interval")}</Label><Input id="equipment-interval" type="number" min={1} step={1} required value={input.interval_days || ""} onChange={e => update({ interval_days: Number(e.target.value) })} /></div>
      <div className="space-y-1"><Label>{t("service")}</Label><SearchableSelect value={input.service_id ?? "__none__"} onValueChange={value => update({ service_id: value === "__none__" ? null : value })} options={[{ value: "__none__", label: t("none") }, ...services.map(s => ({ value: s.id, label: s.service_name }))]} searchPlaceholder={t("search")} emptyText={t("none")} /></div>
      <div className="space-y-1"><Label>{t("responsible")}</Label><SearchableSelect value={input.responsible_user_id ?? "__none__"} onValueChange={value => { const person = users.find(p => p.user_id === value); update({ responsible_user_id: person?.user_id ?? null, responsible_name: person ? `${person.first_name} ${person.last_name}` : input.responsible_name }); }} options={[{ value: "__none__", label: t("none") }, ...users.map(p => ({ value: p.user_id, label: `${p.first_name} ${p.last_name}` }))]} searchPlaceholder={t("search")} emptyText={t("none")} /></div>
      <div className="space-y-1"><Label htmlFor="equipment-responsible">{t("responsible_name")}</Label><Input id="equipment-responsible" value={input.responsible_name ?? ""} onChange={e => update({ responsible_name: e.target.value })} /></div>
      <div className="space-y-1"><Label htmlFor="equipment-description">{t("description")}</Label><Textarea id="equipment-description" value={input.description ?? ""} onChange={e => update({ description: e.target.value })} /></div>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close} disabled={busy}>{t("cancel")}</Button><Button type="submit" disabled={busy || !input.name.trim() || !Number.isInteger(input.interval_days) || input.interval_days < 1}>{t("save")}</Button></div>
    </form>
  </DialogContent></Dialog>;
}