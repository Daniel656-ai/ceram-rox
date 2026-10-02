import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { ChevronDown, ChevronRight, PlayCircle } from "lucide-react";

/**
 * Gruppenschlüssel des Messarbeitsplatzes – dynamisch aus vorhandenen Daten:
 * 1. Arbeitsplatz der Messung, 2. Standard-Arbeitsplatz der Dienstleistung,
 * 3. Fallback: Dienstleistung. Keine fest codierte Verfahrensliste.
 */
function runGroupOf(m: any): { key: string; label: string; isWorkstation: boolean } {
  const ws = m.workstations ?? m.measurement_services?.workstations;
  if (ws?.id) return { key: `ws:${ws.id}`, label: ws.name || "Arbeitsplatz", isWorkstation: true };
  const name = m.measurement_services?.service_name || "Ohne Dienstleistung";
  return { key: `svc:${m.service_id ?? name}`, label: name, isWorkstation: false };
}

/**
 * Temporäre Zusammenstellung eines Messdurchlaufs aus den EIGENEN zugewiesenen
 * Aufgaben. Die Auswahl lebt nur im Seitenzustand; sie wird nicht gespeichert.
 * Beliebig viele Proben aus beliebig vielen Aufträgen.
 */
export default function MeasurementRunPicker({ tasks }: { tasks: any[] }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; isWorkstation: boolean; items: any[] }>();
    for (const m of tasks) {
      if (m.status === "completed") continue;
      const g = runGroupOf(m);
      if (!map.has(g.key)) map.set(g.key, { label: g.label, isWorkstation: g.isWorkstation, items: [] });
      map.get(g.key)!.items.push(m);
    }
    return [...map.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label, "de"));
  }, [tasks]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleGroup = (items: any[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const all = items.every((m) => next.has(m.id));
      for (const m of items) {
        if (all) next.delete(m.id);
        else next.add(m.id);
      }
      return next;
    });

  const start = () => {
    // Reihenfolge wie angezeigt.
    const ids = groups.flatMap(([, g]) => g.items.map((m) => m.id)).filter((id) => selected.has(id));
    if (ids.length === 0) return;
    navigate(`/aufgaben/${ids[0]}?run=${ids.join(",")}`);
  };

  if (groups.length === 0) return null;

  return (
    <Card>
      <CardHeader className="py-3 flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="text-base">Messdurchlauf nach Arbeitsplatz</CardTitle>
        <Button size="sm" onClick={start} disabled={selected.size === 0}>
          <PlayCircle className="h-4 w-4 mr-2" />
          Messdurchlauf starten ({selected.size} {selected.size === 1 ? "Probe" : "Proben"} ausgewählt)
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Wähle beliebig viele deiner offenen Aufgaben – auch aus verschiedenen Aufträgen. Die Auswahl ist nur eine
          vorübergehende Arbeitszusammenstellung. Freie Aufträge bitte zuerst unten übernehmen.
        </p>
        {groups.map(([key, g]) => {
          const isOpen = open[key] ?? false;
          const allSel = g.items.every((m) => selected.has(m.id));
          const someSel = g.items.some((m) => selected.has(m.id));
          return (
            <div key={key} className="border rounded-md">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/40">
                <Checkbox
                  checked={allSel ? true : someSel ? "indeterminate" : false}
                  onCheckedChange={() => toggleGroup(g.items)}
                  aria-label={`Alle in ${g.label} auswählen`}
                />
                <button
                  type="button"
                  className="flex items-center gap-1 flex-1 text-left text-sm font-medium"
                  onClick={() => setOpen((p) => ({ ...p, [key]: !isOpen }))}
                >
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {g.label}
                  {!g.isWorkstation && (
                    <span className="text-xs font-normal text-muted-foreground">(kein Arbeitsplatz hinterlegt)</span>
                  )}
                </button>
                <Badge variant="outline">{g.items.length}</Badge>
              </div>
              {isOpen && (
                <div className="divide-y">
                  {g.items.map((m) => (
                    <label key={m.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/30">
                      <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggle(m.id)} />
                      <span className="font-mono w-28">{m.samples?.sample_number || "–"}</span>
                      <span className="flex-1 truncate">
                        {m.samples?.sample_name || ""}
                        <span className="text-muted-foreground"> · {m.measurement_services?.service_name || "–"}</span>
                      </span>
                      <span className="font-mono text-muted-foreground">{m.measurement_orders?.order_number || "–"}</span>
                      <span className="text-muted-foreground w-24 truncate">{m.measurement_orders?.projects?.project_number || ""}</span>
                      <PriorityBadge ranking={m.ranking ?? m.measurement_orders?.ranking} />
                      <span className="w-24 text-muted-foreground">
                        {m.due_date ? new Date(m.due_date).toLocaleDateString("de-AT") : "–"}
                      </span>
                      <StatusBadge status={m.status} />
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
