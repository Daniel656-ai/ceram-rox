import { useProjectsWithStats } from "@/hooks/useProjectDetail";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Package, FlaskConical, Clock, DollarSign, CheckCircle2, ChevronDown, ChevronUp, User, UserCog, Flag } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { formatCurrency } from "@/lib/formatCurrency";
import { useTranslation } from "react-i18next";
import { useCreateProject, useDeleteProject } from "@/hooks/useProjects";
import { useAllWeeklyReviews } from "@/hooks/useWeeklyReviews";

export default function ProjectsPage() {
  const { t, i18n } = useTranslation("projects");
  const { data: projects = [], isLoading } = useProjectsWithStats();
  const { data: users = [] } = useUsers();
  const { data: memberIndex = [] } = useQuery({
    queryKey: ["project_members_index"],
    queryFn: () => api.projectMembers.listIndex(),
  });
  const { data: allReviews = [] } = useAllWeeklyReviews();

  // Map project_id -> latest review rating (1/2/3) based on review_date/created_at
  const latestReviewByProject = useMemo(() => {
    const map = new Map<string, { rating: number; date: string }>();
    for (const r of allReviews as any[]) {
      const cur = map.get(r.project_id);
      const key = `${r.review_date}T${r.created_at}`;
      const curKey = cur ? `${(cur as any).date}` : "";
      if (!cur || key > curKey) {
        map.set(r.project_id, { rating: r.overall_rating, date: key });
      }
    }
    return map;
  }, [allReviews]);

  const { user, role } = useAuth();
  const { hasPermission } = usePermissions();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();

  // Strikt nach Kompetenzmatrix: nur Rollen mit explizitem 'projects.create'-Recht
  // (oder Basisrolle 'master') dürfen Projekte anlegen.
  const canCreateProject = role === "master" || hasPermission("projects.create");

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ project_number: "", project_name: "", description: "" });
  const [showCompleted, setShowCompleted] = useState(false);

  const getUserName = (userId: string | null | undefined) => {
    if (!userId) return "";
    const u = (users as any[]).find((x: any) => x.user_id === userId);
    return u ? `${u.first_name} ${u.last_name}`.trim() : "";
  };

  // Map project_id -> { ownerName, leaderName }
  const projectLeads = useMemo(() => {
    const map = new Map<string, { ownerName: string; leaderName: string; ownerId?: string; leaderId?: string }>();
    for (const m of memberIndex as any[]) {
      const entry = map.get(m.project_id) || { ownerName: "", leaderName: "" };
      if (m.role === "owner" && !entry.ownerId) {
        entry.ownerId = m.user_id;
        entry.ownerName = getUserName(m.user_id);
      } else if (m.role === "leader" && !entry.leaderId) {
        entry.leaderId = m.user_id;
        entry.leaderName = getUserName(m.user_id);
      }
      map.set(m.project_id, entry);
    }
    return map;
  }, [memberIndex, users]);

  const activeProjects = useMemo(
    () => (projects as any[]).filter((p) => p.project_status !== "completed"),
    [projects],
  );
  const completedProjects = useMemo(
    () => (projects as any[]).filter((p) => p.project_status === "completed"),
    [projects],
  );

  const handleCreate = async () => {
    if (!form.project_number.trim()) {
      toast.error(t("number_required"));
      return;
    }
    try {
      await createProject.mutateAsync({
        project_number: form.project_number.trim(),
        project_name: form.project_name.trim() || undefined,
        description: form.description.trim() || undefined,
        created_by: user!.id,
      });
      toast.success(t("created"));
      setForm({ project_number: "", project_name: "", description: "" });
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || t("create_error"));
    }
  };

  const dateLocale = i18n.language === "en" ? "en-GB" : "de-DE";
  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString(dateLocale) : "–";

  const unassigned = t("not_assigned", { defaultValue: "Nicht zugewiesen" });

  const columns = useMemo<DataTableColumn<any>[]>(() => {
    const cols: DataTableColumn<any>[] = [
      {
        key: "review",
        type: "status",
        header: (
          <span className="inline-flex items-center gap-1" title="Letzte Weekly-Review-Bewertung">
            <Flag className="h-3.5 w-3.5" />Review
          </span>
        ),
        headClassName: "w-24",
        accessor: (p) => {
          const r = latestReviewByProject.get(p.id);
          return r ? String(r.rating) : "";
        },
        statusOrder: ["1", "2", "3"],
        statusLabels: { "1": "Schlecht", "2": "Mittel", "3": "Gut" },
        cell: (p) => {
          const r = latestReviewByProject.get(p.id);
          if (!r) return <span className="text-muted-foreground text-xs italic">–</span>;
          const meta = r.rating === 1
            ? { label: "Schlecht", emoji: "🔴" }
            : r.rating === 2
            ? { label: "Mittel", emoji: "🟡" }
            : { label: "Gut", emoji: "🟢" };
          return (
            <span
              title={`Letzte Weekly-Review-Bewertung: ${meta.label}`}
              className="inline-flex items-center justify-center text-lg leading-none"
              aria-label={`Weekly Review: ${meta.label}`}
            >
              {meta.emoji}
            </span>
          );
        },
      },
      {
        key: "project_number",
        header: t("project_number"),
        accessor: (p) => p.project_number,
        cell: (p) => (
          <Link to={`/projekte/${p.id}`} className="font-medium text-primary hover:underline">
            {p.project_number}
          </Link>
        ),
      },
      {
        key: "project_name",
        header: t("project_name"),
        accessor: (p) => p.project_name || "",
        cell: (p) => (
          <Link to={`/projekte/${p.id}`} className="hover:underline">{p.project_name || "–"}</Link>
        ),
      },
      {
        key: "owner",
        header: (
          <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />{t("project_owner", { defaultValue: "Projekteigner" })}</span>
        ),
        accessor: (p) => projectLeads.get(p.id)?.ownerName || "",
        cell: (p) => {
          const n = projectLeads.get(p.id)?.ownerName?.trim();
          return n ? <span>{n}</span> : <span className="text-muted-foreground italic">{unassigned}</span>;
        },
      },
      {
        key: "leader",
        header: (
          <span className="inline-flex items-center gap-1"><UserCog className="h-3.5 w-3.5" />{t("project_leader", { defaultValue: "Projektleiter" })}</span>
        ),
        accessor: (p) => projectLeads.get(p.id)?.leaderName || "",
        cell: (p) => {
          const n = projectLeads.get(p.id)?.leaderName?.trim();
          return n ? <span>{n}</span> : <span className="text-muted-foreground italic">{unassigned}</span>;
        },
      },
      {
        key: "samples",
        type: "number",
        header: (
          <span className="inline-flex items-center gap-1"><Package className="h-3.5 w-3.5" />{t("samples")}</span>
        ),
        className: "text-center",
        accessor: (p) => p.stats?.sampleCount ?? 0,
        cell: (p) => <Badge variant="secondary">{p.stats?.sampleCount ?? 0}</Badge>,
      },
      {
        key: "measurements",
        type: "number",
        header: (
          <span className="inline-flex items-center gap-1"><FlaskConical className="h-3.5 w-3.5" />{t("measurements")}</span>
        ),
        className: "text-center",
        accessor: (p) => p.stats?.measurementCount ?? 0,
        cell: (p) => <Badge variant="secondary">{p.stats?.measurementCount ?? 0}</Badge>,
      },
      {
        key: "hours",
        type: "number",
        header: (
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{t("hours")}</span>
        ),
        className: "text-center",
        accessor: (p) => p.stats?.totalHours ?? 0,
        cell: (p) => (p.stats?.totalHours > 0 ? `${p.stats.totalHours.toFixed(1)}h` : "–"),
      },
      {
        key: "costs",
        type: "number",
        header: (
          <span className="inline-flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{t("costs")}</span>
        ),
        className: "text-center",
        accessor: (p) => (p.stats?.totalCost ?? 0) + (p.stats?.materialCost ?? 0),
        cell: (p) => {
          const total = (p.stats?.totalCost ?? 0) + (p.stats?.materialCost ?? 0);
          return total > 0 ? `${formatCurrency(total)} €` : "–";
        },
      },
      {
        key: "start_date",
        type: "date",
        header: t("project_start_date", { defaultValue: "Startdatum" }),
        accessor: (p) => p.start_date ?? null,
        cell: (p) => formatDate(p.start_date),
      },
      {
        key: "end_date",
        type: "date",
        header: t("project_end_date", { defaultValue: "Enddatum" }),
        accessor: (p) => p.end_date ?? null,
        cell: (p) => formatDate(p.end_date),
      },
      {
        key: "updated_at",
        type: "date",
        header: t("last_updated", { defaultValue: "Letzte Aktualisierung" }),
        accessor: (p) => p.updated_at ?? null,
        cell: (p) => formatDate(p.updated_at),
      },
    ];

    if (role === "master") {
      cols.push({
        key: "actions",
        type: "custom",
        header: "",
        sortable: false,
        filterable: false,
        searchable: false,
        headClassName: "w-12",
        cell: (p) => (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("delete_title")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("delete_description_prefix")}„{p.project_number}"{t("delete_description_suffix")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel", { ns: "common" })}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    try {
                      await deleteProject.mutateAsync(p.id);
                      toast.success(t("deleted"));
                    } catch (e: any) {
                      toast.error(e.message || t("delete_error"));
                    }
                  }}
                >
                  {t("delete", { ns: "common" })}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ),
      });
    }
    return cols;
  }, [t, role, projectLeads, latestReviewByProject, unassigned, dateLocale, deleteProject]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canCreateProject && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />{t("new_project")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("create_title")}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>{t("project_number_required")}</Label>
                  <Input value={form.project_number} onChange={e => setForm(f => ({ ...f, project_number: e.target.value }))} placeholder={t("project_number_placeholder")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("project_name")}</Label>
                  <Input value={form.project_name} onChange={e => setForm(f => ({ ...f, project_name: e.target.value }))} placeholder="Optional" />
                </div>
                <div className="space-y-2">
                  <Label>{t("description")}</Label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" rows={3} />
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={createProject.isPending}>
                  {createProject.isPending ? "..." : t("new_project")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Active Projects */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            {t("active_projects")}
            <Badge variant="secondary">{activeProjects.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            tableId="projects-active"
            columns={columns}
            rows={activeProjects}
            rowKey={(p) => p.id}
            isLoading={isLoading}
            searchPlaceholder={t("search_placeholder")}
            emptyMessage={t("no_projects")}
            defaultSort={{ key: "updated_at", dir: "desc" }}
          />
        </CardContent>
      </Card>

      {/* Completed Projects */}
      {completedProjects.length > 0 && (
        <div className="space-y-2">
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setShowCompleted(v => !v)}
          >
            {showCompleted ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
            {showCompleted ? t("hide_completed") : t("show_completed")}
            <Badge variant="outline" className="ml-2">{completedProjects.length}</Badge>
          </Button>

          {showCompleted && (
            <Card className="border-muted bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5" />
                  {t("completed_projects")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  tableId="projects-completed"
                  columns={columns}
                  rows={completedProjects}
                  rowKey={(p) => p.id}
                  searchPlaceholder={t("search_placeholder")}
                  emptyMessage={t("no_projects")}
                  defaultSort={{ key: "updated_at", dir: "desc" }}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
