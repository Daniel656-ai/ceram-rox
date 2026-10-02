import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useUsers } from "@/hooks/useUsers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, History, Plus, Trash2 } from "lucide-react";

/**
 * Nachträgliche Änderungen an Auftraggeber-Vorgaben.
 * Operativer Wert: measurement_parameters. Historie: activity_log
 * (event_type „order_spec_updated"), geschrieben ausschließlich atomar über
 * die Datenbankfunktion amend_order_spec.
 */

export const SPEC_EVENT = "order_spec_updated";

export const specLabel = (name: string) => String(name || "").replace(/^repeat:/, "");

/** Ereignisse je parameter_id, älteste zuerst. */
export function groupSpecChanges(events: any[]): Map<string, any[]> {
  const map = new Map<string, any[]>();
  for (const e of events || []) {
    if (e?.event_type !== SPEC_EVENT) continue;
    const pid = e.metadata?.parameter_id;
    if (!pid) continue;
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid)!.push(e);
  }
  for (const list of map.values()) {
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
  return map;
}

const fmtVal = (v: unknown): string => {
  if (v == null || v === "") return "–";
  if (v === true || v === "true") return "Ja";
  if (v === false || v === "false") return "Nein";
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .filter(([k, x]) => !k.startsWith("__") && x != null && x !== "")
      .map(([k, x]) => `${k}: ${fmtVal(x)}`)
      .join(", ") || "–";
  }
  return String(v);
};

/** Kompakte, menschenlesbare Beschreibung eines Änderungsereignisses. */
export function describeSpecChange(meta: any): string[] {
  if (!meta) return [];
  const unit = meta.unit ? ` ${meta.unit}` : "";
  const items: any[] = Array.isArray(meta.items) ? meta.items : [];
  if (String(meta.parameter_name || "").startsWith("repeat:")) {
    if (items.length === 0) return ["Liste geändert"];
    return items.map((i) => {
      if (i.change === "added") return `Eintrag ergänzt: ${fmtVal(i.new)}`;
      if (i.change === "removed") return `Eintrag entfernt: ${fmtVal(i.old)}`;
      return `Eintrag geändert: ${fmtVal(i.old)} → ${fmtVal(i.new)}`;
    });
  }
  return [`${fmtVal(meta.old_value)}${meta.old_value ? unit : ""} → ${fmtVal(meta.new_value)}${meta.new_value ? unit : ""}`];
}

export function specChangeBadgeText(changes: any[]): string {
  const allAdded = changes.every((c) => c.metadata?.change_type === "item_added");
  return allAdded ? "Nachträglich ergänzt" : "Nachträglich geändert";
}

