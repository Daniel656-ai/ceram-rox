import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Clock, CheckCircle2, FolderOpen, Search, Eye, Briefcase, Factory, FlaskConical, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useOrders, useOrderStatusCounts, useRecentOrders } from "@/hooks/useOrders";
import { useProjects } from "@/hooks/useProjects";
import { useMyMeasurements } from "@/hooks/useMeasurements";
import { useSamples } from "@/hooks/useSamples";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { ActivityFeed } from "@/components/ActivityFeed";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { orderSamples, samplesMatchSearch } from "@/lib/orders/orderSamples";
import { SampleLinks } from "@/components/orders/SampleLinks";
import { recentOrderProject, recentOrderDate } from "@/lib/orders/recentOrderLine";

/** Klickbare Kennzahl-Kachel: dezenter Farbakzent links, Hover, Ladezustand und Fehlerzustand ("–"). */
function StatTile({ to, title, icon, accent, value, loading }: {
  to: string; title: string; icon: ReactNode; accent: string; value: ReactNode; loading?: boolean;
}) {
  return (
    <Link to={to} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className={cn("h-full border-l-4 transition-colors hover:bg-muted/50", accent)}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-8 w-14" /> : <div className="text-2xl font-bold">{value}</div>}
        </CardContent>
      </Card>
    </Link>
  );
}

