import { useOrders, useDeleteOrder, useUpdateOrderRanking } from "@/hooks/useOrders";
import {
  useMyMeasurements,
  useUnassignedQualifiedMeasurements,
  useClaimMeasurement,
} from "@/hooks/useMeasurements";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, Trash2, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown, HandshakeIcon, Inbox } from "lucide-react";
import { useState, useMemo } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useIsAnyProjectLead } from "@/hooks/useProjectMembers";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function OrdersPage() {
  const { user, role } = useAuth();
  const { t, i18n } = useTranslation(["orders", "common", "measurements"]);
  const { data: orders = [], isLoading } = useOrders();
  const { data: myMeasurements = [], isLoading: isLoadingMine } = useMyMeasurements();
  const { data: isAnyProjectLead = false } = useIsAnyProjectLead();
  const deleteOrder = useDeleteOrder();
  const updateRanking = useUpdateOrderRanking();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  type SortKey = "order_number" | "project_number" | "project_name" | "order_type" | "ranking" | "status" | "due_date" | "created_at";
  type SortState = { key: SortKey; dir: "asc" | "desc" } | null;
  const [sort, setSort] = useState<SortState>(() => {
    try {
      const raw = sessionStorage.getItem("ordersPage.sort");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const applySort = (key: SortKey) => {
    setSort(prev => {
      let next: SortState;
      if (!prev || prev.key !== key) next = { key, dir: "asc" };
      else if (prev.dir === "asc") next = { key, dir: "desc" };
      else next = null;
      try { sessionStorage.setItem("ordersPage.sort", JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const getSortValue = (o: any, key: SortKey): any => {
    switch (key) {
      case "order_number": return o.order_number ?? "";
      case "project_number": return o.projects?.project_number ?? "";
      case "project_name": return o.projects?.project_name ?? "";
      case "order_type": return o.order_type ?? "";
      case "ranking": return o.ranking ?? 999;
      case "status": return o.status ?? "";
      case "due_date": return o.due_date ? new Date(o.due_date).getTime() : Number.POSITIVE_INFINITY;
      case "created_at": return o.created_at ? new Date(o.created_at).getTime() : 0;
    }
  };
  const SortableHead = ({ sortKey, children }: { sortKey: SortKey; children: React.ReactNode }) => {
    const active = sort?.key === sortKey;
    const Icon = active ? (sort!.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <TableHead>
        <button
          type="button"
          onClick={() => applySort(sortKey)}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          {children}
          <Icon className={`h-3.5 w-3.5 ${active ? "text-foreground" : "text-muted-foreground/60"}`} />
        </button>
      </TableHead>
    );
  };


  if (role === "durchfuehrer") {
    return <DurchfuehrerTasksView search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />;
  }


  const visibleOrders = orders;

  const filtered = useMemo(() => {
    const result = visibleOrders.filter((o: any) => {
      const matchesSearch = !search ||
        o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
        o.projects?.project_number?.toLowerCase().includes(search.toLowerCase()) ||
        o.projects?.project_name?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    if (!sort) return result;
    const { key, dir } = sort;
    const mult = dir === "asc" ? 1 : -1;
    return [...result].sort((a: any, b: any) => {
      const av = getSortValue(a, key);
      const bv = getSortValue(b, key);
      if (av == null && bv == null) return 0;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * mult;
      return String(av).localeCompare(String(bv), i18n.language, { numeric: true, sensitivity: "base" }) * mult;
    });
  }, [visibleOrders, search, statusFilter, sort, i18n.language]);


  const canCreateOrder = role === "master" || role === "auftraggeber" || isAnyProjectLead;
  const canShowActions = role === "master" || role === "auftraggeber" || isAnyProjectLead;

  const canDelete = (o: any) => {
    if (role === "master") return true;
    if (o.created_by === user?.id && o.status === "open") return true;
    return false;
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteOrder.mutateAsync(id);
      toast.success(t("orders:deleted"));
    } catch (err: any) {
      toast.error(t("orders:delete_error"), { description: err.message });
    }
  };

  const handleRankingChange = async (orderId: string, value: string) => {
    try {
      const ranking = value === "none" ? null : parseInt(value);
      await updateRanking.mutateAsync({ id: orderId, ranking });
      toast.success("Priorisierung aktualisiert");
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {role === "master" ? t("orders:all_title") : t("orders:title")}
          </h1>
          <p className="text-muted-foreground">{t("orders:subtitle")}</p>
        </div>
        {canCreateOrder && (
          <div className="flex gap-2">
            <Link to="/auftraege/neu">
              <Button><Plus className="h-4 w-4 mr-2" />{t("orders:new_order")}</Button>
            </Link>
            {role === "master" && (
              <Link to="/auftraege/import">
                <Button variant="outline"><FileSpreadsheet className="h-4 w-4 mr-2" />{t("orders:excel_import")}</Button>
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("orders:search_placeholder")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("common:status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("orders:all_status")}</SelectItem>
            <SelectItem value="open">{t("common:status_open")}</SelectItem>
            <SelectItem value="in_progress">{t("common:status_in_progress")}</SelectItem>
            <SelectItem value="completed">{t("common:status_completed")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead sortKey="order_number">{t("orders:order_number")}</SortableHead>
                <SortableHead sortKey="project_number">{t("orders:project_number")}</SortableHead>
                <SortableHead sortKey="project_name">{t("orders:project_name")}</SortableHead>
                <SortableHead sortKey="order_type">{t("orders:order_type")}</SortableHead>
                <SortableHead sortKey="ranking">{t("orders:priority")}</SortableHead>
                <SortableHead sortKey="status">{t("common:status")}</SortableHead>
                <SortableHead sortKey="due_date">{t("orders:due_date")}</SortableHead>
                <SortableHead sortKey="created_at">{t("common:created")}</SortableHead>
                {canShowActions && <TableHead className="w-[60px]">{t("common:actions")}</TableHead>}
              </TableRow>

            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("common:loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("orders:no_orders")}</TableCell></TableRow>
              ) : (
                filtered.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link to={`/auftraege/${o.id}`} className="font-mono font-medium text-primary hover:underline">
                        {o.order_number || "–"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {o.projects?.project_number ? (
                        <Link
                          to={`/projekte/${o.project_id}`}
                          className="text-destructive underline underline-offset-2 hover:opacity-80"
                        >
                          {o.projects.project_number}
                        </Link>
                      ) : "–"}
                    </TableCell>
                    <TableCell>{o.projects?.project_name || "–"}</TableCell>
                    <TableCell>{t(`common:order_type_${o.order_type}`)}</TableCell>
                    <TableCell>
                      {role === "master" ? (
                        <Select
                          value={o.ranking ? String(o.ranking) : "none"}
                          onValueChange={(val) => handleRankingChange(o.id, val)}
                        >
                          <SelectTrigger className="w-[100px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">–</SelectItem>
                            <SelectItem value="1">Prio 1</SelectItem>
                            <SelectItem value="2">Prio 2</SelectItem>
                            <SelectItem value="3">Prio 3</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <PriorityBadge ranking={o.ranking} />
                      )}
                    </TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                    <TableCell>{o.due_date ? new Date(o.due_date).toLocaleDateString(i18n.language === "en" ? "en-GB" : "de-DE") : "–"}</TableCell>
                    <TableCell>{new Date(o.created_at).toLocaleDateString(i18n.language === "en" ? "en-GB" : "de-DE")}</TableCell>
                    {canShowActions && (
                      <TableCell>
                        {canDelete(o) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("orders:delete_title")}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("orders:delete_description")}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(o.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  {t("common:delete")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    )}
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

/* -------------------------------------------------------------------------- */
/*  Messdienstleister-Ansicht: „Meine Aufgaben" mit zwei Bereichen            */
/*  1) zugewiesene Aufgaben  2) verfügbare (freie) Aufträge laut Kompetenz    */
/* -------------------------------------------------------------------------- */
function DurchfuehrerTasksView({
  search, setSearch, statusFilter, setStatusFilter,
}: {
  search: string;
  setSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
}) {
  const { t, i18n } = useTranslation(["orders", "common", "measurements"]);
  const { data: myMeasurements = [], isLoading: isLoadingMine } = useMyMeasurements();
  const { data: freeTasks = [], isLoading: isLoadingFree } = useUnassignedQualifiedMeasurements();
  const claim = useClaimMeasurement();
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // -------- Sortierung (einheitlich mit Rohstoffverwaltung / OrdersPage) --------
  type SortKey =
    | "measurement_number"
    | "priority"
    | "service"
    | "project"
    | "order_number"
    | "creator"
    | "due_date"
    | "created_at"
    | "status";
  type SortDir = "asc" | "desc";
  type SortSpec = { key: SortKey; dir: SortDir } | null;

  const loadSort = (storageKey: string): SortSpec => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw);
    } catch { /* noop */ }
    return null;
  };

  const [sortAssigned, setSortAssignedState] = useState<SortSpec>(() => loadSort("myTasks.sort.assigned"));
  const [sortFree, setSortFreeState] = useState<SortSpec>(() => loadSort("myTasks.sort.free"));

  const persistSort = (storageKey: string, s: SortSpec) => {
    try {
      if (s) localStorage.setItem(storageKey, JSON.stringify(s));
      else localStorage.removeItem(storageKey);
    } catch { /* noop */ }
  };

  const toggleSort = (
    current: SortSpec,
    setter: (s: SortSpec) => void,
    storageKey: string,
    key: SortKey,
  ) => {
    let next: SortSpec;
    if (!current || current.key !== key) next = { key, dir: "asc" };
    else if (current.dir === "asc") next = { key, dir: "desc" };
    else next = null; // dritter Klick → Standard
    setter(next);
    persistSort(storageKey, next);
  };

  const setSortAssigned = (s: SortSpec) => { setSortAssignedState(s); persistSort("myTasks.sort.assigned", s); };
  const setSortFree = (s: SortSpec) => { setSortFreeState(s); persistSort("myTasks.sort.free", s); };

  // Extract sortable value per key
  const getSortValue = (m: any, key: SortKey): string | number => {
    switch (key) {
      case "measurement_number": return (m.measurement_number || "").toLowerCase();
      case "priority": return m.ranking ?? m.measurement_orders?.ranking ?? 999;
      case "service": return (m.measurement_services?.service_name || "").toLowerCase();
      case "project": return (m.measurement_orders?.projects?.project_number || m.measurement_orders?.projects?.project_name || "").toLowerCase();
      case "order_number": return (m.measurement_orders?.order_number || "").toLowerCase();
      case "creator": return m.creator_profile ? `${m.creator_profile.last_name || ""} ${m.creator_profile.first_name || ""}`.trim().toLowerCase() : "";
      case "due_date": return m.due_date ? new Date(m.due_date).getTime() : Number.POSITIVE_INFINITY;
      case "created_at": return m.created_at ? new Date(m.created_at).getTime() : 0;
      case "status": return (m.status || "").toLowerCase();
    }
  };

  const compareBy = (a: any, b: any, key: SortKey): number => {
    const av = getSortValue(a, key);
    const bv = getSortValue(b, key);
    if (typeof av === "number" && typeof bv === "number") return av - bv;
    return String(av).localeCompare(String(bv), i18n.language, { numeric: true, sensitivity: "base" });
  };

  // Standard-Sortierung: höchste Priorität → frühestes Fälligkeitsdatum → neueste Zuweisung
  const defaultComparator = (a: any, b: any): number => {
    let c = compareBy(a, b, "priority");
    if (c !== 0) return c;
    c = compareBy(a, b, "due_date");
    if (c !== 0) return c;
    // neueste Zuweisung zuerst → created_at desc
    return -compareBy(a, b, "created_at");
  };

  const buildComparator = (spec: SortSpec) => {
    if (!spec) return defaultComparator;
    return (a: any, b: any) => {
      const mult = spec.dir === "asc" ? 1 : -1;
      const primary = compareBy(a, b, spec.key) * mult;
      if (primary !== 0) return primary;
      return defaultComparator(a, b);
    };
  };

  const matches = (m: any) => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      m.measurement_number?.toLowerCase().includes(q) ||
      m.measurement_services?.service_name?.toLowerCase().includes(q) ||
      m.measurement_orders?.order_number?.toLowerCase().includes(q) ||
      m.measurement_orders?.projects?.project_number?.toLowerCase().includes(q) ||
      m.measurement_orders?.projects?.project_name?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  };

  const assigned = useMemo(
    () => (myMeasurements as any[]).filter(matches).sort(buildComparator(sortAssigned)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myMeasurements, search, statusFilter, sortAssigned, i18n.language]
  );

  const free = useMemo(
    () => (freeTasks as any[]).filter(matches).sort(buildComparator(sortFree)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [freeTasks, search, statusFilter, sortFree, i18n.language]
  );

  const handleClaim = async (id: string, label: string) => {
    setClaimingId(id);
    try {
      await claim.mutateAsync(id);
      toast.success(`Auftrag „${label}" übernommen`);
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("already assigned")) {
        toast.error("Bereits vergeben", { description: "Dieser Auftrag wurde soeben von einem anderen Mitarbeiter übernommen." });
      } else if (msg.includes("not qualified")) {
        toast.error("Nicht berechtigt", { description: "Für diese Dienstleistung fehlt die Qualifikation." });
      } else {
        toast.error("Übernahme fehlgeschlagen", { description: msg });
      }
    } finally {
      setClaimingId(null);
    }
  };

  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString(i18n.language === "en" ? "en-GB" : "de-DE") : "–";

  const SortIcon = ({ active, dir }: { active: boolean; dir?: SortDir }) =>
    !active ? <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-50" />
    : dir === "asc" ? <ArrowUp className="h-3 w-3 inline ml-1" />
    : <ArrowDown className="h-3 w-3 inline ml-1" />;

  const SortableHead = ({
    label, sortKey, spec, setter, storageKey, className,
  }: {
    label: string;
    sortKey: SortKey;
    spec: SortSpec;
    setter: (s: SortSpec) => void;
    storageKey: string;
    className?: string;
  }) => {
    const active = spec?.key === sortKey;
    return (
      <TableHead className={className}>
        <button
          type="button"
          onClick={() => toggleSort(spec, setter, storageKey, sortKey)}
          className={`inline-flex items-center hover:text-foreground ${active ? "text-foreground font-semibold" : ""}`}
        >
          {label}<SortIcon active={active} dir={spec?.dir} />
        </button>
      </TableHead>
    );
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("orders:my_title")}</h1>
        <p className="text-muted-foreground">
          Bearbeite deine zugewiesenen Aufgaben oder übernehme einen freien Auftrag aus deinem Qualifikationsbereich.
        </p>
      </div>

      {/* Gemeinsame Filter für beide Bereiche */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("orders:search_placeholder")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder={t("common:status")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("orders:all_status")}</SelectItem>
            <SelectItem value="open">{t("common:status_open")}</SelectItem>
            <SelectItem value="in_progress">{t("common:status_in_progress")}</SelectItem>
            <SelectItem value="completed">{t("common:status_completed")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 1) Meine zugewiesenen Aufgaben */}
      <Card>
        <CardHeader className="py-3 flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base">Meine zugewiesenen Aufgaben</CardTitle>
          <Badge variant="outline">{assigned.length}</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Aufgaben-Nr." sortKey="measurement_number" spec={sortAssigned} setter={setSortAssigned} storageKey="myTasks.sort.assigned" />
                <SortableHead label="Dienstleistung" sortKey="service" spec={sortAssigned} setter={setSortAssigned} storageKey="myTasks.sort.assigned" />
                <SortableHead label={t("orders:order_number")} sortKey="order_number" spec={sortAssigned} setter={setSortAssigned} storageKey="myTasks.sort.assigned" />
                <SortableHead label="Ersteller" sortKey="creator" spec={sortAssigned} setter={setSortAssigned} storageKey="myTasks.sort.assigned" />
                <SortableHead label={t("orders:project_number")} sortKey="project" spec={sortAssigned} setter={setSortAssigned} storageKey="myTasks.sort.assigned" />
                <SortableHead label={t("common:status")} sortKey="status" spec={sortAssigned} setter={setSortAssigned} storageKey="myTasks.sort.assigned" />
                <SortableHead label={t("orders:priority")} sortKey="priority" spec={sortAssigned} setter={setSortAssigned} storageKey="myTasks.sort.assigned" />
                <SortableHead label={t("orders:due_date")} sortKey="due_date" spec={sortAssigned} setter={setSortAssigned} storageKey="myTasks.sort.assigned" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingMine ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">{t("common:loading")}</TableCell></TableRow>
              ) : assigned.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">{t("measurements:no_measurements", "Keine Aufgaben")}</TableCell></TableRow>
              ) : assigned.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono font-medium">
                    <Link to={`/aufgaben/${m.id}`} className="text-primary hover:underline">{m.measurement_number}</Link>
                  </TableCell>
                  <TableCell>{m.measurement_services?.service_name || "–"}</TableCell>
                  <TableCell className="font-mono">{m.measurement_orders?.order_number || "–"}</TableCell>
                  <TableCell>{m.creator_profile ? `${m.creator_profile.first_name} ${m.creator_profile.last_name}` : "–"}</TableCell>
                  <TableCell>
                    {m.measurement_orders?.projects?.project_number ? (
                      <Link to={`/projekte/${m.measurement_orders.project_id}`} className="text-destructive underline underline-offset-2 hover:opacity-80">
                        {m.measurement_orders.projects.project_number}
                      </Link>
                    ) : "–"}
                  </TableCell>
                  <TableCell><StatusBadge status={m.status} /></TableCell>
                  <TableCell><PriorityBadge ranking={m.ranking ?? m.measurement_orders?.ranking} /></TableCell>
                  <TableCell>{fmtDate(m.due_date)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 2) Verfügbare Aufträge (gemäß Kompetenzmatrix) */}
      <Card>
        <CardHeader className="py-3 flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Inbox className="h-4 w-4" /> Verfügbare Aufträge
            <span className="text-xs font-normal text-muted-foreground">
              — freie Aufträge deiner Qualifikationen
            </span>
          </CardTitle>
          <Badge variant="outline">{free.length}</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Aufgaben-Nr." sortKey="measurement_number" spec={sortFree} setter={setSortFree} storageKey="myTasks.sort.free" />
                <SortableHead label="Dienstleistung" sortKey="service" spec={sortFree} setter={setSortFree} storageKey="myTasks.sort.free" />
                <SortableHead label={t("orders:order_number")} sortKey="order_number" spec={sortFree} setter={setSortFree} storageKey="myTasks.sort.free" />
                <SortableHead label={t("orders:project_number")} sortKey="project" spec={sortFree} setter={setSortFree} storageKey="myTasks.sort.free" />
                <SortableHead label={t("orders:priority")} sortKey="priority" spec={sortFree} setter={setSortFree} storageKey="myTasks.sort.free" />
                <SortableHead label={t("orders:due_date")} sortKey="due_date" spec={sortFree} setter={setSortFree} storageKey="myTasks.sort.free" />
                <TableHead className="w-[180px] text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingFree ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("common:loading")}</TableCell></TableRow>
              ) : free.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aktuell keine freien Aufträge für deine Qualifikationen.</TableCell></TableRow>
              ) : free.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono font-medium">{m.measurement_number}</TableCell>
                  <TableCell>{m.measurement_services?.service_name || "–"}</TableCell>
                  <TableCell className="font-mono">
                    <Link to={`/auftraege/${m.order_id}`} className="text-primary hover:underline">
                      {m.measurement_orders?.order_number || "–"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {m.measurement_orders?.projects?.project_number ? (
                      <Link to={`/projekte/${m.measurement_orders.project_id}`} className="text-destructive underline underline-offset-2 hover:opacity-80">
                        {m.measurement_orders.projects.project_number}
                      </Link>
                    ) : "–"}
                  </TableCell>
                  <TableCell><PriorityBadge ranking={m.ranking ?? m.measurement_orders?.ranking} /></TableCell>
                  <TableCell>{fmtDate(m.due_date)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      disabled={claimingId === m.id}
                      onClick={() => handleClaim(m.id, m.measurement_services?.service_name || m.measurement_number)}
                    >
                      <HandshakeIcon className="h-4 w-4 mr-2" />
                      {claimingId === m.id ? "Übernehme..." : "Auftrag übernehmen"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
