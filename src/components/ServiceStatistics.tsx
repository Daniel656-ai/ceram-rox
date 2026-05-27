import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { CalendarIcon, BarChart3, TrendingUp, Clock, Briefcase, ChevronUp, ChevronDown } from "lucide-react";
import { format, subDays, subMonths, startOfYear, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { getAustrianHolidays, HOURS_PER_WEEKDAY } from "@/lib/austrian-holidays";

type SortKey = "name" | "taskCount" | "totalHours" | "utilization";
type SortDir = "asc" | "desc";

const PRESETS = [
  { key: "7d", labelDe: "Letzte 7 Tage", labelEn: "Last 7 days", fn: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { key: "30d", labelDe: "Letzte 30 Tage", labelEn: "Last 30 days", fn: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { key: "month", labelDe: "Aktueller Monat", labelEn: "Current month", fn: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { key: "quarter", labelDe: "Letztes Quartal", labelEn: "Last quarter", fn: () => ({ from: subMonths(new Date(), 3), to: new Date() }) },
  { key: "year", labelDe: "Aktuelles Jahr", labelEn: "Current year", fn: () => ({ from: startOfYear(new Date()), to: new Date() }) },
];

export function ServiceStatistics() {
  const { t, i18n } = useTranslation(["admin"]);
  const isDE = i18n.language === "de";

  const [dateFrom, setDateFrom] = useState<Date>(subMonths(new Date(), 3));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [showChart, setShowChart] = useState(true);
  const [showTrend, setShowTrend] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("taskCount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Fetch services
  const { data: services = [] } = useQuery({
    queryKey: ["all-services-stats"],
    queryFn: async () => {
      const { data, error } = await api.from("measurement_services").select("id, service_name, category, standard_duration_hours, active").order("service_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch measurements in date range
  const { data: measurements = [], isLoading } = useQuery({
    queryKey: ["service-stats-measurements", dateFrom.toISOString(), dateTo.toISOString()],
    queryFn: async () => {
      const { data, error } = await api
        .from("order_measurements")
        .select("service_id, status, actual_duration_hours, planned_hours, updated_at, created_at")
        .gte("created_at", dateFrom.toISOString())
        .lte("created_at", dateTo.toISOString());
      if (error) throw error;
      return data;
    },
  });

  // Calculate working hours in date range (Mo-Thu 7.75h, Fr 7.5h, excluding AT holidays)
  const { workingDaysInRange, capacityHours } = useMemo(() => {
    const days = eachDayOfInterval({ start: dateFrom, end: dateTo });
    const years = [...new Set(days.map(d => d.getFullYear()))];
    const holidayDates = new Set(
      years.flatMap(y => getAustrianHolidays(y).map(h => format(h.date, "yyyy-MM-dd")))
    );
    let wdCount = 0;
    let hours = 0;
    days.forEach(d => {
      if (!isWeekend(d) && !holidayDates.has(format(d, "yyyy-MM-dd"))) {
        wdCount++;
        hours += HOURS_PER_WEEKDAY[d.getDay()];
      }
    });
    return { workingDaysInRange: wdCount, capacityHours: hours };
  }, [dateFrom, dateTo]);

  const stats = useMemo(() => {
    const filtered = categoryFilter === "all" ? services : services.filter(s => s.category === categoryFilter);

    const result = filtered.map(svc => {
      const svcMeasurements = measurements.filter(m => m.service_id === svc.id);
      const completed = svcMeasurements.filter(m => m.status === "completed");
      const totalHours = svcMeasurements.reduce((sum, m) => {
        return sum + Number(m.actual_duration_hours ?? m.planned_hours ?? svc.standard_duration_hours ?? 0);
      }, 0);

      // Absolute utilization: actual hours / available capacity (1 FTE)
      const utilization = capacityHours > 0
        ? Math.round((totalHours / capacityHours) * 100 * 10) / 10
        : 0;

      return {
        id: svc.id,
        name: svc.service_name,
        category: svc.category,
        active: svc.active,
        taskCount: svcMeasurements.length,
        completedCount: completed.length,
        totalHours: Math.round(totalHours * 10) / 10,
        standardDuration: svc.standard_duration_hours,
        utilization,
        capacityHours,
      };
    });

    // Sort
    result.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

    return result;
  }, [services, measurements, sortKey, sortDir, categoryFilter, capacityHours]);

  // Trend data: group by month
  const trendData = useMemo(() => {
    const months: Record<string, { month: string; tasks: number; hours: number }> = {};
    measurements.forEach(m => {
      const key = format(new Date(m.created_at), "yyyy-MM");
      if (!months[key]) months[key] = { month: key, tasks: 0, hours: 0 };
      months[key].tasks++;
      months[key].hours += Number(m.actual_duration_hours ?? m.planned_hours ?? 0);
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).map(m => ({
      ...m,
      label: format(new Date(m.month + "-01"), "MMM yy", { locale: de }),
      hours: Math.round(m.hours * 10) / 10,
    }));
  }, [measurements]);

  const totalTasks = stats.reduce((s, r) => s + r.taskCount, 0);
  const totalHours = Math.round(stats.reduce((s, r) => s + r.totalHours, 0) * 10) / 10;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          {t("admin:sstats_title")}
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Presets */}
          <Select defaultValue="quarter" onValueChange={(v) => {
            const preset = PRESETS.find(p => p.key === v);
            if (preset) { const { from, to } = preset.fn(); setDateFrom(from); setDateTo(to); }
          }}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRESETS.map(p => (
                <SelectItem key={p.key} value={p.key}>{isDE ? p.labelDe : p.labelEn}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date from */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                <CalendarIcon className="h-3 w-3" />
                {format(dateFrom, "dd.MM.yy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">–</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                <CalendarIcon className="h-3 w-3" />
                {format(dateTo, "dd.MM.yy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          {/* Category filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isDE ? "Alle" : "All"}</SelectItem>
              <SelectItem value="labor">{isDE ? "Labor" : "Lab"}</SelectItem>
              <SelectItem value="pilot_plant">{isDE ? "Technikum" : "Pilot Plant"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">{t("admin:sstats_total_services")}</div>
            <div className="text-xl font-bold">{stats.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">{t("admin:sstats_total_tasks")}</div>
            <div className="text-xl font-bold">{totalTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">{t("admin:sstats_total_hours")}</div>
            <div className="text-xl font-bold">{totalHours} h</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">{t("admin:sstats_avg_tasks")}</div>
            <div className="text-xl font-bold">{stats.length > 0 ? Math.round(totalTasks / stats.length * 10) / 10 : 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">{isDE ? "Kapazität (1 FTE, 38,5h/Wo)" : "Capacity (1 FTE, 38.5h/wk)"}</div>
            <div className="text-xl font-bold">{Math.round(capacityHours * 10) / 10} h</div>
            <div className="text-[10px] text-muted-foreground">{workingDaysInRange} {isDE ? "Arbeitstage" : "working days"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Chart toggles */}
      <div className="flex gap-2">
        <Button variant={showChart ? "default" : "outline"} size="sm" className="text-xs gap-1" onClick={() => setShowChart(!showChart)}>
          <BarChart3 className="h-3 w-3" />
          {showChart ? (isDE ? "Diagramm ausblenden" : "Hide chart") : (isDE ? "Diagramm anzeigen" : "Show chart")}
        </Button>
        <Button variant={showTrend ? "default" : "outline"} size="sm" className="text-xs gap-1" onClick={() => setShowTrend(!showTrend)}>
          <TrendingUp className="h-3 w-3" />
          {showTrend ? (isDE ? "Trend ausblenden" : "Hide trend") : (isDE ? "Trend anzeigen" : "Show trend")}
        </Button>
      </div>

      {/* Bar chart */}
      {showChart && stats.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("admin:sstats_chart_title")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.slice(0, 15)} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={11} width={95} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value: number, name: string) => [
                  name === "taskCount" ? value : `${value} h`,
                  name === "taskCount" ? (isDE ? "Aufgaben" : "Tasks") : (isDE ? "Stunden" : "Hours")
                ]} />
                <Bar dataKey="taskCount" fill="hsl(200, 60%, 32%)" radius={[0, 4, 4, 0]} name="taskCount" />
                <Bar dataKey="totalHours" fill="hsl(16, 75%, 48%)" radius={[0, 4, 4, 0]} name="totalHours" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Trend chart */}
      {showTrend && trendData.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("admin:sstats_trend_title")}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="tasks" stroke="hsl(200, 60%, 32%)" strokeWidth={2} name={isDE ? "Aufgaben" : "Tasks"} />
                <Line type="monotone" dataKey="hours" stroke="hsl(16, 75%, 48%)" strokeWidth={2} name={isDE ? "Stunden" : "Hours"} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{t("admin:sstats_table_title")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-4">{isDE ? "Laden..." : "Loading..."}</div>
          ) : stats.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">{t("admin:sstats_no_data")}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort("name")}>
                      {t("admin:sstats_service")} <SortIcon col="name" />
                    </TableHead>
                    <TableHead>{isDE ? "Kategorie" : "Category"}</TableHead>
                    <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("taskCount")}>
                      {t("admin:sstats_tasks")} <SortIcon col="taskCount" />
                    </TableHead>
                    <TableHead className="text-right">{isDE ? "Erledigt" : "Done"}</TableHead>
                    <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("totalHours")}>
                      {t("admin:sstats_hours")} <SortIcon col="totalHours" />
                    </TableHead>
                    <TableHead className="cursor-pointer w-[180px]" onClick={() => toggleSort("utilization")}>
                      {t("admin:sstats_utilization")} <SortIcon col="utilization" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-sm">{row.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.category === "labor" ? (isDE ? "Labor" : "Lab") : (isDE ? "Technikum" : "Pilot Plant")}
                      </TableCell>
                      <TableCell className="text-right">{row.taskCount}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.completedCount}</TableCell>
                      <TableCell className="text-right">{row.totalHours} h</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Math.min(row.utilization, 100)}
                            className={cn("h-2 flex-1", row.utilization > 100 ? "[&>div]:bg-destructive" : row.utilization > 80 ? "[&>div]:bg-warning" : "")}
                          />
                          <span className={cn("text-xs font-medium w-12 text-right",
                            row.utilization > 100 ? "text-destructive" : row.utilization > 80 ? "text-warning" : "text-muted-foreground"
                          )}>
                            {row.utilization}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
