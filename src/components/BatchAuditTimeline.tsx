import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Scale, Pencil, PlayCircle, CheckCircle2, Download } from "lucide-react";
import { formatQuantity } from "@/lib/formatQuantity";
import { useBatchWeighings, useBatchCorrections } from "@/hooks/useMixtures";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batch: any;
}

type Event = {
  id: string;
  ts: string;
  kind: "weighing" | "correction" | "status";
  icon: any;
  title: string;
  detail: string;
  who?: string;
  raw?: any;
};

export function BatchAuditTimeline({ open, onOpenChange, batch }: Props) {
  const { data: weighings = [] } = useBatchWeighings(batch?.id);
  const { data: corrections = [] } = useBatchCorrections(batch?.id);
  const [filter, setFilter] = useState<"all" | Event["kind"]>("all");
  const [q, setQ] = useState("");

  const events = useMemo<Event[]>(() => {
    const list: Event[] = [];

    // Batch lifecycle
    if (batch?.created_at) {
      list.push({
        id: `b-created-${batch.id}`,
        ts: batch.created_at,
        kind: "status",
        icon: PlayCircle,
        title: "Charge angelegt",
        detail: `Charge ${batch.batch_number ?? ""}`,
      });
    }
    if (batch?.status === "abgeschlossen" && batch?.completed_at) {
      list.push({
        id: `b-done-${batch.id}`,
        ts: batch.completed_at,
        kind: "status",
        icon: CheckCircle2,
        title: "Charge abgeschlossen",
        detail: `${formatQuantity(batch.produced_quantity)} ${batch.unit ?? ""} gebucht`,
      });
    }

    for (const w of weighings as any[]) {
      list.push({
        id: `w-${w.id}`,
        ts: w.weighed_at ?? w.created_at,
        kind: "weighing",
        icon: Scale,
        title: `Verwiegung: ${w.raw_materials?.material_name ?? "Rohstoff"}`,
        detail: `Ist ${formatQuantity(w.actual_quantity)} ${w.unit}${
          w.target_quantity != null ? ` (Soll ${formatQuantity(w.target_quantity)})` : ""
        }${w.container_code_snapshot ? ` · ${w.container_code_snapshot}` : ""}${
          w.notes ? ` · ${w.notes}` : ""
        }`,
        who: w.profiles ? `${w.profiles.first_name} ${w.profiles.last_name}` : undefined,
        raw: w,
      });
    }

    for (const c of corrections as any[]) {
      list.push({
        id: `c-${c.id}`,
        ts: c.created_at,
        kind: "correction",
        icon: Pencil,
        title: `Korrektur: ${c.field}`,
        detail: `${c.old_value ?? "—"} → ${c.new_value ?? "—"}${
          c.delta != null ? ` (Δ ${formatQuantity(c.delta)})` : ""
        } · ${c.reason ?? ""}`,
        who: c.profiles ? `${c.profiles.first_name} ${c.profiles.last_name}` : undefined,
        raw: c,
      });
    }

    return list
      .filter((e) => !!e.ts)
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [batch, weighings, corrections]);

  const filtered = events.filter((e) => {
    if (filter !== "all" && e.kind !== filter) return false;
    if (q && !(`${e.title} ${e.detail} ${e.who ?? ""}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  const exportCsv = () => {
    const rows = [["Zeitpunkt", "Typ", "Titel", "Detail", "Benutzer"]];
    for (const e of filtered) {
      rows.push([
        format(new Date(e.ts), "yyyy-MM-dd HH:mm:ss"),
        e.kind,
        e.title,
        e.detail,
        e.who ?? "",
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-${batch?.batch_number ?? batch?.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Audit-Trail – Charge {batch?.batch_number}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 items-center mb-3">
          <Input
            placeholder="Suche…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-48"
          />
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Ereignisse</SelectItem>
              <SelectItem value="weighing">Verwiegungen</SelectItem>
              <SelectItem value="correction">Korrekturen</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground">{filtered.length} Ereignisse</div>
          <div className="ml-auto">
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="h-3 w-3 mr-1" /> CSV
            </Button>
          </div>
        </div>

        <ol className="relative border-l border-border ml-2 space-y-3">
          {filtered.map((e) => {
            const Icon = e.icon;
            return (
              <li key={e.id} className="ml-4">
                <span className="absolute -left-2.5 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-background border">
                  <Icon className="h-3 w-3 text-muted-foreground" />
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(e.ts), "dd.MM.yyyy HH:mm")}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{e.kind}</Badge>
                  <span className="text-sm font-medium">{e.title}</span>
                </div>
                <div className="text-sm text-muted-foreground">{e.detail}</div>
                {e.who && <div className="text-xs text-muted-foreground italic">von {e.who}</div>}
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="text-sm text-muted-foreground ml-4">Keine Ereignisse gefunden.</li>
          )}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
