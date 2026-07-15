import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Search, Trash2, Plus, Lock } from "lucide-react";

/**
 * Zuordnung von Projekt-Arbeitspaketen zu einem Portfolio-Arbeitspaket
 * oder einem Portfolio-Task (jeweils 1:1 — je Projekt-AP nur eine Zuordnung).
 */
type Target =
  | { kind: "wp"; portfolioWpId: string; title: string }
  | { kind: "task"; portfolioTaskId: string; portfolioWpId: string; portfolioWpTitle: string; title: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: Target | null;
  canManage: boolean;
  portfolioId: string;
}

export default function PortfolioProjectWpMappingDialog({ open, onOpenChange, target, canManage, portfolioId }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const queryKey =
    target?.kind === "wp"
      ? ["portfolio-wp-map", target.portfolioWpId]
      : target?.kind === "task"
        ? ["portfolio-task-map", target.portfolioTaskId]
        : ["portfolio-map-noop"];

  const { data: mappings = [] } = useQuery({
    queryKey,
    queryFn: () => {
      if (!target) return [] as any[];
      return target.kind === "wp"
        ? api.portfolioWpProjectMap.listByPortfolioWp(target.portfolioWpId)
        : api.portfolioTaskProjectMap.listByPortfolioTask(target.portfolioTaskId);
    },
    enabled: !!target && open,
  });

  // Nur Projekt-APs, deren Projekt Mitglied des Portfolios ist (und aktiv).
  const { data: allProjectWps = [] } = useQuery({
    queryKey: ["project-wps-for-portfolio", portfolioId],
    queryFn: () => api.projectWorkPackagesLookup.listForPortfolio(portfolioId, { activeOnly: true }),
    enabled: open && !!portfolioId,
  });

  // Alle bestehenden Zuordnungen (global) — für Sperrung bereits vergebener Projekt-APs
  const { data: allWpAssignments = [] } = useQuery({
    queryKey: ["portfolio-wp-map-all"],
    queryFn: () => api.projectWorkPackagesLookup.listAllWpAssignments(),
    enabled: open,
  });
  const { data: allTaskAssignments = [] } = useQuery({
    queryKey: ["portfolio-task-map-all"],
    queryFn: () => api.projectWorkPackagesLookup.listAllTaskAssignments(),
    enabled: open,
  });

  const wpAssignmentByProjectWp = useMemo(() => {
    const m = new Map<string, { portfolioWpId: string; label: string }>();
    for (const a of allWpAssignments) {
      m.set(a.project_work_package_id, {
        portfolioWpId: a.portfolio_work_package_id,
        label: `${a.portfolio_work_package?.code ?? ""} ${a.portfolio_work_package?.name ?? ""}`.trim() || "—",
      });
    }
    return m;
  }, [allWpAssignments]);

  const taskAssignmentByProjectWp = useMemo(() => {
    const m = new Map<string, { taskId: string; portfolioWpId: string; label: string }>();
    for (const a of allTaskAssignments) {
      m.set(a.project_work_package_id, {
        taskId: a.portfolio_task_id,
        portfolioWpId: a.portfolio_task?.portfolio_work_package_id ?? "",
        label: `${a.portfolio_task?.code ?? ""} ${a.portfolio_task?.name ?? ""}`.trim() || "—",
      });
    }
    return m;
  }, [allTaskAssignments]);

  const mappedIdsHere = useMemo(() => new Set(mappings.map((m: any) => m.project_work_package_id)), [mappings]);

  /**
   * Bestimmt, ob ein Projekt-AP für die aktuelle Zuordnung verfügbar ist.
   * Liefert entweder null (verfügbar) oder einen menschlich lesbaren Sperr-Hinweis.
   */
  const blockedReason = (projectWpId: string): string | null => {
    if (!target) return "Kein Ziel gewählt";
    if (mappedIdsHere.has(projectWpId)) return null; // bereits hier — wird nicht angezeigt
    if (target.kind === "wp") {
      const existing = wpAssignmentByProjectWp.get(projectWpId);
      if (existing && existing.portfolioWpId !== target.portfolioWpId) {
        return `Bereits dem Portfolio-Arbeitspaket "${existing.label}" zugeordnet.`;
      }
      return null;
    }
    // task target
    const existingTask = taskAssignmentByProjectWp.get(projectWpId);
    if (existingTask && existingTask.taskId !== target.portfolioTaskId) {
      return `Bereits dem Portfolio-Task "${existingTask.label}" zugeordnet.`;
    }
    const existingWp = wpAssignmentByProjectWp.get(projectWpId);
    if (existingWp && existingWp.portfolioWpId !== target.portfolioWpId) {
      return `Gehört zum Portfolio-Arbeitspaket "${existingWp.label}" — Task-Zuordnung nur innerhalb desselben APs möglich.`;
    }
    return null;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allProjectWps.filter((wp: any) => {
      if (mappedIdsHere.has(wp.id)) return false; // schon hier zugeordnet
      if (statusFilter !== "all" && wp.project?.project_status !== statusFilter) return false;
      if (!q) return true;
      return (
        wp.title?.toLowerCase().includes(q) ||
        wp.project?.project_name?.toLowerCase().includes(q) ||
        wp.project?.project_number?.toLowerCase().includes(q)
      );
    });
  }, [allProjectWps, mappedIdsHere, search, statusFilter]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: ["portfolio-wp-map-all"] });
    qc.invalidateQueries({ queryKey: ["portfolio-task-map-all"] });
  };

  const addOne = useMutation({
    mutationFn: async (projectWpId: string) => {
      if (!target) return;
      if (target.kind === "wp") {
        return api.portfolioWpProjectMap.add({
          portfolio_work_package_id: target.portfolioWpId,
          project_work_package_id: projectWpId,
        });
      }
      return api.portfolioTaskProjectMap.add({
        portfolio_task_id: target.portfolioTaskId,
        project_work_package_id: projectWpId,
      });
    },
    onSuccess: () => { toast.success("Zugeordnet"); invalidateAll(); },
    onError: (e: any) => toast.error(e?.message || "Zuordnung nicht möglich"),
  });

  const removeOne = useMutation({
    mutationFn: async (mapId: string) => {
      if (!target) return;
      return target.kind === "wp"
        ? api.portfolioWpProjectMap.remove(mapId)
        : api.portfolioTaskProjectMap.remove(mapId);
    },
    onSuccess: () => { toast.success("Entfernt"); invalidateAll(); },
  });

  const updateOne = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      if (!target) return;
      return target.kind === "wp"
        ? api.portfolioWpProjectMap.update(id, updates)
        : api.portfolioTaskProjectMap.update(id, updates);
    },
    onSuccess: invalidateAll,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Projekt-Arbeitspakete zuordnen{target ? ` – ${target.title}` : ""}</DialogTitle>
          {target?.kind === "task" && (
            <p className="text-xs text-muted-foreground">
              Zuordnung nur für Projekt-APs möglich, die dem Portfolio-Arbeitspaket „{target.portfolioWpTitle}" zugeordnet
              (oder noch keinem AP zugewiesen) sind. Jedes Projekt-AP darf nur einem Task angehören.
            </p>
          )}
          {target?.kind === "wp" && (
            <p className="text-xs text-muted-foreground">
              Jedes Projekt-AP darf nur einem Portfolio-Arbeitspaket zugeordnet werden.
            </p>
          )}
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Zugeordnete APs */}
          <div className="border rounded-md">
            <div className="p-3 border-b bg-muted/40">
              <div className="text-sm font-semibold">Bereits zugeordnet ({mappings.length})</div>
            </div>
            <div className="max-h-[420px] overflow-auto">
              {mappings.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Noch keine Projekt-Arbeitspakete zugeordnet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Projekt / AP</TableHead>
                      <TableHead className="w-24">Anteil %</TableHead>
                      <TableHead className="w-24 text-center">Förder.</TableHead>
                      {canManage && <TableHead className="w-10" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="text-sm font-medium">{m.project_work_package?.project?.project_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {m.project_work_package?.project?.project_number} · {m.project_work_package?.title}
                          </div>
                          {m.note && <div className="text-xs italic text-muted-foreground mt-1">{m.note}</div>}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            disabled={!canManage}
                            defaultValue={m.funding_share_pct}
                            className="h-8 w-20"
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (!isNaN(v) && v !== m.funding_share_pct) {
                                updateOne.mutate({ id: m.id, updates: { funding_share_pct: v } });
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={m.funding_relevant}
                            disabled={!canManage}
                            onCheckedChange={(v) =>
                              updateOne.mutate({ id: m.id, updates: { funding_relevant: !!v } })
                            }
                          />
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => removeOne.mutate(m.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          {/* Verfügbare Projekt-APs */}
          <div className="border rounded-md">
            <div className="p-3 border-b bg-muted/40 space-y-2">
              <div className="text-sm font-semibold">Verfügbare Projekt-Arbeitspakete</div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Suchen: Projekt oder AP …"
                    className="pl-8 h-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    <SelectItem value="planned">Geplant</SelectItem>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="completed">Abgeschlossen</SelectItem>
                    <SelectItem value="cancelled">Abgebrochen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="max-h-[420px] overflow-auto">
              {filtered.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">Keine passenden APs gefunden.</p>
              ) : (
                <Table>
                  <TableBody>
                    {filtered.slice(0, 200).map((wp: any) => {
                      const reason = blockedReason(wp.id);
                      const blocked = !!reason;
                      return (
                        <TableRow key={wp.id} className={blocked ? "opacity-60" : ""}>
                          <TableCell>
                            <div className="text-sm font-medium">{wp.project?.project_name ?? "—"}</div>
                            <div className="text-xs text-muted-foreground">
                              {wp.project?.project_number} · {wp.title}
                              {wp.project?.project_status && (
                                <Badge variant="outline" className="ml-2 text-[10px]">{wp.project.project_status}</Badge>
                              )}
                            </div>
                            {blocked && (
                              <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                <Lock className="h-3 w-3" />
                                {reason}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="w-16 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!canManage || addOne.isPending || blocked}
                              title={reason ?? undefined}
                              onClick={() => addOne.mutate(wp.id)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