/** Aufklappbare Änderungshistorie eines Parameters (chronologisch). */
export function SpecChangeHistory({
  changes,
  title,
}: {
  changes: any[];
  title?: string;
}) {
  const { data: users = [] } = useUsers();
  const name = (id?: string | null) => {
    const u = (users as any[]).find((x) => x.user_id === id);
    return u ? `${u.first_name || ""} ${u.last_name || ""}`.trim() || "–" : "–";
  };
  if (!changes.length) return null;
  const first = changes[0]?.metadata;
  const isRepeat = String(first?.parameter_name || "").startsWith("repeat:");
  return (
    <Collapsible>
      <CollapsibleTrigger className="inline-flex items-center gap-1 text-xs">
        <Badge variant="outline" className="border-warning text-foreground bg-warning/15 gap-1 font-normal">
          <History className="h-3 w-3" />
          {title ?? specChangeBadgeText(changes)} ({changes.length})
          <ChevronDown className="h-3 w-3" />
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {!isRepeat && (
          <p className="text-xs text-muted-foreground">
            Ursprünglich: <span className="font-medium text-foreground">{fmtVal(first?.old_value)}{first?.old_value && first?.unit ? ` ${first.unit}` : ""}</span>
          </p>
        )}
        <ol className="space-y-2 border-l pl-3">
          {changes.map((c) => (
            <li key={c.id} className="text-xs">
              {describeSpecChange(c.metadata).map((l, i) => (
                <div key={i} className="font-medium">{l}</div>
              ))}
              <div className="text-muted-foreground">
                geändert durch {name(c.actor_user_id)} am {new Date(c.created_at).toLocaleString("de-AT")}
              </div>
              {c.metadata?.reason && (
                <div className="text-muted-foreground">Begründung: „{c.metadata.reason}"</div>
              )}
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}

const parseArray = (raw: unknown): Record<string, unknown>[] => {
  if (typeof raw !== "string") return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : [];
  } catch {
    return [];
  }
};

const newId = () =>
  (globalThis.crypto as any)?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export type AmendableParam = {
  id: string;
  parameter_name: string;
  parameter_value: string | null;
  unit: string | null;
  sampleNumber?: string | null;
};

/** Dialog „Vorgabe ändern" bzw. „Einträge ergänzen / bearbeiten". */
export function SpecAmendDialog({
  open,
  onOpenChange,
  params,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Mehrere Einträge = gleiche Vorgabe bei mehreren Proben; Auswahl im Dialog. */
  params: AmendableParam[];
  onSaved: () => void;
}) {
  const [paramId, setParamId] = useState<string>(params[0]?.id ?? "");
  const param = params.find((p) => p.id === paramId) ?? params[0];
  const isRepeat = String(param?.parameter_name || "").startsWith("repeat:");
  const [value, setValue] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setParamId((cur) => (params.some((p) => p.id === cur) ? cur : params[0]?.id ?? ""));
  }, [open, params]);

  useEffect(() => {
    if (!open || !param) return;
    setValue(param.parameter_value ?? "");
    setRows(parseArray(param.parameter_value));
    setReason("");
  }, [open, param?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const cols = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => Object.keys(r).filter((k) => !k.startsWith("__"))))),
    [rows]
  );

  if (!param) return null;

  const save = async () => {
    if (!reason.trim()) {
      toast.error("Bitte eine Begründung angeben");
      return;
    }
    const next = isRepeat
      ? JSON.stringify(rows.map((r) => (r.__id ? r : { ...r, __id: newId() })))
      : value;
    if (next === (param.parameter_value ?? "")) {
      toast.error("Es wurde nichts geändert");
      return;
    }
    setSaving(true);
    try {
      await api.measurementParameters.amend(param.id, next, reason.trim(), specLabel(param.parameter_name));
      toast.success("Vorgabe geändert und im Verlauf dokumentiert");
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error("Änderung nicht gespeichert", { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isRepeat ? "Einträge ergänzen / bearbeiten" : "Vorgabe ändern"}: {specLabel(param.parameter_name)}</DialogTitle>
          <DialogDescription>
            Der bisherige Wert bleibt im Änderungsverlauf erhalten. Eine Begründung ist erforderlich.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {params.length > 1 && (
            <div className="space-y-1">
              <Label>Probe</Label>
              <div className="flex flex-wrap gap-2">
                {params.map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    size="sm"
                    variant={p.id === param.id ? "default" : "outline"}
                    onClick={() => setParamId(p.id)}
                  >
                    {p.sampleNumber || "ohne Probe"}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {!isRepeat ? (
            <>
              <div className="space-y-1">
                <Label>Bisheriger Wert</Label>
                <p className="text-sm">{fmtVal(param.parameter_value)}{param.unit ? ` ${param.unit}` : ""}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="spec-new">Neuer Wert{param.unit ? ` (${param.unit})` : ""}</Label>
                <Input id="spec-new" value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label>Einträge</Label>
              <div className="overflow-x-auto border rounded">
                <table className="text-xs w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-2 py-1 text-left">#</th>
                      {cols.map((c) => <th key={c} className="px-2 py-1 text-left">{c}</th>)}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={String(r.__id ?? i)} className="border-t">
                        <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                        {cols.map((c) => (
                          <td key={c} className="px-1 py-1">
                            <Input
                              className="h-7 text-xs"
                              value={r[c] == null ? "" : typeof r[c] === "object" ? JSON.stringify(r[c]) : String(r[c])}
                              onChange={(e) =>
                                setRows((prev) => prev.map((x, j) => (j === i ? { ...x, [c]: e.target.value } : x)))
                              }
                            />
                          </td>
                        ))}
                        <td className="px-1">
                          <Button
                            type="button" size="icon" variant="ghost" className="h-7 w-7"
                            aria-label="Eintrag entfernen"
                            onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                type="button" size="sm" variant="outline" disabled={cols.length === 0}
                onClick={() =>
                  setRows((prev) => [...prev, { __id: newId(), ...Object.fromEntries(cols.map((c) => [c, ""])) }])
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Eintrag ergänzen
              </Button>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="spec-reason">Begründung *</Label>
            <Textarea id="spec-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Abbrechen</Button>
          <Button onClick={save} disabled={saving || !reason.trim()}>{saving ? "Speichere…" : "Speichern"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
