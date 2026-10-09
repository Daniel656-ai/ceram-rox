import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
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

type Item = any & { __free: boolean; __blocked?: string | null };

/**
 * Temporäre Zusammenstellung eines Messdurchlaufs aus eigenen zugewiesenen
 * UND freien, laut Kompetenzmatrix qualifizierten Aufgaben. Die Auswahl lebt
 * nur im Seitenzustand – Auswählen ändert keine Zuweisung. Beim Start werden
 * freie Aufgaben über die bestehende Übernahme (claim_measurement) übernommen;
 * nicht übernehmbare werden gemeldet und nicht in den Durchlauf aufgenommen.
 * `otherTasks` (fremd zugewiesen / ohne Qualifikation) sind nur sichtbar.
 */
export default function MeasurementRunPicker({
  tasks,
  freeTasks = [],
  otherTasks = [],
  claim,
}: {
  tasks: any[];
  freeTasks?: any[];
  otherTasks?: any[];
  claim?: (id: string) => Promise<unknown>;
}) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [starting, setStarting] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; isWorkstation: boolean; items: Item[] }>();
    const seen = new Set<string>();
    const add = (m: any, free: boolean, blocked: string | null = null) => {
      if (m.status === "completed" || seen.has(m.id)) return;
      seen.add(m.id);
      const g = runGroupOf(m);
      if (!map.has(g.key)) map.set(g.key, { label: g.label, isWorkstation: g.isWorkstation, items: [] });
      map.get(g.key)!.items.push({ ...m, __free: free, __blocked: blocked });
    };
    for (const m of tasks) add(m, false);
    if (claim) for (const m of freeTasks) add(m, true);
    for (const m of otherTasks)
      add(m, false, m.assigned_to ? `Zugewiesen: ${m.__assigneeName || "anderer Mitarbeiter"}` : "Keine Qualifikation");
    return [...map.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label, "de"));
  }, [tasks, freeTasks, otherTasks, claim]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleGroup = (items: Item[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const all = items.every((m) => next.has(m.id));
      for (const m of items) {
        if (all) next.delete(m.id);
        else next.add(m.id);
      }
      return next;
    });

  const start = async () => {
    // Reihenfolge wie angezeigt.
    const chosen = groups.flatMap(([, g]) => g.items).filter((m) => selected.has(m.id));
    if (chosen.length === 0) return;
    setStarting(true);
    const ok: string[] = [];
    const failed: string[] = [];
    try {
      for (const m of chosen) {
        if (!m.__free) {
          ok.push(m.id);
          continue;
        }
        try {
          await claim!(m.id);
          ok.push(m.id);
        } catch (err: any) {
          const msg = String(err?.message || "");
          const label = `${m.samples?.sample_number || m.measurement_number} (${m.measurement_orders?.order_number || "–"})`;
          const reason = msg.includes("already assigned")
            ? "inzwischen von einem anderen Mitarbeiter übernommen"
            : msg.includes("already completed")
              ? "bereits abgeschlossen"
              : msg.includes("not qualified")
                ? "keine Qualifikation"
                : msg || "Übernahme fehlgeschlagen";
          failed.push(`${label}: ${reason}`);
        }
      }
    } finally {
      setStarting(false);
    }
    if (failed.length > 0) {
      toast.warning(
        `${failed.length} ${failed.length === 1 ? "Probe ist" : "Proben sind"} nicht mehr verfügbar und ${failed.length === 1 ? "wurde" : "wurden"} nicht in den Messdurchlauf aufgenommen`,
        { description: failed.join("\n"), duration: 10000 },
      );
    }
    if (ok.length === 0) return;
    setSelected(new Set());
    navigate(`/aufgaben/${ok[0]}?run=${ok.join(",")}`);
  };

  if (groups.length === 0) return null;

  return (
    <Card>
      <CardHeader className="py-3 flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="text-base">Messdurchlauf nach Arbeitsplatz</CardTitle>
        <Button size="sm" onClick={start} disabled={selected.size === 0 || starting}>
          <PlayCircle className="h-4 w-4 mr-2" />
          {starting
            ? "Übernehme Aufgaben…"
            : `Messdurchlauf starten (${selected.size} ${selected.size === 1 ? "Probe" : "Proben"} ausgewählt)`}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Wähle beliebig viele Proben – auch aus verschiedenen Aufträgen. „Verfügbar" markierte Aufgaben werden beim
          Start automatisch übernommen. Die Auswahl selbst ist nur eine vorübergehende Arbeitszusammenstellung.
        </p>
        {groups.map(([key, g]) => {
          const isOpen = open[key] ?? false;
          const allSel = g.items.every((m) => selected.has(m.id));
          const someSel = g.items.some((m) => selected.has(m.id));
          const freeCount = g.items.filter((m) => m.__free).length;
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
                {freeCount > 0 && <Badge variant="secondary">{freeCount} verfügbar</Badge>}
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
                      <Badge variant={m.__free ? "secondary" : "outline"} className="w-28 justify-center">
                        {m.__free ? "Verfügbar" : "Mir zugewiesen"}
                      </Badge>
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
