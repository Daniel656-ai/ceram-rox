import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Layers, Link2 } from "lucide-react";

interface Props {
  portfolioId: string;
}

/**
 * Übersichten zu Förder-Zuordnungen:
 *  - Portfolio-APs mit Zahl der zugeordneten Projekt-APs & Summe der Aufwände (Tasks)
 *  - Projekt-APs, die keinem Förder-AP zugeordnet sind
 *  - Portfolio-Tasks mit zugeordneten Projekten
 */
export default function PortfolioFundingMappingTab({ portfolioId }: Props) {
  const { data: wps = [] } = useQuery({
    queryKey: ["portfolio-wps", portfolioId],
    queryFn: () => api.portfolioWorkPackages.listByPortfolio(portfolioId),
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["portfolio-tasks", portfolioId],
    queryFn: () => api.portfolioTasks.listByPortfolio(portfolioId),
  });

  // Zuordnungen je Portfolio-AP (parallel)
  const wpMapQueries = useQuery({
    queryKey: ["portfolio-wp-map-all", portfolioId, wps.map((w) => w.id).join(",")],
    enabled: wps.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        wps.map(async (w) => [w.id, await api.portfolioWpProjectMap.listByPortfolioWp(w.id)] as const),
      );
      return Object.fromEntries(entries) as Record<string, any[]>;
    },
  });
  const wpMaps = wpMapQueries.data ?? {};

  const taskMapQueries = useQuery({
    queryKey: ["portfolio-task-map-all", portfolioId, tasks.map((t) => t.id).join(",")],
    enabled: tasks.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        tasks.map(async (t) => [t.id, await api.portfolioTaskProjectMap.listByPortfolioTask(t.id)] as const),
      );
      return Object.fromEntries(entries) as Record<string, any[]>;
    },
  });
  const taskMaps = taskMapQueries.data ?? {};

  const { data: unassigned = [] } = useQuery({
    queryKey: ["project-wps-unassigned"],
    queryFn: () => api.projectWorkPackagesLookup.unassignedFunding(),
  });

  const tasksByWp = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const t of tasks) (map[(t as any).portfolio_work_package_id] ||= []).push(t);
    return map;
  }, [tasks]);

  const totalPlanned = (wpId: string) =>
    (tasksByWp[wpId] || []).reduce((s, t: any) => s + Number(t.planned_effort_hours ?? 0), 0);
  const totalShare = (wpId: string) =>
    (wpMaps[wpId] || []).reduce((s, m: any) => s + Number(m.funding_share_pct ?? 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" /> Förder-Arbeitspakete – Zuordnung &amp; Aufwände
          </CardTitle>
        </CardHeader>
        <CardContent>
          {wps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Portfolio-Arbeitspakete.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Nr.</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead className="w-32">Tasks</TableHead>
                  <TableHead className="w-40">Zugeordnete Projekt-APs</TableHead>
                  <TableHead className="w-40">∑ geplanter Aufwand (h)</TableHead>
                  <TableHead className="w-40">∑ Förderanteil (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wps.map((wp: any) => (
                  <TableRow key={wp.id}>
                    <TableCell className="font-mono text-sm">{wp.code ?? "—"}</TableCell>
                    <TableCell>
                      <div className="font-medium">{wp.name}</div>
                      {wp.category && (
                        <Badge variant="outline" className="text-[10px] mt-1">{wp.category.name}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{(tasksByWp[wp.id] || []).length}</TableCell>
                    <TableCell>{(wpMaps[wp.id] || []).length}</TableCell>
                    <TableCell>{totalPlanned(wp.id).toFixed(2)}</TableCell>
                    <TableCell>{totalShare(wp.id).toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Portfolio-Tasks &amp; zugeordnete Projekte
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Portfolio-Tasks.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Nr.</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Zugeordnete Projekt-APs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t: any) => {
                  const list = taskMaps[t.id] || [];
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.code ?? "—"}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.portfolio_work_package?.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {list.length === 0 ? (
                          <span className="text-xs text-muted-foreground">— keine Zuordnung —</span>
                        ) : (
                          <ul className="text-xs space-y-1">
                            {list.map((m: any) => (
                              <li key={m.id}>
                                <span className="font-mono">{m.project_work_package?.project?.project_number}</span>{" "}
                                {m.project_work_package?.project?.project_name} · {m.project_work_package?.title}
                                <span className="ml-2 text-muted-foreground">({m.funding_share_pct}%)</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-4 w-4" /> Projekt-APs ohne Förder-Zuordnung
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unassigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">Alle Projekt-Arbeitspakete sind zugeordnet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projekt</TableHead>
                  <TableHead>Arbeitspaket</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-40">Zeitraum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unassigned.slice(0, 200).map((wp: any) => (
                  <TableRow key={wp.project_work_package_id}>
                    <TableCell className="text-xs">{wp.project_id ?? "—"}</TableCell>
                    <TableCell className="text-sm">{wp.title}</TableCell>
                    <TableCell><Badge variant="outline">{wp.status ?? "—"}</Badge></TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {wp.start_date ? new Date(wp.start_date).toLocaleDateString("de-AT") : "—"} –{" "}
                      {wp.end_date ? new Date(wp.end_date).toLocaleDateString("de-AT") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
