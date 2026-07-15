import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Search, Trash2, Plus } from "lucide-react";

/**
 * Zuordnung von Projekt-Arbeitspaketen zu einem Portfolio-Arbeitspaket
 * oder einem Portfolio-Task (M:N).
 */
type Target =
  | { kind: "wp"; portfolioWpId: string; title: string }
  | { kind: "task"; portfolioTaskId: string; title: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: Target | null;
  canManage: boolean;
}

export default function PortfolioProjectWpMappingDialog({ open, onOpenChange, target, canManage }: Props) {
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

  const { data: allProjectWps = [] } = useQuery({
    queryKey: ["project-wps-lookup"],
    queryFn: () => api.projectWorkPackagesLookup.listAll(),
    enabled: open,
  });

  const mappedIds = useMemo(() => new Set(mappings.map((m: any) => m.project_work_package_id)), [mappings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allProjectWps.filter((wp: any) => {
      if (mappedIds.has(wp.id)) return false;
      if (statusFilter !== "all" && wp.project?.project_status !== statusFilter) return false;
      if (!q) return true;
      return (
        wp.title?.toLowerCase().includes(q) ||
        wp.project?.project_name?.toLowerCase().includes(q) ||
        wp.project?.project_number?.toLowerCase().includes(q)
      );
    });
  }, [allProjectWps, mappedIds, search, statusFilter]);

  const invalidate = () => qc.invalidateQueries({ queryKey });

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
    onSuccess: () => { toast.success("Zugeordnet"); invalidate(); },
    onError: (e: any) => toast.error(e?.message || "Fehler"),
  });

  const removeOne = useMutation({
    mutationFn: async (mapId: string) => {
      if (!target) return;
      return target.kind === "wp"
        ? api.portfolioWpProjectMap.remove(mapId)
        : api.portfolioTaskProjectMap.remove(mapId);
    },
    onSuccess: () => { toast.success("Entfernt"); invalidate(); },
  });

  const updateOne = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      if (!target) return;
      return target.kind === "wp"
        ? api.portfolioWpProjectMap.update(id, updates)
        : api.portfolioTaskProjectMap.update(id, updates);
    },
    onSuccess: invalidate,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Projekt-Arbeitspakete zuordnen{target ? ` – ${target.title}` : ""}</DialogTitle>
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
                    {filtered.slice(0, 200).map((wp: any) => (
                      <TableRow key={wp.id}>
                        <TableCell>
                          <div className="text-sm font-medium">{wp.project?.project_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {wp.project?.project_number} · {wp.title}
                            {wp.project?.project_status && (
                              <Badge variant="outline" className="ml-2 text-[10px]">{wp.project.project_status}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="w-16 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canManage || addOne.isPending}
                            onClick={() => addOne.mutate(wp.id)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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
