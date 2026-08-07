import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useProjectDetail, useProjectSamples, useProjectOrders, useProjectSampleHistory } from "@/hooks/useProjectDetail";
import { useEstimatedCompletion } from "@/hooks/useEstimatedCompletion";
import { useUsers } from "@/hooks/useUsers";
import { useProjectConsumables, useProjectKnetungMaterials } from "@/hooks/useProjectMaterials";
import { useProjectExpenses } from "@/hooks/useProjectExpenses";
import { useProjectTimeEntries } from "@/hooks/useProjectTimeEntries";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, FlaskConical, Clock, DollarSign, FileText, Printer, CalendarClock, AlertTriangle, Package, Download, CheckCircle2, RotateCcw, Users, ClipboardList, Shield, ClipboardCheck, Briefcase, Pencil } from "lucide-react";
import { useMemo, useRef, useCallback, useState } from "react";
import { EditProjectIdentityDialog } from "@/components/EditProjectIdentityDialog";
import { ProjectMaterialCosts } from "@/components/ProjectMaterialCosts";
import { ProjectTimeEntries } from "@/components/ProjectTimeEntries";
import { ProjectTeamTab } from "@/components/ProjectTeamTab";
import { ProjectPlanningTab } from "@/components/ProjectPlanningTab";
import { WeeklyReviewsTab } from "@/components/WeeklyReviewsTab";
import { ProjectDocumentsTab } from "@/components/ProjectDocumentsTab";
import { ProjectGovernanceTab } from "@/components/ProjectGovernanceTab";
import { ProjectClosureTab } from "@/components/ProjectClosureTab";
import { ProjectBudgetCard } from "@/components/ProjectBudgetCard";
import { ProjectCostBreakdown } from "@/components/ProjectCostBreakdown";
import { buildCostBreakdown } from "@/lib/costBreakdown";
import { ProjectServicesTab } from "@/components/ProjectServicesTab";


import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/formatCurrency";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function formatLocation(loc: any) {
  if (!loc) return "–";
  return [loc.hall, loc.room, loc.shelf, loc.position].filter(Boolean).join(" › ");
}

