import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Clock, CheckCircle2, FolderOpen, Search, Eye } from "lucide-react";
import { useOrders } from "@/hooks/useOrders";
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
import { GitHubCommitStatus } from "@/components/GitHubCommitStatus";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const { user, profile, role } = useAuth();
  const { t } = useTranslation(["common", "navigation", "orders", "samples"]);
  const { data: orders = [] } = useOrders();
  const { data: projects = [] } = useProjects();
  const { data: myMeasurements = [] } = useMyMeasurements();
  const { data: samples = [] } = useSamples();

  // Fetch all measurements with related data for search
  const { data: allMeasurements = [] } = useQuery({
    queryKey: ["dashboard-all-measurements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_measurements")
        .select(`
          id, measurement_number, status, assigned_to,
          measurement_services(service_name),
          measurement_orders(
            id, order_number, order_type,
            projects(project_number, project_name),
            samples(sample_number, sample_name)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Search state
  const [search, setSearch] = useState("");

  const q = search.toLowerCase().trim();
  const hasSearch = q.length >= 2;

  // Filtered samples
  const filteredSamples = useMemo(() => {
    if (!hasSearch) return [];
    return (samples as any[]).filter((s: any) =>
      s.sample_number.toLowerCase().includes(q) ||
      s.sample_name.toLowerCase().includes(q) ||
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
      (o.notes || "").toLowerCase().includes(q)
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
      (m.measurement_orders?.samples?.sample_name || "").toLowerCase().includes(q)
    ).slice(0, 10);
  }, [allMeasurements, q, hasSearch]);

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

  const openOrders = orders.filter(o => o.status === "open").length;
  const inProgressOrders = orders.filter(o => o.status === "in_progress").length;
  const completedOrders = orders.filter(o => o.status === "completed").length;
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("navigation:projects")}</CardTitle>
            <FolderOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{projects.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("common:status_open")}</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{openOrders}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("common:status_in_progress")}</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{role === "durchfuehrer" ? inProgressMeasurements : inProgressOrders}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("common:status_completed")}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{completedOrders}</div></CardContent>
        </Card>
      </div>

      <GitHubCommitStatus />

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
                          <TableHead>{t("common:project")}</TableHead>
                          <TableHead>{t("common:status")}</TableHead>
                          <TableHead className="w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((o: any) => (
                          <TableRow key={o.id}>
                            <TableCell className="font-medium">{o.order_number || "–"}</TableCell>
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
        <CardHeader>
          <CardTitle className="text-lg">
            {role === "durchfuehrer" ? t("measurements:no_measurements", "Meine offenen Aufgaben") : t("orders:title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {role === "durchfuehrer" ? (
            myMeasurements.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("measurements:no_measurements")}</p>
            ) : (
              <div className="space-y-3">
                {myMeasurements.slice(0, 5).map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-md border">
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
            orders.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("common:no_data")}</p>
            ) : (
              <div className="space-y-3">
                {orders.slice(0, 5).map((o: any) => (
                  <Link key={o.id} to={`/auftraege/${o.id}`} className="block">
                    <div className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="font-medium">
                          {o.projects?.project_number} – {t(`common:order_type_${o.order_type}`, o.order_type)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {o.projects?.project_name || "–"}
                        </p>
                      </div>
                      <StatusBadge status={o.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>

    </div>
  );
}
