import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Clock, CheckCircle2, FolderOpen, Search, Eye, FlaskConical, FileText, Beaker } from "lucide-react";
import { useOrders } from "@/hooks/useOrders";
import { useProjects } from "@/hooks/useProjects";
import { useMyMeasurements } from "@/hooks/useMeasurements";
import { useSamples } from "@/hooks/useSamples";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { UtilizationSidebar } from "@/components/UtilizationSidebar";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function formatLocation(loc: any) {
  if (!loc) return "–";
  return [loc.hall, loc.room, loc.shelf, loc.position].filter(Boolean).join(" › ");
}

export default function Dashboard() {
  const { user, profile, role } = useAuth();
  const { t } = useTranslation(["common", "navigation", "orders", "samples"]);
  const { data: orders = [] } = useOrders();
  const { data: projects = [] } = useProjects();
  const { data: myMeasurements = [] } = useMyMeasurements();
  const { data: samples = [] } = useSamples();
  const etaMap = useEstimatedCompletion();

  // Fetch measurement services for filter
  const { data: services = [] } = useQuery({
    queryKey: ["measurement-services-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurement_services")
        .select("id, service_name")
        .eq("active", true)
        .order("service_name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch sample → measurement type mapping
  const { data: sampleMeasurementTypes = new Map<string, string[]>() } = useQuery({
    queryKey: ["sample-measurement-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurement_orders")
        .select("sample_id, order_measurements(service_id, measurement_services:service_id(service_name))")
        .not("sample_id", "is", null);
      if (error) throw error;
      const map = new Map<string, string[]>();
      for (const order of (data || [])) {
        if (!order.sample_id) continue;
        const names = (order.order_measurements || [])
          .map((om: any) => om.measurement_services?.service_name)
          .filter(Boolean);
        const existing = map.get(order.sample_id) || [];
        map.set(order.sample_id, [...new Set([...existing, ...names])]);
      }
      return map;
    },
    enabled: !!user,
  });

  // Search & filter state
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterProject, setFilterProject] = useState<string>("__all__");
  const [filterService, setFilterService] = useState<string>("__all__");
  const [filterHazardous, setFilterHazardous] = useState<string>("__all__");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  type SortOption = "created_desc" | "created_asc" | "eta" | "location" | "name";
  const [sortBy, setSortBy] = useState<SortOption>("created_desc");

  const hasActiveFilters = filterProject !== "__all__" || filterService !== "__all__" || filterHazardous !== "__all__" || filterTags.length > 0;
  const hasSearchOrFilters = search.trim() !== "" || hasActiveFilters;

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    (samples as any[]).forEach(s => {
      const tags = Array.isArray(s.tags) ? s.tags : [];
      tags.forEach((t: string) => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [samples]);

  const tagSuggestions = useMemo(() => {
    if (!tagInput.trim()) return [];
    const q = tagInput.toLowerCase();
    return allTags.filter(t => t.toLowerCase().includes(q) && !filterTags.includes(t)).slice(0, 5);
  }, [tagInput, allTags, filterTags]);

  // Filter samples
  const filteredSamples = useMemo(() => {
    let result = [...(samples as any[])];
    const q = search.toLowerCase().trim();

    if (q) {
      result = result.filter((s: any) => {
        const tags = Array.isArray(s.tags) ? s.tags : [];
        return (
          s.sample_number.toLowerCase().includes(q) ||
          s.sample_name.toLowerCase().includes(q) ||
          (s.description || "").toLowerCase().includes(q) ||
          tags.some((t: string) => t.toLowerCase().includes(q))
        );
      });
    }

    if (filterProject !== "__all__") result = result.filter((s: any) => s.project_id === filterProject);

    if (filterService !== "__all__") {
      result = result.filter((s: any) => {
        const types = sampleMeasurementTypes.get(s.id) || [];
        return types.some(name => {
          const svc = services.find(sv => sv.service_name === name);
          return svc?.id === filterService;
        });
      });
    }

    if (filterHazardous === "yes") result = result.filter((s: any) => s.is_hazardous);
    if (filterHazardous === "no") result = result.filter((s: any) => !s.is_hazardous);

    if (filterTags.length > 0) {
      result = result.filter((s: any) => {
        const tags: string[] = Array.isArray(s.tags) ? s.tags : [];
        return filterTags.every(ft => tags.some(t => t.toLowerCase() === ft.toLowerCase()));
      });
    }

    result.sort((a: any, b: any) => {
      switch (sortBy) {
        case "created_asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "created_desc": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "name": return (a.sample_name || "").localeCompare(b.sample_name || "");
        case "location": return formatLocation(a.storage_locations).localeCompare(formatLocation(b.storage_locations));
        case "eta": {
          const etaA = etaMap.get(a.id)?.getTime() || Infinity;
          const etaB = etaMap.get(b.id)?.getTime() || Infinity;
          return etaA - etaB;
        }
        default: return 0;
      }
    });

    return result;
  }, [samples, search, filterProject, filterService, filterHazardous, filterTags, sortBy, sampleMeasurementTypes, services, etaMap]);

  const resetFilters = () => {
    setFilterProject("__all__");
    setFilterService("__all__");
    setFilterHazardous("__all__");
    setFilterTags([]);
    setSortBy("created_desc");
    setSearch("");
  };

  const addFilterTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !filterTags.includes(trimmed)) setFilterTags(prev => [...prev, trimmed]);
    setTagInput("");
  };

  const removeFilterTag = (tag: string) => setFilterTags(prev => prev.filter(t => t !== tag));

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

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      neu: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      eingelagert: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      in_bearbeitung: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      teilweise_verbraucht: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
      vollstaendig_verbraucht: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      entsorgt: "bg-muted text-muted-foreground",
      zurueckgesendet: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    };
    return <Badge variant="outline" className={colors[status] || ""}>{t(`samples:status_${status}`)}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
          <p className="text-muted-foreground">{roleLabel}-Dashboard</p>
        </div>
        {(role === "auftraggeber" || role === "master") && (
          <Link to="/auftraege/neu">
            <Button>
              <ClipboardList className="h-4 w-4 mr-2" />
              {t("orders:new_order")}
            </Button>
          </Link>
        )}
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

      {/* Sample Search & Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            {t("samples:title")} – {t("samples:filter_show")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search bar + filter toggle */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("samples:search_placeholder")}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterOpen(o => !o)}
              className="gap-1.5"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {t("samples:filter_show")}
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px] bg-primary-foreground text-primary">!</Badge>
              )}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-muted-foreground">
                <X className="h-3.5 w-3.5" />{t("samples:filter_reset")}
              </Button>
            )}
          </div>

          {/* Expandable filter panel */}
          <Collapsible open={filterOpen} onOpenChange={setFilterOpen}>
            <CollapsibleContent>
              <div className="rounded-md border p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">{t("samples:filter_project")}</Label>
                    <Select value={filterProject} onValueChange={setFilterProject}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">{t("samples:filter_project_all")}</SelectItem>
                        {projects.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.project_number}{p.project_name ? ` – ${p.project_name}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">{t("samples:filter_measurement_type")}</Label>
                    <Select value={filterService} onValueChange={setFilterService}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">{t("samples:filter_measurement_type_all")}</SelectItem>
                        {services.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.service_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">{t("samples:filter_hazardous")}</Label>
                    <Select value={filterHazardous} onValueChange={setFilterHazardous}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">{t("samples:filter_hazardous_all")}</SelectItem>
                        <SelectItem value="yes">{t("samples:filter_hazardous_yes")}</SelectItem>
                        <SelectItem value="no">{t("samples:filter_hazardous_no")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">{t("samples:filter_sort")}</Label>
                    <Select value={sortBy} onValueChange={v => setSortBy(v as SortOption)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="created_desc">{t("samples:sort_created_desc")}</SelectItem>
                        <SelectItem value="created_asc">{t("samples:sort_created_asc")}</SelectItem>
                        <SelectItem value="name">{t("samples:sort_name")}</SelectItem>
                        <SelectItem value="eta">{t("samples:sort_eta")}</SelectItem>
                        <SelectItem value="location">{t("samples:sort_location")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Tags filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">{t("samples:filter_tags")}</Label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {filterTags.map(tag => (
                      <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                        <Tag className="h-3 w-3" />{tag}
                        <button type="button" onClick={() => removeFilterTag(tag)} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                  <div className="relative max-w-sm">
                    <Input
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addFilterTag(tagInput); } }}
                      placeholder={t("samples:filter_tags_placeholder")}
                      className="h-9"
                    />
                    {tagSuggestions.length > 0 && (
                      <div className="absolute z-10 top-full left-0 mt-1 w-full rounded-md border bg-popover shadow-md">
                        {tagSuggestions.map(suggestion => (
                          <button
                            key={suggestion}
                            type="button"
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                            onClick={() => addFilterTag(suggestion)}
                          >{suggestion}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Results table (show when searching/filtering, otherwise show summary) */}
          {hasSearchOrFilters ? (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("samples:sample_number")}</TableHead>
                    <TableHead>{t("samples:name")}</TableHead>
                    <TableHead>{t("samples:project")}</TableHead>
                    <TableHead>{t("samples:status")}</TableHead>
                    <TableHead>{t("samples:eta_short")}</TableHead>
                    <TableHead>{t("samples:location")}</TableHead>
                    <TableHead>{t("samples:tags")}</TableHead>
                    <TableHead>{t("samples:hazardous")}</TableHead>
                    <TableHead className="w-16">{t("samples:actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSamples.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">{t("samples:no_samples")}</TableCell>
                    </TableRow>
                  ) : (
                    filteredSamples.slice(0, 20).map((s: any) => {
                      const sampleTags: string[] = Array.isArray(s.tags) ? s.tags : [];
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.sample_number}</TableCell>
                          <TableCell>{s.sample_name}</TableCell>
                          <TableCell>{s.projects?.project_number || "–"}</TableCell>
                          <TableCell>{getStatusBadge(s.status || "neu")}</TableCell>
                          <TableCell>
                            {(() => {
                              const completed = ["vollstaendig_verbraucht", "entsorgt", "zurueckgesendet"];
                              if (completed.includes(s.status)) return <span className="text-muted-foreground text-xs">{t("samples:eta_completed")}</span>;
                              const eta = etaMap.get(s.id);
                              if (!eta) return <span className="text-muted-foreground text-xs">{t("samples:eta_no_orders")}</span>;
                              return <Badge variant="outline" className="gap-1 text-xs"><CalendarClock className="h-3 w-3" />{eta.toLocaleDateString("de-DE")}</Badge>;
                            })()}
                          </TableCell>
                          <TableCell className="text-sm">{formatLocation(s.storage_locations)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[120px]">
                              {sampleTags.length > 0 ? sampleTags.slice(0, 2).map(tag => (
                                <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                              )) : <span className="text-muted-foreground text-xs">–</span>}
                              {sampleTags.length > 2 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{sampleTags.length - 2}</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>
                            {s.is_hazardous ? (
                              <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{t("samples:hazard_yes")}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">{t("samples:hazard_no")}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" asChild>
                              <Link to={`/proben/${s.id}`}><Eye className="h-4 w-4" /></Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              {filteredSamples.length > 20 && (
                <div className="p-3 text-center border-t">
                  <Link to="/proben">
                    <Button variant="link" size="sm">
                      {t("samples:title")} ({filteredSamples.length}) →
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("samples:search_placeholder")}</p>
          )}
        </CardContent>
      </Card>

      {/* Recent orders / measurements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {role === "durchfuehrer" ? t("measurements:no_measurements", "Meine offenen Messungen") : t("orders:title")}
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

      {(role === "master" || role === "durchfuehrer") && (
        <UtilizationSidebar />
      )}
    </div>
  );
}
