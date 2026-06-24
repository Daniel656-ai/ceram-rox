import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useProjects } from "@/hooks/useProjects";
import { useOrders } from "@/hooks/useOrders";
import { useUsers } from "@/hooks/useUsers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, BarChart3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

type SortField = "measurements" | "hours" | "progress" | "project_number";
type SortDir = "asc" | "desc";

function useAllOrderMeasurements() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["all_order_measurements_stats"],
    queryFn: async () => {
      const { data, error } = await api
        .from("order_measurements")
        .select("id, order_id, status, actual_duration_hours, processing_time_hours");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

function useAllProjectTimeEntries() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["all_project_time_entries_stats"],
    queryFn: async () => {
      const { data, error } = await api
        .from("project_time_entries")
        .select("project_id, duration_minutes, entry_date");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

function useAllProjectMembers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["all_project_members_stats"],
    queryFn: async () => {
      const { data, error } = await api
        .from("project_members")
        .select("project_id, user_id, role");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function ProjectStatistics() {
  const { t } = useTranslation(["admin", "common", "projects"]);
  const { data: projects = [] } = useProjects();
  const { data: orders = [] } = useOrders();
  const { data: measurements = [] } = useAllOrderMeasurements();
  const { data: timeEntries = [] } = useAllProjectTimeEntries();
  const { data: allMembers = [] } = useAllProjectMembers();
  const { data: users = [] } = useUsers();

  const [sortField, setSortField] = useState<SortField>("measurements");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [leaderFilter, setLeaderFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showChart, setShowChart] = useState(true);

  // Order IDs per project
  const orderIdsByProject = useMemo(() => {
    const map: Record<string, string[]> = {};
    orders.forEach(o => {
      if (!map[o.project_id]) map[o.project_id] = [];
      map[o.project_id].push(o.id);
    });
    return map;
  }, [orders]);

  // Project leaders from members
  const projectLeaders = useMemo(() => {
    const map: Record<string, string[]> = {};
    allMembers.forEach(m => {
      if (m.role === "leader" || m.role === "owner") {
        if (!map[m.project_id]) map[m.project_id] = [];
        map[m.project_id].push(m.user_id);
      }
    });
    return map;
  }, [allMembers]);

  // Unique leaders for filter dropdown
  const uniqueLeaders = useMemo(() => {
    const ids = new Set<string>();
    allMembers.forEach(m => {
      if (m.role === "leader" || m.role === "owner") ids.add(m.user_id);
    });
    return Array.from(ids);
  }, [allMembers]);

  // Build stats per project
  const projectStats = useMemo(() => {
    return projects.map(project => {
      const projOrderIds = orderIdsByProject[project.id] || [];
      const projMeasurements = measurements.filter(m => projOrderIds.includes(m.order_id));
      const totalMeasurements = projMeasurements.length;
      const completedMeasurements = projMeasurements.filter(m => m.status === "completed").length;
      const progress = totalMeasurements > 0 ? Math.round((completedMeasurements / totalMeasurements) * 100) : 0;

      const projTimeEntries = timeEntries.filter(te => te.project_id === project.id);
      const totalMinutes = projTimeEntries.reduce((sum, te) => sum + te.duration_minutes, 0);
      const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

      return {
        ...project,
        totalMeasurements,
        completedMeasurements,
        progress,
        totalHours,
      };
    });
  }, [projects, orderIdsByProject, measurements, timeEntries]);

  // Apply filters
  const filtered = useMemo(() => {
    return projectStats.filter(p => {
      if (statusFilter !== "all" && p.project_status !== statusFilter) return false;
      if (leaderFilter !== "all") {
        const leaders = projectLeaders[p.id] || [];
        if (!leaders.includes(leaderFilter)) return false;
      }
      if (dateFrom && p.start_date && p.start_date < dateFrom) return false;
      if (dateTo && p.end_date && p.end_date > dateTo) return false;
      return true;
    });
  }, [projectStats, statusFilter, leaderFilter, dateFrom, dateTo, projectLeaders]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va: number | string, vb: number | string;
      switch (sortField) {
        case "measurements": va = a.totalMeasurements; vb = b.totalMeasurements; break;
        case "hours": va = a.totalHours; vb = b.totalHours; break;
        case "progress": va = a.progress; vb = b.progress; break;
        default: va = a.project_number; vb = b.project_number; break;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1 inline text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 inline text-primary" />;
  };

  const getUserName = (userId: string) => {
    const u = users.find(u => u.user_id === userId);
    return u ? `${u.first_name} ${u.last_name}`.trim() : userId.slice(0, 8);
  };

  // Chart data (top 10)
  const chartData = useMemo(() => {
    return sorted.slice(0, 10).map(p => ({
      name: p.project_number,
      [t("admin:pstats_measurements")]: p.totalMeasurements,
      [t("admin:pstats_hours")]: p.totalHours,
    }));
  }, [sorted, t]);

  // Summary totals
  const totalMeasurementsAll = filtered.reduce((s, p) => s + p.totalMeasurements, 0);
  const totalHoursAll = Math.round(filtered.reduce((s, p) => s + p.totalHours, 0) * 10) / 10;
  const avgProgress = filtered.length > 0 ? Math.round(filtered.reduce((s, p) => s + p.progress, 0) / filtered.length) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("admin:pstats_title")}</h2>
        <Button variant="outline" size="sm" onClick={() => setShowChart(v => !v)}>
          <BarChart3 className="h-4 w-4 mr-1" />
          {showChart ? t("admin:pstats_hide_chart") : t("admin:pstats_show_chart")}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin:pstats_total_measurements")}</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalMeasurementsAll}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin:pstats_total_hours")}</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalHoursAll} h</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("admin:pstats_avg_progress")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgProgress} %</div>
            <Progress value={avgProgress} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-1"><Filter className="h-4 w-4" /> {t("admin:pstats_filters")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs">{t("admin:pstats_status")}</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common:all")}</SelectItem>
                  <SelectItem value="active">{t("projects:status_active")}</SelectItem>
                  <SelectItem value="completed">{t("projects:status_completed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("admin:pstats_leader")}</Label>
              <Select value={leaderFilter} onValueChange={setLeaderFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common:all")}</SelectItem>
                  {uniqueLeaders.map(uid => (
                    <SelectItem key={uid} value={uid}>{getUserName(uid)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("admin:pstats_from")}</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t("admin:pstats_to")}</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      {showChart && chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("admin:pstats_chart_title")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} angle={-20} textAnchor="end" height={60} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey={t("admin:pstats_measurements")} fill="hsl(200, 60%, 32%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey={t("admin:pstats_hours")} fill="hsl(16, 75%, 48%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t("admin:pstats_table_title")}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("project_number")}>
                  {t("admin:pstats_project")} <SortIcon field="project_number" />
                </TableHead>
                <TableHead>{t("admin:pstats_status")}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("measurements")}>
                  {t("admin:pstats_measurements")} <SortIcon field="measurements" />
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("hours")}>
                  {t("admin:pstats_hours")} <SortIcon field="hours" />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("progress")}>
                  {t("admin:pstats_progress")} <SortIcon field="progress" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("admin:pstats_no_data")}</TableCell></TableRow>
              ) : (
                sorted.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.project_number}</div>
                      {p.project_name && <div className="text-xs text-muted-foreground">{p.project_name}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.project_status === "active" ? "default" : "secondary"}>
                        {t(`projects:status_${p.project_status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {p.completedMeasurements}/{p.totalMeasurements}
                    </TableCell>
                    <TableCell className="text-right font-mono">{p.totalHours} h</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Progress value={p.progress} className="h-2 flex-1" />
                        <span className="text-xs font-mono w-10 text-right">{p.progress}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