const ORDER_TYPE_ICONS: Record<string, typeof Briefcase> = { customer: Briefcase, production: Factory, rnd: FlaskConical };

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
      <Inbox className="h-6 w-6" />
      <p>{text}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user, profile, role } = useAuth();
  const { t } = useTranslation(["common", "navigation", "orders", "samples"]);
  const { data: projects = [], isError: projectsError, isLoading: projectsLoading } = useProjects();
  const { data: myMeasurements = [] } = useMyMeasurements();
  // Kacheln und Liste laden schlank (Zählung bzw. 5 Zeilen); Fehler werden angezeigt statt als 0 versteckt.
  const { data: counts, isError: countsError, isLoading: countsLoading, refetch: refetchCounts } = useOrderStatusCounts();
  const { data: recentOrders = [], isLoading: recentLoading } = useRecentOrders(5);

  // Search state
  const [search, setSearch] = useState("");

  const q = search.toLowerCase().trim();
  const hasSearch = q.length >= 2;

  // Die schweren Suchdaten (alle Aufträge, Proben, Aufgaben) werden erst bei einer Suche geladen.
  const { data: orders = [] } = useOrders({ enabled: hasSearch });
  const { data: samples = [] } = useSamples({ enabled: hasSearch });
  const { data: allMeasurements = [] } = useQuery({
    queryKey: ["dashboard-all-measurements"],
    queryFn: () => api.measurements.listForDashboardSearch(),
    enabled: !!user && hasSearch,
  });
  // Reuse hydrated order relations, never turn the search projection's unkeyed
  // order-level sample into an invented task-specific sample link.
  const samplesByOrder = useMemo(() => new Map((orders as any[]).map(order => [order.id, orderSamples(order)])), [orders]);

  // Filtered samples
  const filteredSamples = useMemo(() => {
    if (!hasSearch) return [];
    return (samples as any[]).filter((s: any) =>
      (s.sample_number || "").toLowerCase().includes(q) ||
      (s.sample_name || "").toLowerCase().includes(q) ||
      (s.description || "").toLowerCase().includes(q)
    ).slice(0, 10);
  }, [samples, q, hasSearch]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    if (!hasSearch) return [];
    return (orders as any[]).filter((o: any) =>
      (o.order_number || "").toLowerCase().includes(q) ||
      (o.projects?.project_number || "").toLowerCase().includes(q) ||
      (o.projects?.project_name || "").toLowerCase().includes(q) ||
      (o.notes || "").toLowerCase().includes(q) ||
      samplesMatchSearch(orderSamples(o), q)
    ).slice(0, 10);
  }, [orders, q, hasSearch]);

  // Filtered measurements
  const filteredMeasurements = useMemo(() => {
    if (!hasSearch) return [];
    return (allMeasurements as any[]).filter((m: any) =>
      (m.measurement_number || "").toLowerCase().includes(q) ||
      (m.measurement_services?.service_name || "").toLowerCase().includes(q) ||
      (m.measurement_orders?.order_number || "").toLowerCase().includes(q) ||
      (m.measurement_orders?.projects?.project_number || "").toLowerCase().includes(q) ||
      (m.measurement_orders?.projects?.project_name || "").toLowerCase().includes(q) ||
      (m.measurement_orders?.samples?.sample_number || "").toLowerCase().includes(q) ||
      (m.measurement_orders?.samples?.sample_name || "").toLowerCase().includes(q) ||
      samplesMatchSearch(samplesByOrder.get(m.measurement_orders?.id) ?? [], q)
    ).slice(0, 10);
  }, [allMeasurements, q, hasSearch, samplesByOrder]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    if (!hasSearch) return [];
    return (projects as any[]).filter((p: any) =>
      p.project_number.toLowerCase().includes(q) ||
      (p.project_name || "").toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q)
    ).slice(0, 10);
  }, [projects, q, hasSearch]);

  const totalResults = filteredSamples.length + filteredOrders.length + filteredMeasurements.length + filteredProjects.length;

  const greeting = profile?.first_name
    ? `${t("common:welcome", "Willkommen")}, ${profile.first_name}!`
    : `${t("common:welcome", "Willkommen")}!`;

  const roleLabel =
    role === "master" ? t("common:role_master") :
    role === "auftraggeber" ? t("common:role_auftraggeber") :
    role === "durchfuehrer" ? t("common:role_durchfuehrer") : "";

  const fmt = (n: number | undefined) => (countsError || n === undefined ? "–" : n);
  const openOrders = fmt(counts?.open);
  const inProgressOrders = fmt(counts?.in_progress);
  const completedOrders = fmt(counts?.completed);
  const inProgressMeasurements = myMeasurements.filter(m => m.status === "in_progress").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
          <p className="text-muted-foreground">{roleLabel}-Dashboard</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile to="/projekte" title={t("navigation:projects")} icon={<FolderOpen className="h-4 w-4 text-primary" />}
          accent="border-l-primary" loading={projectsLoading} value={projectsError ? "–" : projects.length} />
        <StatTile to="/auftraege" title={`${t("common:status_open")} (Aufträge)`} icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
          accent="border-l-muted-foreground/40" loading={countsLoading} value={openOrders} />
        <StatTile to="/auftraege" title={role === "durchfuehrer" ? "In Bearbeitung (meine Aufgaben)" : `${t("common:status_in_progress")} (Aufträge)`}
          icon={<Clock className="h-4 w-4 text-warning" />} accent="border-l-warning"
          loading={role === "durchfuehrer" ? false : countsLoading} value={role === "durchfuehrer" ? inProgressMeasurements : inProgressOrders} />
        <StatTile to="/auftraege" title={`${t("common:status_completed")} (Aufträge)`} icon={<CheckCircle2 className="h-4 w-4 text-success" />}
          accent="border-l-success" loading={countsLoading} value={completedOrders} />
      </div>

      {countsError && (
        <p className="text-sm text-destructive">
          Die Auftragszahlen konnten nicht geladen werden.{" "}
          <button type="button" className="underline" onClick={() => refetchCounts()}>Erneut versuchen</button>
        </p>
      )}

      {/* Universal Search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Suche
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Projekte, Aufträge, Aufgaben, Proben durchsuchen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {hasSearch && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{totalResults} Ergebnis(se) gefunden</p>

              {/* Projects */}
              {filteredProjects.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <FolderOpen className="h-4 w-4 text-primary" />
                    {t("navigation:projects")} ({filteredProjects.length})
                  </h3>
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Projektnummer</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead className="w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProjects.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.project_number}</TableCell>
                            <TableCell>{p.project_name || "–"}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" asChild>
                                <Link to={`/projekte/${p.id}`}><Eye className="h-4 w-4" /></Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Orders */}
              {filteredOrders.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    {t("orders:title")} ({filteredOrders.length})
                  </h3>
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Auftragsnr.</TableHead>
                          <TableHead>{t("samples:sample_designation", "Probenbezeichnung")}</TableHead>
                          <TableHead>{t("common:project")}</TableHead>
                          <TableHead>{t("common:status")}</TableHead>
                          <TableHead className="w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((o: any) => (
                          <TableRow key={o.id}>
                            <TableCell className="font-medium">{o.order_number || "–"}</TableCell>
                            <TableCell><SampleLinks samples={orderSamples(o)} /></TableCell>
                            <TableCell>{o.projects?.project_number} {o.projects?.project_name ? `– ${o.projects.project_name}` : ""}</TableCell>
                            <TableCell><StatusBadge status={o.status} /></TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" asChild>
                                <Link to={`/auftraege/${o.id}`}><Eye className="h-4 w-4" /></Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Measurements */}
              {filteredMeasurements.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-primary" />
                    Aufgaben ({filteredMeasurements.length})
                  </h3>
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Aufg.-Nr.</TableHead>
                          <TableHead>Dienstleistung</TableHead>
                          <TableHead>Auftrag</TableHead>
                          <TableHead>{t("samples:sample_designation", "Probenbezeichnung")}</TableHead>
                          <TableHead>{t("common:status")}</TableHead>
                          <TableHead className="w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMeasurements.map((m: any) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium">{m.measurement_number}</TableCell>
                            <TableCell>{m.measurement_services?.service_name || "–"}</TableCell>
                            <TableCell>{m.measurement_orders?.order_number || "–"}</TableCell>
                            <TableCell><SampleLinks samples={samplesByOrder.get(m.measurement_orders?.id) ?? []} /></TableCell>
                            <TableCell><StatusBadge status={m.status} /></TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" asChild>
                                <Link to={`/auftraege/${m.measurement_orders?.id}`}><Eye className="h-4 w-4" /></Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Samples */}
              {filteredSamples.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <Search className="h-4 w-4 text-primary" />
                    {t("samples:title")} ({filteredSamples.length})
                  </h3>
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("samples:sample_number")}</TableHead>
                          <TableHead>{t("samples:name")}</TableHead>
                          <TableHead>{t("common:project")}</TableHead>
                          <TableHead>{t("common:status")}</TableHead>
                          <TableHead className="w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSamples.map((s: any) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.sample_number}</TableCell>
                            <TableCell>{s.sample_name}</TableCell>
                            <TableCell>{s.projects?.project_number || "–"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{t(`samples:status_${s.status}`)}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" asChild>
                                <Link to={`/proben/${s.id}`}><Eye className="h-4 w-4" /></Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {totalResults === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Keine Ergebnisse gefunden.</p>
              )}
            </div>
          )}

          {!hasSearch && (
            <p className="text-sm text-muted-foreground">Mindestens 2 Zeichen eingeben, um Projekte, Aufträge, Aufgaben und Proben zu durchsuchen.</p>
          )}
        </CardContent>
      </Card>

      <ActivityFeed />

      {/* Recent orders / measurements */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {role === "durchfuehrer" ? t("measurements:no_measurements", "Meine offenen Aufgaben") : t("orders:title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {role === "durchfuehrer" ? (
            myMeasurements.length === 0 ? (
              <EmptyState text={t("measurements:no_measurements")} />
            ) : (
              <div className="space-y-2">
                {myMeasurements.slice(0, 5).map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border">
                    <div>
                      <p className="font-medium">{m.measurement_services?.service_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("common:project")}: {m.measurement_orders?.projects?.project_number}
                      </p>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                ))}
              </div>
            )
          ) : (
            recentLoading ? (
              <div className="space-y-2">{[0, 1, 2].map(k => <Skeleton key={k} className="h-12 w-full" />)}</div>
            ) : recentOrders.length === 0 ? (
              <EmptyState text="Noch keine Aufträge vorhanden." />
            ) : (
              <div className="space-y-2">
                {recentOrders.map((o: any) => {
                  const TypeIcon = ORDER_TYPE_ICONS[o.order_type] ?? ClipboardList;
                  const project = recentOrderProject(o);
                  const date = recentOrderDate(o);
                  return (
                    <Link key={o.id} to={`/auftraege/${o.id}`} className="block">
                      <div className="flex items-center gap-3 px-3 py-2 rounded-md border hover:bg-muted/50 transition-colors">
                        <TypeIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="truncate">
                            {o.order_number && <span className="font-semibold">{o.order_number}</span>}
                            {o.order_number && " · "}
                            <span className="text-muted-foreground">{String(t(`common:order_type_${o.order_type}`, o.order_type))}</span>
                          </p>
                          {project && <p className="truncate text-xs text-muted-foreground">{project}</p>}
                        </div>
                        {date && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{date}</span>}
                        <StatusBadge status={o.status} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )
          )}
        </CardContent>
      </Card>

    </div>
  );
}