function getUserName(users: any[], userId: string) {
  const u = users.find((u: any) => u.user_id === userId);
  return u ? `${u.first_name} ${u.last_name}`.trim() || "–" : "–";
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("projects");
  const { role, user } = useAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const canViewPersonnelCosts = role === "master" || hasPermission("costs.view_personnel");
  const { data: project, isLoading } = useProjectDetail(id);
  const { data: samples = [] } = useProjectSamples(id);
  const { data: orders = [] } = useProjectOrders(id);
  const { data: users = [] } = useUsers();
  const { data: projectConsumables = [] } = useProjectConsumables(id);
  const { data: projectKnetung = [] } = useProjectKnetungMaterials(id);
  const { data: projectExpenses = [] } = useProjectExpenses(id!);
  const { data: timeEntries = [] } = useProjectTimeEntries(id);
  const { data: members = [] } = useProjectMembers(id);
  const etaMap = useEstimatedCompletion();
  const reportRef = useRef<HTMLDivElement>(null);

  // Determine current user's project role
  const myProjectRole = useMemo(() => {
    if (!user) return null;
    const m = (members as any[]).find((m: any) => m.user_id === user.id);
    return m?.role || null;
  }, [members, user]);

  const isMaster = role === "master";
  const isLeaderOrOwner = myProjectRole === "leader" || myProjectRole === "owner";
  const canEditByPermission = hasPermission("projects.edit");
  const canManageTeam = isMaster || isLeaderOrOwner || canEditByPermission;
  const canManagePlanning = isMaster || isLeaderOrOwner || canEditByPermission;
  const canEditTrafficLight = isMaster || isLeaderOrOwner || canEditByPermission;

  const isProjectCompleted = (project as any)?.project_status === "completed";
  const canEditIdentity = isMaster || isLeaderOrOwner || canEditByPermission;
  const [editIdentityOpen, setEditIdentityOpen] = useState(false);

  const handleUpdateProject = useCallback(async (updates: Record<string, any>) => {
    if (!id) return;
    try {
      await api.projects.update(id, updates);
    } catch (err: any) { toast.error(err.message); return; }
    queryClient.invalidateQueries({ queryKey: ["project-detail", id] });
    queryClient.invalidateQueries({ queryKey: ["projects-with-stats"] });
  }, [id, queryClient]);

  const sampleIds = useMemo(() => (samples as any[]).map((s: any) => s.id), [samples]);
  const { data: history = [] } = useProjectSampleHistory(sampleIds);

  // Aggregate all measurements from all orders
  const allMeasurements = useMemo(() => {
    return (orders as any[]).flatMap((o: any) =>
      (o.order_measurements || []).map((m: any) => ({
        ...m,
        orderNumber: o.order_number,
        sampleName: o.samples?.sample_name || o.samples?.sample_number || "–",
      }))
    );
  }, [orders]);

  // Aggregate all work logs
  const allWorkLogs = useMemo(() => {
    return allMeasurements.flatMap((m: any) =>
      (m.work_logs || []).map((wl: any) => ({
        ...wl,
        measurementNumber: m.measurement_number,
        serviceName: m.measurement_services?.service_name || "–",
        hourlyRate: m.measurement_services?.hourly_rate || 0,
      }))
    );
  }, [allMeasurements]);

  // Cost aggregation – use actual_duration_hours (Ist-Dauer) when available (completed measurements),
  // otherwise fall back to sum of work_logs hours
  const costData = useMemo(() => {
    let totalPersonnel = 0;
    const perMeasurement = new Map<string, { name: string; hours: number; cost: number; source: string }>();

    for (const m of allMeasurements) {
      const rate = m.measurement_services?.hourly_rate || 0;
      const workLogHours = (m.work_logs || []).reduce((s: number, wl: any) => s + (wl.hours || 0), 0);
      // For completed measurements, prefer actual_duration_hours (entered at completion)
      const useActual = m.status === "completed" && m.actual_duration_hours != null;
      const hours = useActual ? Number(m.actual_duration_hours) : workLogHours;
      const cost = hours * rate;
      totalPersonnel += cost;
      perMeasurement.set(m.measurement_number, {
        name: m.measurement_services?.service_name || "–",
        hours,
        cost,
        source: useActual ? "actual" : "worklogs",
      });
    }

    return { totalPersonnel, perMeasurement: Array.from(perMeasurement.entries()) };
  }, [allMeasurements]);

  // Material costs from consumables + knetung raw materials + project expenses
  const totalExpensesCosts = useMemo(
    () => (projectExpenses as any[]).reduce((s, e) => s + Number(e.total_price || 0), 0),
    [projectExpenses]
  );
  const totalMaterialCosts = useMemo(() => {
    const conTotal = (projectConsumables as any[]).reduce((s, c) => s + Number(c.total_cost || 0), 0);
    const knTotal = (projectKnetung as any[]).reduce((s, k) => s + Number(k.total_cost || 0), 0);
    return conTotal + knTotal + totalExpensesCosts;
  }, [projectConsumables, projectKnetung, totalExpensesCosts]);

  const totalCosts = costData.totalPersonnel + totalMaterialCosts;

  // Transparente Aufschlüsselung – nutzt exakt dieselben Quellen/Formeln wie oben,
  // erzeugt daher keine zusätzlichen oder doppelten Kosten.
  const costBreakdown = useMemo(
    () => buildCostBreakdown({
      measurements: allMeasurements,
      timeEntries: timeEntries as any[],
      consumables: projectConsumables as any[],
      knetung: projectKnetung as any[],
      expenses: projectExpenses as any[],
    }),
    [allMeasurements, timeEntries, projectConsumables, projectKnetung, projectExpenses]
  );


  const timeEntryHours = useMemo(() => {
    return (timeEntries as any[]).reduce((s, e) => s + (e.duration_minutes || 0), 0) / 60;
  }, [timeEntries]);

  const totalHours = useMemo(() => {
    const measurementHours = allMeasurements.reduce((sum: number, m: any) => {
      const workLogHours = (m.work_logs || []).reduce((s: number, wl: any) => s + (wl.hours || 0), 0);
      const useActual = m.status === "completed" && m.actual_duration_hours != null;
      return sum + (useActual ? Number(m.actual_duration_hours) : workLogHours);
    }, 0);
    return measurementHours + timeEntryHours;
  }, [allMeasurements, timeEntryHours]);

  const getUserNameLocal = (userId: string) => getUserName(users as any[], userId);

  // CSV Export
  const handleCsvExport = useCallback(() => {
    if (!project) return;
    const sep = ";";
    const lines: string[] = [];
    const esc = (v: string) => `"${(v || "").replace(/"/g, '""')}"`;

    // Project info
    lines.push([t("csv_section_project")].join(sep));
    lines.push([t("project_name"), t("project_number"), t("created_at")].join(sep));
    lines.push([esc(project.project_name || "–"), esc(project.project_number), esc(new Date(project.created_at).toLocaleDateString("de-DE"))].join(sep));
    lines.push("");

    // Time entries
    lines.push([t("tab_time_entries")].join(sep));
    lines.push([t("time_date"), t("time_person"), t("time_duration_min"), t("time_note")].join(sep));
    for (const e of timeEntries as any[]) {
      lines.push([
        esc(new Date(e.entry_date).toLocaleDateString("de-DE")),
        esc(getUserNameLocal(e.person_id)),
        String(e.duration_minutes),
        esc(e.note || ""),
      ].join(sep));
    }
    const totalTimeMin = (timeEntries as any[]).reduce((s, e) => s + (e.duration_minutes || 0), 0);
    lines.push([t("total"), "", String(totalTimeMin), ""].join(sep));
    lines.push("");

    // Consumables
    const conTotal = (projectConsumables as any[]).reduce((s, c) => s + Number(c.total_cost || 0), 0);
    lines.push([t("materials:consumables_section")].join(sep));
    lines.push([t("materials:name"), t("materials:quantity"), t("materials:unit"), t("materials:price_per_unit"), t("materials:total")].join(sep));
    for (const c of projectConsumables as any[]) {
      lines.push([
        esc(c.consumables?.name || "–"),
        String(c.quantity),
        esc(c.consumables?.unit || ""),
        String(c.unit_price),
        String(c.total_cost || 0),
      ].join(sep));
    }
    lines.push([t("total"), "", "", "", String(conTotal.toFixed(2))].join(sep));
    lines.push("");

    // Knetung raw materials
    const knTotal = (projectKnetung as any[]).reduce((s, k) => s + Number(k.total_cost || 0), 0);
    lines.push([t("materials:knetung_section")].join(sep));
    lines.push([t("materials:name"), t("materials:quantity_kg"), t("materials:price_per_kg"), t("materials:total")].join(sep));
    for (const k of projectKnetung as any[]) {
      lines.push([
        esc(k.raw_materials?.material_name || "–"),
        String(k.quantity_kg),
        String(k.price_per_kg),
        String(k.total_cost || 0),
      ].join(sep));
    }
    lines.push([t("total"), "", "", String(knTotal.toFixed(2))].join(sep));
    lines.push("");

    // Project expenses
    const expTotal = (projectExpenses as any[]).reduce((s, e) => s + Number(e.total_price || 0), 0);
    lines.push(["Projektaufwendungen"].join(sep));
    lines.push(["Datum", "Kategorie", "Bezeichnung", "Lieferant", "Menge", "Einheit", "Einzelpreis", "Gesamtpreis", "Kostenstelle", "Bemerkungen"].join(sep));
    for (const e of projectExpenses as any[]) {
      lines.push([
        esc(e.expense_date ? new Date(e.expense_date).toLocaleDateString("de-DE") : ""),
        esc(e.project_expense_categories?.name_de || ""),
        esc(e.name || ""),
        esc(e.supplier || ""),
        e.quantity != null ? String(e.quantity) : "",
        esc(e.unit || ""),
        e.unit_price != null ? String(e.unit_price) : "",
        String(e.total_price || 0),
        esc(e.cost_center || ""),
        esc(e.notes || ""),
      ].join(sep));
    }
    lines.push([t("total"), "", "", "", "", "", "", String(expTotal.toFixed(2)), "", ""].join(sep));
    lines.push("");

    // Cost summary
    lines.push([t("csv_cost_summary")].join(sep));
    lines.push([t("csv_total_time"), `${(totalTimeMin / 60).toFixed(1)}h`].join(sep));
    lines.push([t("csv_total_personnel"), `${costData.totalPersonnel.toFixed(2)}€`].join(sep));
    lines.push([t("materials:total_consumables"), `${conTotal.toFixed(2)}€`].join(sep));
    lines.push([t("materials:total_knetung"), `${knTotal.toFixed(2)}€`].join(sep));
    lines.push(["Projektaufwendungen gesamt", `${expTotal.toFixed(2)}€`].join(sep));
    lines.push([t("materials:total_material_costs"), `${totalMaterialCosts.toFixed(2)}€`].join(sep));
    lines.push([t("total_costs"), `${totalCosts.toFixed(2)}€`].join(sep));

    const bom = "\uFEFF";
    const blob = new Blob([bom + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeName = (project.project_name || project.project_number).replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, "_").toLowerCase();
    a.href = url;
    a.download = `projektbericht_${safeName}_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [project, timeEntries, projectConsumables, projectKnetung, projectExpenses, costData, totalMaterialCosts, totalCosts, users, t]);

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
    return <Badge variant="outline" className={colors[status] || ""}>{t(`status_${status}`)}</Badge>;
  };

  const getMeasurementStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    };
    return <Badge variant="outline" className={colors[status] || ""}>{t(`measurement_status_${status}`)}</Badge>;
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading || !project) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">{t("loading")}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/projekte"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {project.project_number}{project.project_name ? ` – ${project.project_name}` : ""}
            </h1>
            {canEditIdentity && !isProjectCompleted && (
              <Button
                variant="ghost"
                size="icon"
                className="print:hidden"
                onClick={() => setEditIdentityOpen(true)}
                title={t("edit_identity_title", { defaultValue: "Projekt bearbeiten" })}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {isProjectCompleted && (
              <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                {t("project_status_completed")}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <p>{project.description || t("description")}</p>
            {myProjectRole && (
              <Badge variant="secondary" className="text-xs">{t("your_role")}: {t(`role_${myProjectRole}`)}</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          {canManagePlanning && !isProjectCompleted && (
            <Button variant="outline" onClick={() => { handleUpdateProject({ project_status: "completed" }); toast.success(t("project_completed")); }}>
              <CheckCircle2 className="h-4 w-4 mr-2" />{t("complete_project")}
            </Button>
          )}
          {canManagePlanning && isProjectCompleted && (
            <Button variant="outline" onClick={() => { handleUpdateProject({ project_status: "active" }); toast.success(t("project_reopened")); }}>
              <RotateCcw className="h-4 w-4 mr-2" />{t("reopen_project")}
            </Button>
          )}
          <Button variant="outline" onClick={handleCsvExport}>
            <Download className="h-4 w-4 mr-2" />{t("csv_export")}
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />{t("print_report")}
          </Button>
        </div>
      </div>

      {/* Planning dates */}
      {(canManagePlanning || (project as any).start_date || (project as any).end_date) && (() => {
        const ownerMember = (members as any[]).find((m: any) => m.role === "owner");
        const leaderMember = (members as any[]).find((m: any) => m.role === "leader");
        const ownerName = ownerMember ? getUserName(users as any[], ownerMember.user_id) : null;
        const leaderName = leaderMember ? getUserName(users as any[], leaderMember.user_id) : null;
        const unassigned = t("not_assigned", { defaultValue: "Nicht zugewiesen" });
        return (
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t("project_start_date")}:</span>
              {canManagePlanning && !isProjectCompleted ? (
                <Input
                  type="date"
                  className="w-40 h-8"
                  value={(project as any).start_date || ""}
                  onChange={(e) => handleUpdateProject({ start_date: e.target.value || null })}
                />
              ) : (
                <span className="text-sm">{(project as any).start_date ? new Date((project as any).start_date).toLocaleDateString("de-DE") : "–"}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t("project_end_date")}:</span>
              {canManagePlanning && !isProjectCompleted ? (
                <Input
                  type="date"
                  className="w-40 h-8"
                  value={(project as any).end_date || ""}
                  onChange={(e) => handleUpdateProject({ end_date: e.target.value || null })}
                />
              ) : (
                <span className="text-sm">{(project as any).end_date ? new Date((project as any).end_date).toLocaleDateString("de-DE") : "–"}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t("project_owner", { defaultValue: "Projekteigner" })}:</span>
              <span className={`text-sm ${ownerName ? "" : "text-muted-foreground italic"}`}>
                {ownerName || unassigned}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t("project_leader", { defaultValue: "Projektleiter" })}:</span>
              <span className={`text-sm ${leaderName ? "" : "text-muted-foreground italic"}`}>
                {leaderName || unassigned}
              </span>
            </div>
          </CardContent>
        </Card>
        );
      })()}


      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{(samples as any[]).length}</p>
              <p className="text-xs text-muted-foreground">{t("samples")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <FlaskConical className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{allMeasurements.length}</p>
              <p className="text-xs text-muted-foreground">{t("measurements")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{totalHours.toFixed(1)}{t("hours_unit")}</p>
              <p className="text-xs text-muted-foreground">{t("total_hours")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">
                {formatCurrency(canViewPersonnelCosts ? totalCosts : totalMaterialCosts)} {t("currency")}
              </p>
              <p className="text-xs text-muted-foreground">{t("total_costs")}</p>
              {canViewPersonnelCosts && totalMaterialCosts > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  {t("personnel_short")}: {formatCurrency(costData.totalPersonnel)} {t("currency")} + {t("materials:material_short")}: {formatCurrency(totalMaterialCosts)} {t("currency")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="time_entries" className="print:block">
        <TabsList className="print:hidden flex-wrap">
          <TabsTrigger value="time_entries">{t("tab_time_entries")}</TabsTrigger>
          <TabsTrigger value="services"><Briefcase className="h-3.5 w-3.5 mr-1" />Dienstleistungen</TabsTrigger>
          <TabsTrigger value="samples">{t("tab_samples")}</TabsTrigger>
          <TabsTrigger value="measurements">{t("tab_measurements")}</TabsTrigger>
          <TabsTrigger value="team"><Users className="h-3.5 w-3.5 mr-1" />{t("tab_team")}</TabsTrigger>
          <TabsTrigger value="planning">{t("tab_planning")}</TabsTrigger>
          <TabsTrigger value="weekly_reviews"><ClipboardList className="h-3.5 w-3.5 mr-1" />Weekly Reviews</TabsTrigger>
          {canViewPersonnelCosts && <TabsTrigger value="costs">{t("tab_costs")}</TabsTrigger>}
          <TabsTrigger value="material_costs">{t("materials:tab_material_costs")}</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="h-3.5 w-3.5 mr-1" />Dokumente</TabsTrigger>
          <TabsTrigger value="governance"><Shield className="h-3.5 w-3.5 mr-1" />Governance</TabsTrigger>
          <TabsTrigger value="closure"><ClipboardCheck className="h-3.5 w-3.5 mr-1" />Projektabschluss</TabsTrigger>
          <TabsTrigger value="report">{t("tab_report")}</TabsTrigger>
        </TabsList>

        <TabsContent value="governance">
          <ProjectGovernanceTab projectId={id!} canEdit={canManagePlanning} canApprove={canManagePlanning} />
        </TabsContent>

        <TabsContent value="services">
          <ProjectServicesTab projectId={id!} canEdit={isMaster || !!myProjectRole || canEditByPermission} />
        </TabsContent>

        <TabsContent value="closure">
          <ProjectClosureTab projectId={id!} canEdit={canManagePlanning} />
        </TabsContent>



        <TabsContent value="weekly_reviews">
          <WeeklyReviewsTab projectId={id!} />
        </TabsContent>


        {/* SAMPLES TAB */}
        <TabsContent value="samples">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("sample_id")}</TableHead>
                    <TableHead>{t("sample_name")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("location")}</TableHead>
                    <TableHead>{t("hazard")}</TableHead>
                    <TableHead>{t("eta")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(samples as any[]).length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("no_samples")}</TableCell></TableRow>
                  ) : (
                    (samples as any[]).map((s: any) => {
                      const eta = etaMap.get(s.id);
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">
                            <Link to={`/proben/${s.id}`} className="text-primary hover:underline">{s.sample_number}</Link>
                          </TableCell>
                          <TableCell>{s.sample_name}</TableCell>
                          <TableCell>{getStatusBadge(s.status)}</TableCell>
                          <TableCell>{formatLocation(s.storage_locations)}</TableCell>
                          <TableCell>
                            {s.is_hazardous && <AlertTriangle className="h-4 w-4 text-destructive" />}
                          </TableCell>
                          <TableCell>
                            {eta ? (
                              <Badge variant="outline" className="gap-1">
                                <CalendarClock className="h-3 w-3" />
                                {eta.toLocaleDateString("de-DE")}
                              </Badge>
                            ) : "–"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MEASUREMENTS TAB */}
        <TabsContent value="measurements">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("measurement_number")}</TableHead>
                    <TableHead>{t("order_number")}</TableHead>
                    <TableHead>{t("measurement_type")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("assigned_to")}</TableHead>
                    <TableHead>{t("planned_hours")}</TableHead>
                    <TableHead>{t("actual_hours")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allMeasurements.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("no_measurements")}</TableCell></TableRow>
                  ) : (
                    allMeasurements.map((m: any) => {
                      const workLogH = (m.work_logs || []).reduce((s: number, wl: any) => s + (wl.hours || 0), 0);
                      const actualH = m.status === "completed" && m.actual_duration_hours != null
                        ? Number(m.actual_duration_hours)
                        : workLogH;
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.measurement_number}</TableCell>
                          <TableCell>{m.orderNumber}</TableCell>
                          <TableCell>{m.measurement_services?.service_name || "–"}</TableCell>
                          <TableCell>{getMeasurementStatusBadge(m.status)}</TableCell>
                          <TableCell>{m.assigned_to ? getUserName(users, m.assigned_to) : "–"}</TableCell>
                          <TableCell>{m.planned_hours ?? m.processing_time_hours ?? 0}{t("hours_unit")}</TableCell>
                          <TableCell>{actualH.toFixed(1)}{t("hours_unit")}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEAM TAB */}
        <TabsContent value="team">
          <ProjectTeamTab projectId={id!} canManage={canManageTeam && !isProjectCompleted} />
        </TabsContent>

        {/* PLANNING TAB (Milestones + Work Packages + Gantt) */}
        <TabsContent value="planning">
          <ProjectPlanningTab
            projectId={id!}
            canManage={canManagePlanning && !isProjectCompleted}
            projectStart={project?.start_date}
            projectEnd={project?.end_date}
          />
        </TabsContent>

        {canViewPersonnelCosts && <TabsContent value="costs">
          <div className="space-y-4">
            <ProjectBudgetCard
              budgetTotal={(project as any).budget_total}
              budgetWarningThreshold={(project as any).budget_warning_threshold}
              currency={(project as any).budget_currency}
              actualCosts={totalCosts}
              projectStartDate={(project as any).start_date}
              canEdit={canManagePlanning}
              onSave={(updates) => handleUpdateProject(updates)}
            />
            <ProjectCostBreakdown
              breakdown={costBreakdown}
              expectedTotal={totalCosts}
              userName={(uid) => getUserName(users as any[], uid)}
            />

          </div>
        </TabsContent>}

        {/* MATERIAL COSTS TAB */}
        <TabsContent value="material_costs">
          <ProjectMaterialCosts
            projectId={id!}
            defaultLeaderId={(() => {
              const lm = (members as any[]).find((m: any) => m.role === "leader") || (members as any[]).find((m: any) => m.role === "owner");
              return lm?.user_id || null;
            })()}
            knetungMeasurements={allMeasurements
              .filter((m: any) => m.measurement_services?.service_name?.toLowerCase().includes("knetung"))
              .map((m: any) => ({ id: m.id, measurement_number: m.measurement_number }))}
          />

        </TabsContent>

        {/* TIME ENTRIES TAB */}
        <TabsContent value="time_entries">
          <ProjectTimeEntries projectId={id!} />
        </TabsContent>

        {/* DOCUMENTS TAB */}
        <TabsContent value="documents">
          <ProjectDocumentsTab
            projectId={id!}
            canEdit={isMaster || isLeaderOrOwner || canEditByPermission}
          />
        </TabsContent>

        {/* REPORT TAB */}
        <TabsContent value="report">
          <div ref={reportRef} className="space-y-6 print:space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t("report_title")}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{t("report_subtitle")}</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Project Info */}
                <div>
                  <h3 className="font-semibold mb-2">{t("report_project_info")}</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">{t("project_number")}:</span> {project.project_number}</div>
                    <div><span className="text-muted-foreground">{t("project_name")}:</span> {project.project_name || "–"}</div>
                    <div><span className="text-muted-foreground">{t("creator")}:</span> {getUserName(users, project.created_by)}</div>
                    <div><span className="text-muted-foreground">{t("created_at")}:</span> {new Date(project.created_at).toLocaleDateString("de-DE")}</div>
                    <div className="col-span-2"><span className="text-muted-foreground">{t("description")}:</span> {project.description || "–"}</div>
                  </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-4 gap-4 p-4 rounded-lg bg-muted/50">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{(samples as any[]).length}</p>
                    <p className="text-xs text-muted-foreground">{t("samples")}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{allMeasurements.length}</p>
                    <p className="text-xs text-muted-foreground">{t("measurements")}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{totalHours.toFixed(1)}{t("hours_unit")}</p>
                    <p className="text-xs text-muted-foreground">{t("total_hours")}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{formatCurrency(costData.totalPersonnel)} {t("currency")}</p>
                    <p className="text-xs text-muted-foreground">{t("total_costs")}</p>
                  </div>
                </div>

                {/* Samples Table */}
                <div>
                  <h3 className="font-semibold mb-2">{t("report_samples_section")}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("sample_id")}</TableHead>
                        <TableHead>{t("sample_name")}</TableHead>
                        <TableHead>{t("status")}</TableHead>
                        <TableHead>{t("location")}</TableHead>
                        <TableHead>{t("hazard")}</TableHead>
                        <TableHead>{t("eta")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(samples as any[]).map((s: any) => {
                        const eta = etaMap.get(s.id);
                        return (
                          <TableRow key={s.id}>
                            <TableCell>{s.sample_number}</TableCell>
                            <TableCell>{s.sample_name}</TableCell>
                            <TableCell>{t(`status_${s.status}`)}</TableCell>
                            <TableCell>{formatLocation(s.storage_locations)}</TableCell>
                            <TableCell>{s.is_hazardous ? t("yes") : t("no")}</TableCell>
                            <TableCell>{eta ? eta.toLocaleDateString("de-DE") : "–"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Measurements Table */}
                <div>
                  <h3 className="font-semibold mb-2">{t("report_measurements_section")}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("measurement_number")}</TableHead>
                        <TableHead>{t("order_number")}</TableHead>
                        <TableHead>{t("measurement_type")}</TableHead>
                        <TableHead>{t("status")}</TableHead>
                        <TableHead>{t("assigned_to")}</TableHead>
                        <TableHead>{t("actual_hours")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allMeasurements.map((m: any) => {
                        const workLogH = (m.work_logs || []).reduce((s: number, wl: any) => s + (wl.hours || 0), 0);
                        const actualH = m.status === "completed" && m.actual_duration_hours != null ? Number(m.actual_duration_hours) : workLogH;
                        return (
                          <TableRow key={m.id}>
                            <TableCell>{m.measurement_number}</TableCell>
                            <TableCell>{m.orderNumber}</TableCell>
                            <TableCell>{m.measurement_services?.service_name || "–"}</TableCell>
                            <TableCell>{t(`measurement_status_${m.status}`)}</TableCell>
                            <TableCell>{m.assigned_to ? getUserName(users, m.assigned_to) : "–"}</TableCell>
                            <TableCell>{actualH.toFixed(1)}{t("hours_unit")}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Time Entries */}
                <div>
                  <h3 className="font-semibold mb-2">{t("report_time_entries_section")}</h3>
                  {(timeEntries as any[]).length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("time_no_entries")}</p>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("time_date")}</TableHead>
                            <TableHead>{t("time_person")}</TableHead>
                            <TableHead>{t("time_duration")}</TableHead>
                            <TableHead>{t("time_note")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(timeEntries as any[]).map((e: any) => (
                            <TableRow key={e.id}>
                              <TableCell>{new Date(e.entry_date).toLocaleDateString("de-DE")}</TableCell>
                              <TableCell>{getUserNameLocal(e.person_id)}</TableCell>
                              <TableCell>{e.duration_minutes} min ({(e.duration_minutes / 60).toFixed(1)}{t("hours_unit")})</TableCell>
                              <TableCell className="max-w-xs truncate">{e.note || "–"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="mt-2 text-right font-semibold">
                        {t("time_total_hours")}: {timeEntryHours.toFixed(1)}{t("hours_unit")}
                      </div>
                    </>
                  )}
                </div>

                {/* Consumables */}
                <div>
                  <h3 className="font-semibold mb-2">{t("report_consumables_section")}</h3>
                  {(projectConsumables as any[]).length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("materials:no_consumable_bookings")}</p>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("materials:name")}</TableHead>
                            <TableHead>{t("materials:quantity")}</TableHead>
                            <TableHead>{t("materials:unit")}</TableHead>
                            <TableHead>{t("materials:price_per_unit")}</TableHead>
                            <TableHead>{t("materials:total")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(projectConsumables as any[]).map((c: any) => (
                            <TableRow key={c.id}>
                              <TableCell>{c.consumables?.name || "–"}</TableCell>
                              <TableCell>{c.quantity}</TableCell>
                              <TableCell>{c.consumables?.unit || "–"}</TableCell>
                              <TableCell>{formatCurrency(c.unit_price)} {t("currency")}</TableCell>
                              <TableCell>{formatCurrency(c.total_cost || 0)} {t("currency")}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="mt-2 text-right font-semibold">
                        {t("materials:total_consumables")}: {formatCurrency((projectConsumables as any[]).reduce((s, c) => s + Number(c.total_cost || 0), 0))} {t("currency")}
                      </div>
                    </>
                  )}
                </div>

                {/* Knetung Raw Materials */}
                <div>
                  <h3 className="font-semibold mb-2">{t("report_knetung_section")}</h3>
                  {(projectKnetung as any[]).length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("materials:no_knetung_bookings")}</p>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("materials:name")}</TableHead>
                            <TableHead>{t("materials:quantity_kg")}</TableHead>
                            <TableHead>{t("materials:price_per_kg")}</TableHead>
                            <TableHead>{t("materials:total")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(projectKnetung as any[]).map((k: any) => (
                            <TableRow key={k.id}>
                              <TableCell>{k.raw_materials?.material_name || "–"}</TableCell>
                              <TableCell>{k.quantity_kg}</TableCell>
                              <TableCell>{formatCurrency(k.price_per_kg)} {t("currency")}</TableCell>
                              <TableCell>{formatCurrency(k.total_cost || 0)} {t("currency")}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="mt-2 text-right font-semibold">
                        {t("materials:total_knetung")}: {formatCurrency((projectKnetung as any[]).reduce((s, k) => s + Number(k.total_cost || 0), 0))} {t("currency")}
                      </div>
                    </>
                  )}
                </div>

                {/* Project Expenses */}
                <div>
                  <h3 className="font-semibold mb-2">Projektaufwendungen</h3>
                  {(projectExpenses as any[]).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Keine Aufwendungen erfasst</p>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Datum</TableHead>
                            <TableHead>Kategorie</TableHead>
                            <TableHead>Bezeichnung</TableHead>
                            <TableHead>Lieferant</TableHead>
                            <TableHead className="text-right">Menge</TableHead>
                            <TableHead className="text-right">Einzelpreis</TableHead>
                            <TableHead className="text-right">Gesamtpreis</TableHead>
                            <TableHead>Kostenstelle</TableHead>
                            <TableHead>Bemerkungen</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(projectExpenses as any[]).map((e: any) => (
                            <TableRow key={e.id}>
                              <TableCell>{e.expense_date ? new Date(e.expense_date).toLocaleDateString("de-DE") : "–"}</TableCell>
                              <TableCell>{e.project_expense_categories?.name_de || "–"}</TableCell>
                              <TableCell className="font-medium">{e.name}</TableCell>
                              <TableCell>{e.supplier || "–"}</TableCell>
                              <TableCell className="text-right">{e.quantity != null ? `${e.quantity} ${e.unit || ""}` : "–"}</TableCell>
                              <TableCell className="text-right">{e.unit_price != null ? `${formatCurrency(e.unit_price)} ${t("currency")}` : "–"}</TableCell>
                              <TableCell className="text-right">{formatCurrency(e.total_price || 0)} {t("currency")}</TableCell>
                              <TableCell>{e.cost_center || "–"}</TableCell>
                              <TableCell className="max-w-xs truncate">{e.notes || "–"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="mt-2 text-right font-semibold">
                        Projektaufwendungen gesamt: {formatCurrency(totalExpensesCosts)} {t("currency")}
                      </div>
                    </>
                  )}
                </div>

                {/* Cost Summary */}
                <div>
                  <h3 className="font-semibold mb-2">{t("report_costs_section")}</h3>
                  <div className="rounded-lg border p-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span>{t("csv_total_time")}:</span><span className="font-medium">{totalHours.toFixed(1)}{t("hours_unit")}</span></div>
                    {canViewPersonnelCosts && <div className="flex justify-between"><span>{t("csv_total_personnel")}:</span><span className="font-medium">{formatCurrency(costData.totalPersonnel)} {t("currency")}</span></div>}
                    <div className="flex justify-between"><span>{t("materials:total_consumables")}:</span><span className="font-medium">{formatCurrency((projectConsumables as any[]).reduce((s, c) => s + Number(c.total_cost || 0), 0))} {t("currency")}</span></div>
                    <div className="flex justify-between"><span>{t("materials:total_knetung")}:</span><span className="font-medium">{formatCurrency((projectKnetung as any[]).reduce((s, k) => s + Number(k.total_cost || 0), 0))} {t("currency")}</span></div>
                    <div className="flex justify-between"><span>Projektaufwendungen:</span><span className="font-medium">{formatCurrency(totalExpensesCosts)} {t("currency")}</span></div>
                    <div className="flex justify-between border-t pt-2 font-bold"><span>{t("total_costs")}:</span><span>{formatCurrency(canViewPersonnelCosts ? totalCosts : totalMaterialCosts)} {t("currency")}</span></div>
                  </div>
                </div>

                {/* History */}
                <div>
                  <h3 className="font-semibold mb-2">{t("report_history_section")}</h3>
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("no_history")}</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("sample_id")}</TableHead>
                          <TableHead>{t("history_action")}</TableHead>
                          <TableHead>{t("history_user")}</TableHead>
                          <TableHead>{t("history_date")}</TableHead>
                          <TableHead>{t("history_comment")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.slice(0, 50).map((h: any) => {
                          const sample = (samples as any[]).find((s: any) => s.id === h.sample_id);
                          return (
                            <TableRow key={h.id}>
                              <TableCell>{sample?.sample_number || "–"}</TableCell>
                              <TableCell>{h.action}</TableCell>
                              <TableCell>{getUserName(users, h.user_id)}</TableCell>
                              <TableCell>{new Date(h.created_at).toLocaleDateString("de-DE")}</TableCell>
                              <TableCell className="max-w-xs truncate">{h.comment || "–"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div className="text-xs text-muted-foreground text-right pt-4 border-t">
                  {t("generated_at")}: {new Date().toLocaleString("de-DE")}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {id && (
        <EditProjectIdentityDialog
          open={editIdentityOpen}
          onOpenChange={setEditIdentityOpen}
          projectId={id}
          initialNumber={project.project_number}
          initialName={project.project_name ?? null}
        />
      )}
    </div>
  );
}
