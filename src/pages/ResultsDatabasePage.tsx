import { useState, useMemo } from "react";
import { useResultsDatabase, getUniqueParameterNames, getParameterValue, type ResultRecord } from "@/hooks/useResultsDatabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Database, BarChart3, Filter, X, Search } from "lucide-react";
import { format, parseISO, isAfter, isBefore } from "date-fns";
import { de } from "date-fns/locale";
import * as XLSX from "xlsx";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, Legend, LineChart, Line } from "recharts";

const CHART_COLORS = [
  "hsl(200, 60%, 32%)", "hsl(16, 75%, 48%)", "hsl(152, 55%, 36%)",
  "hsl(38, 85%, 50%)", "hsl(270, 50%, 50%)", "hsl(330, 60%, 45%)",
  "hsl(180, 50%, 35%)", "hsl(60, 70%, 45%)",
];

export default function ResultsDatabasePage() {
  const { data: records = [], isLoading } = useResultsDatabase();

  // Filters
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
  const [technicianFilter, setTechnicianFilter] = useState<string>("all");
  const [sampleFilter, setSampleFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchText, setSearchText] = useState("");

  // Chart state
  const [chartType, setChartType] = useState<"scatter" | "bar" | "line">("scatter");
  const [xAxis, setXAxis] = useState<string>("");
  const [yAxis, setYAxis] = useState<string>("");
  const [groupBy, setGroupBy] = useState<string>("none");

  const { inputParameterNames, outputParameterNames } = useMemo(
    () => getUniqueParameterNames(records), [records]
  );
  const allParamNames = useMemo(
    () => [...inputParameterNames, ...outputParameterNames], [inputParameterNames, outputParameterNames]
  );

  // Unique values for filters
  const uniqueServices = useMemo(() => [...new Set(records.map(r => r.serviceName))].sort(), [records]);
  const uniqueProjects = useMemo(() => [...new Set(records.map(r => r.projectName).filter(Boolean))].sort(), [records]);
  const uniqueCreators = useMemo(() => [...new Set(records.map(r => r.createdByName).filter(Boolean))].sort(), [records]);
  const uniqueTechnicians = useMemo(() => [...new Set(records.map(r => r.assignedToName).filter(Boolean))].sort(), [records]);

  // Apply filters
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (serviceFilter !== "all" && r.serviceName !== serviceFilter) return false;
      if (projectFilter !== "all" && r.projectName !== projectFilter) return false;
      if (creatorFilter !== "all" && r.createdByName !== creatorFilter) return false;
      if (technicianFilter !== "all" && r.assignedToName !== technicianFilter) return false;
      if (sampleFilter && !r.sampleNumber.toLowerCase().includes(sampleFilter.toLowerCase()) && !r.sampleName.toLowerCase().includes(sampleFilter.toLowerCase())) return false;
      if (dateFrom && r.completedAt && isBefore(parseISO(r.completedAt), parseISO(dateFrom))) return false;
      if (dateTo && r.completedAt && isAfter(parseISO(r.completedAt), parseISO(dateTo + "T23:59:59"))) return false;
      if (searchText) {
        const s = searchText.toLowerCase();
        const matches = [r.measurementNumber, r.orderNumber, r.projectNumber, r.projectName, r.sampleNumber, r.sampleName, r.serviceName, r.assignedToName, r.createdByName, r.remarks]
          .some(v => v?.toLowerCase().includes(s));
        if (!matches) return false;
      }
      return true;
    });
  }, [records, serviceFilter, projectFilter, creatorFilter, technicianFilter, sampleFilter, dateFrom, dateTo, searchText]);

  const clearFilters = () => {
    setServiceFilter("all");
    setProjectFilter("all");
    setCreatorFilter("all");
    setTechnicianFilter("all");
    setSampleFilter("");
    setDateFrom("");
    setDateTo("");
    setSearchText("");
  };

  const hasActiveFilters = serviceFilter !== "all" || projectFilter !== "all" || creatorFilter !== "all" || technicianFilter !== "all" || sampleFilter || dateFrom || dateTo || searchText;

  // Export functions
  const exportToExcel = () => {
    const rows = filteredRecords.map(r => {
      const row: Record<string, any> = {
        "Messnummer": r.measurementNumber,
        "Auftragsnummer": r.orderNumber,
        "Projekt": r.projectName || r.projectNumber,
        "Probe": r.sampleName || r.sampleNumber,
        "Messart": r.serviceName,
        "Auftraggeber": r.createdByName,
        "Messdienstleister": r.assignedToName,
        "Abgeschlossen": r.completedAt ? format(parseISO(r.completedAt), "dd.MM.yyyy", { locale: de }) : "",
        "Ist-Dauer (h)": r.actualDurationHours ?? r.standardDurationHours,
      };
      // Add input params
      inputParameterNames.forEach(name => {
        const p = r.inputParameters[name];
        row[`[E] ${name}`] = p?.value ?? "";
      });
      // Add output results
      outputParameterNames.forEach(name => {
        const res = r.outputResults.find(o => o.result_name === name);
        row[`[A] ${name}`] = res?.value ?? "";
      });
      row["Bemerkungen"] = r.remarks;
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ergebnisse");
    XLSX.writeFile(wb, `Ergebnisdatenbank_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const exportToCSV = () => {
    const rows = filteredRecords.map(r => {
      const row: Record<string, any> = {
        "Messnummer": r.measurementNumber,
        "Auftragsnummer": r.orderNumber,
        "Projekt": r.projectName || r.projectNumber,
        "Probe": r.sampleName || r.sampleNumber,
        "Messart": r.serviceName,
        "Auftraggeber": r.createdByName,
        "Messdienstleister": r.assignedToName,
        "Abgeschlossen": r.completedAt ? format(parseISO(r.completedAt), "dd.MM.yyyy", { locale: de }) : "",
      };
      inputParameterNames.forEach(name => {
        row[name] = r.inputParameters[name]?.value ?? "";
      });
      outputParameterNames.forEach(name => {
        const res = r.outputResults.find(o => o.result_name === name);
        row[name] = res?.value ?? "";
      });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Ergebnisdatenbank_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Chart data
  const chartData = useMemo(() => {
    if (!xAxis || !yAxis) return [];
    return filteredRecords
      .map(r => {
        const xVal = getParameterValue(r, xAxis);
        const yVal = getParameterValue(r, yAxis);
        if (xVal == null || yVal == null) return null;
        return {
          x: xVal,
          y: yVal,
          group: groupBy === "project" ? r.projectName : groupBy === "service" ? r.serviceName : groupBy === "creator" ? r.createdByName : "Alle",
          label: r.measurementNumber,
        };
      })
      .filter(Boolean) as Array<{ x: number; y: number; group: string; label: string }>;
  }, [filteredRecords, xAxis, yAxis, groupBy]);

  const chartGroups = useMemo(() => {
    if (groupBy === "none") return [{ name: "Alle", data: chartData }];
    const groups = new Map<string, typeof chartData>();
    chartData.forEach(d => {
      if (!groups.has(d.group)) groups.set(d.group, []);
      groups.get(d.group)!.push(d);
    });
    return Array.from(groups.entries()).map(([name, data]) => ({ name, data }));
  }, [chartData, groupBy]);


  const resultColumns = useMemo<DataTableColumn<ResultRecord>[]>(() => {
    const base: DataTableColumn<ResultRecord>[] = [
      { key: "measurementNumber", header: "Messnr.", accessor: r => r.measurementNumber, cell: r => <span className="font-mono text-xs">{r.measurementNumber}</span> },
      { key: "orderNumber", header: "Auftragsnr.", accessor: r => r.orderNumber, cell: r => <span className="font-mono text-xs">{r.orderNumber}</span> },
      { key: "serviceName", type: "status", header: "Messart", accessor: r => r.serviceName, cell: r => <Badge variant="secondary" className="text-xs">{r.serviceName}</Badge> },
      { key: "projectName", header: "Projekt", accessor: r => r.projectName || r.projectNumber },
      { key: "sampleName", header: "Probe", accessor: r => r.sampleName || r.sampleNumber },
      { key: "createdByName", type: "status", header: "Auftraggeber", accessor: r => r.createdByName },
      { key: "assignedToName", type: "status", header: "MDL", accessor: r => r.assignedToName },
      { key: "completedAt", type: "date", header: "Abgeschlossen", accessor: r => r.completedAt ?? null,
        cell: r => r.completedAt ? format(parseISO(r.completedAt), "dd.MM.yy", { locale: de }) : "-" },
      { key: "duration", type: "number", header: "Dauer (h)", accessor: r => r.actualDurationHours ?? r.standardDurationHours ?? null,
        cell: r => <span className="font-mono text-sm">{r.actualDurationHours ?? r.standardDurationHours ?? "-"}</span> },
    ];
    outputParameterNames.slice(0, 5).forEach(name => {
      base.push({
        key: `out_${name}`,
        type: "number",
        header: name,
        accessor: r => {
          const res = r.outputResults.find(o => o.result_name === name);
          const v = res?.value;
          return v == null ? null : v;
        },
        cell: r => {
          const res = r.outputResults.find(o => o.result_name === name);
          return <span className="font-mono text-sm">{res?.value != null ? String(res.value) : "-"}</span>;
        },
      });
    });
    return base;
  }, [outputParameterNames]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Ergebnisdatenbank
          </h1>
          <p className="text-muted-foreground">
            {filteredRecords.length} von {records.length} abgeschlossenen Aufgaben
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={filteredRecords.length === 0}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel} disabled={filteredRecords.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filter
            </CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" /> Zurücksetzen
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Volltextsuche..." value={searchText} onChange={e => setSearchText(e.target.value)} className="pl-9" />
            </div>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger><SelectValue placeholder="Messart" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Messarten</SelectItem>
                {uniqueServices.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger><SelectValue placeholder="Projekt" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Projekte</SelectItem>
                {uniqueProjects.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={creatorFilter} onValueChange={setCreatorFilter}>
              <SelectTrigger><SelectValue placeholder="Auftraggeber" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Auftraggeber</SelectItem>
                {uniqueCreators.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
              <SelectTrigger><SelectValue placeholder="Messdienstleister" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Messdienstleister</SelectItem>
                {uniqueTechnicians.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Proben-ID..." value={sampleFilter} onChange={e => setSampleFilter(e.target.value)} />
            <Input type="date" placeholder="Von" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <Input type="date" placeholder="Bis" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">Tabelle</TabsTrigger>
          <TabsTrigger value="statistics">Statistik & Diagramme</TabsTrigger>
        </TabsList>

        {/* Table View */}
        <TabsContent value="table">
          <Card>
            <CardContent className="p-4">
              <DataTable
                tableId="results-database"
                columns={resultColumns}
                rows={filteredRecords}
                rowKey={(r) => r.measurementId}
                searchPlaceholder="Tabelle durchsuchen …"
                emptyMessage="Keine abgeschlossenen Aufgaben gefunden"
                defaultSort={{ key: "completedAt", dir: "desc" }}
              />
            </CardContent>
          </Card>
        </TabsContent>


        {/* Statistics View */}
        <TabsContent value="statistics">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Diagramm-Konfiguration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Diagrammtyp</label>
                    <Select value={chartType} onValueChange={v => setChartType(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scatter">Scatter Plot</SelectItem>
                        <SelectItem value="bar">Balkendiagramm</SelectItem>
                        <SelectItem value="line">Liniendiagramm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">X-Achse</label>
                    <Select value={xAxis} onValueChange={setXAxis}>
                      <SelectTrigger><SelectValue placeholder="Parameter wählen" /></SelectTrigger>
                      <SelectContent>
                        {allParamNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Y-Achse</label>
                    <Select value={yAxis} onValueChange={setYAxis}>
                      <SelectTrigger><SelectValue placeholder="Parameter wählen" /></SelectTrigger>
                      <SelectContent>
                        {allParamNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Gruppierung</label>
                    <Select value={groupBy} onValueChange={setGroupBy}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Keine</SelectItem>
                        <SelectItem value="project">Projekt</SelectItem>
                        <SelectItem value="service">Messart</SelectItem>
                        <SelectItem value="creator">Auftraggeber</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                {!xAxis || !yAxis ? (
                  <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                    Bitte X- und Y-Achse wählen
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                    Keine numerischen Daten für die gewählten Parameter vorhanden
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    {chartType === "scatter" ? (
                      <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" dataKey="x" name={xAxis} label={{ value: xAxis, position: "bottom", offset: 0 }} fontSize={12} />
                        <YAxis type="number" dataKey="y" name={yAxis} label={{ value: yAxis, angle: -90, position: "insideLeft" }} fontSize={12} />
                        <Tooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload;
                            return (
                              <div className="rounded-lg border bg-background p-2 text-xs shadow-md">
                                <p className="font-medium">{d.label}</p>
                                <p>{xAxis}: {d.x}</p>
                                <p>{yAxis}: {d.y}</p>
                                {groupBy !== "none" && <p className="text-muted-foreground">{d.group}</p>}
                              </div>
                            );
                          }}
                        />
                        <Legend />
                        {chartGroups.map((g, i) => (
                          <Scatter key={g.name} name={g.name} data={g.data} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </ScatterChart>
                    ) : chartType === "bar" ? (
                      <BarChart data={chartData} margin={{ top: 10, right: 30, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="x" name={xAxis} fontSize={12} label={{ value: xAxis, position: "bottom", offset: 0 }} />
                        <YAxis fontSize={12} label={{ value: yAxis, angle: -90, position: "insideLeft" }} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload;
                            return (
                              <div className="rounded-lg border bg-background p-2 text-xs shadow-md">
                                <p className="font-medium">{d.label}</p>
                                <p>{xAxis}: {d.x}</p>
                                <p>{yAxis}: {d.y}</p>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="y" name={yAxis} radius={[4, 4, 0, 0]}>
                          {chartData.map((d, i) => (
                            <Cell key={i} fill={CHART_COLORS[chartGroups.findIndex(g => g.name === d.group) % CHART_COLORS.length] || CHART_COLORS[0]} />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : (
                      <LineChart data={chartData.sort((a, b) => a.x - b.x)} margin={{ top: 10, right: 30, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="x" fontSize={12} label={{ value: xAxis, position: "bottom", offset: 0 }} />
                        <YAxis fontSize={12} label={{ value: yAxis, angle: -90, position: "insideLeft" }} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload;
                            return (
                              <div className="rounded-lg border bg-background p-2 text-xs shadow-md">
                                <p className="font-medium">{d.label}</p>
                                <p>{xAxis}: {d.x}</p>
                                <p>{yAxis}: {d.y}</p>
                              </div>
                            );
                          }}
                        />
                        <Line type="monotone" dataKey="y" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 4 }} name={yAxis} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Summary stats */}
            {xAxis && yAxis && chartData.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-4">
                {[
                  { label: "Datenpunkte", value: chartData.length },
                  { label: `Ø ${yAxis}`, value: (chartData.reduce((s, d) => s + d.y, 0) / chartData.length).toFixed(2) },
                  { label: `Min ${yAxis}`, value: Math.min(...chartData.map(d => d.y)).toFixed(2) },
                  { label: `Max ${yAxis}`, value: Math.max(...chartData.map(d => d.y)).toFixed(2) },
                ].map(stat => (
                  <Card key={stat.label}>
                    <CardContent className="pt-4 pb-3">
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-xl font-bold font-mono">{stat.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
