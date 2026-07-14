import { useTranslation } from "react-i18next";
import { useState, Fragment, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import {
  useProjectMilestones,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
} from "@/hooks/useProjectMilestones";
import {
  useWorkPackages,
  useCreateWorkPackage,
  useUpdateWorkPackage,
  useDeleteWorkPackage,
} from "@/hooks/useWorkPackages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, Flag, Target, CheckCircle2, Package2, X, ChevronDown, ChevronRight, Link2 } from "lucide-react";
import { toast } from "sonner";
import { ProjectGanttChart } from "@/components/ProjectGanttChart";
import { WorkPackageDetails } from "@/components/WorkPackageDetails";
import { useWorkPackageDependencies } from "@/hooks/useWorkPackageDependencies";
import { PersonSelect } from "@/components/PersonSelect";

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

const STATUS_ICONS: Record<string, any> = {
  planned: Flag,
  in_progress: Target,
  completed: CheckCircle2,
};

const NONE = "__none__";

interface Props {
  projectId: string;
  canManage: boolean;
  projectStart?: string | null;
  projectEnd?: string | null;
}

export function ProjectPlanningTab({ projectId, canManage, projectStart, projectEnd }: Props) {
  const { t, i18n } = useTranslation("projects");
  const { user } = useAuth();
  const locale = i18n.language === "en" ? "en-GB" : "de-DE";

  const { data: allMilestones = [], isLoading: msLoading } = useProjectMilestones(projectId);
  const { data: workPackages = [], isLoading: wpLoading } = useWorkPackages(projectId);
  const { data: dependencies = [] } = useWorkPackageDependencies(projectId);
  const { data: users = [] } = useUsers();
  const { data: categories = [] } = useQuery({
    queryKey: ["work-package-categories"],
    queryFn: () => api.workPackageCategories.list(),
  });
  const defaultCategoryId = useMemo(
    () => (categories.find((c: any) => c.name === "Grundlagen & Charakterisierung")?.id || categories[0]?.id || ""),
    [categories],
  );
  const categoryName = (id?: string | null) => (categories as any[]).find((c) => c.id === id)?.name || "–";

  // Only project-level milestones (not attached to a work package) shown in the standalone card
  const milestones = (allMilestones as any[]).filter((m) => !m.work_package_id);

  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();

  const createWp = useCreateWorkPackage();
  const updateWp = useUpdateWorkPackage();
  const deleteWp = useDeleteWorkPackage();

  // Milestone dialog
  const [msOpen, setMsOpen] = useState(false);
  const [msEditId, setMsEditId] = useState<string | null>(null);
  const [msForm, setMsForm] = useState({ title: "", description: "", milestone_date: "", status: "planned" });

  const resetMsForm = () => {
    setMsForm({ title: "", description: "", milestone_date: "", status: "planned" });
    setMsEditId(null);
  };

  const handleSaveMs = async () => {
    if (!msForm.title.trim()) {
      toast.error(t("milestone_title_required"));
      return;
    }
    try {
      if (msEditId) {
        await updateMilestone.mutateAsync({
          id: msEditId,
          projectId,
          title: msForm.title,
          description: msForm.description || undefined,
          milestone_date: msForm.milestone_date || null,
          status: msForm.status,
        });
        toast.success(t("milestone_updated"));
      } else {
        await createMilestone.mutateAsync({
          project_id: projectId,
          title: msForm.title,
          description: msForm.description || undefined,
          milestone_date: msForm.milestone_date || undefined,
          status: msForm.status,
          created_by: user!.id,
        });
        toast.success(t("milestone_created"));
      }
      resetMsForm();
      setMsOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleEditMs = (m: any) => {
    setMsEditId(m.id);
    setMsForm({
      title: m.title,
      description: m.description || "",
      milestone_date: m.milestone_date || "",
      status: m.status,
    });
    setMsOpen(true);
  };

  const handleDeleteMs = async (id: string) => {
    try {
      await deleteMilestone.mutateAsync({ id, projectId });
      toast.success(t("milestone_deleted"));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Work package dialog
  const [wpOpen, setWpOpen] = useState(false);
  const [wpEditId, setWpEditId] = useState<string | null>(null);
  const [wpForm, setWpForm] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    milestone_id: "",
    status: "planned",
    category_id: "",
    assignee_ids: [] as string[],
  });

  const resetWpForm = () => {
    setWpForm({ title: "", description: "", start_date: "", end_date: "", milestone_id: "", status: "planned", category_id: defaultCategoryId, assignee_ids: [] });
    setWpEditId(null);
  };

  const handleSaveWp = async () => {
    if (!wpForm.title.trim()) {
      toast.error(t("wp_title_required"));
      return;
    }
    const categoryId = wpForm.category_id || defaultCategoryId;
    if (!categoryId) {
      toast.error(t("wp_category_required", { defaultValue: "Kategorie ist erforderlich" }));
      return;
    }
    if (wpForm.start_date && wpForm.end_date && wpForm.end_date < wpForm.start_date) {
      toast.error(t("wp_end_before_start"));
      return;
    }
    try {
      if (wpEditId) {
        await updateWp.mutateAsync({
          id: wpEditId,
          projectId,
          title: wpForm.title,
          description: wpForm.description || null,
          start_date: wpForm.start_date || null,
          end_date: wpForm.end_date || null,
          milestone_id: wpForm.milestone_id || null,
          status: wpForm.status,
          category_id: categoryId,
          assignee_ids: wpForm.assignee_ids,
        });
        toast.success(t("wp_updated"));
      } else {
        await createWp.mutateAsync({
          project_id: projectId,
          title: wpForm.title,
          category_id: categoryId,
          description: wpForm.description || undefined,
          start_date: wpForm.start_date || null,
          end_date: wpForm.end_date || null,
          milestone_id: wpForm.milestone_id || null,
          status: wpForm.status,
          assignee_ids: wpForm.assignee_ids,
          created_by: user!.id,
        });
        toast.success(t("wp_created"));
      }
      resetWpForm();
      setWpOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleEditWp = (wp: any) => {
    setWpEditId(wp.id);
    setWpForm({
      title: wp.title,
      description: wp.description || "",
      start_date: wp.start_date || "",
      end_date: wp.end_date || "",
      milestone_id: wp.milestone_id || "",
      status: wp.status,
      category_id: wp.category_id || defaultCategoryId,
      assignee_ids: wp.assignees || [],
    });
    setWpOpen(true);
  };

  const handleDeleteWp = async (id: string) => {
    try {
      await deleteWp.mutateAsync({ id, projectId });
      toast.success(t("wp_deleted"));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleAssignee = (uid: string) => {
    setWpForm((f) => ({
      ...f,
      assignee_ids: f.assignee_ids.includes(uid)
        ? f.assignee_ids.filter((x) => x !== uid)
        : [...f.assignee_ids, uid],
    }));
  };

  const getUserName = (uid: string) => {
    const u = users.find((x: any) => x.user_id === uid);
    return u ? `${u.first_name} ${u.last_name}`.trim() : "–";
  };

  const getMilestoneTitle = (id?: string | null) => {
    if (!id) return null;
    const m = (milestones as any[]).find((x: any) => x.id === id);
    return m?.title || null;
  };

  const activeUsers = (users as any[]).filter((u: any) => u.is_active);

  const [expandedWp, setExpandedWp] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Gantt chart */}
      <ProjectGanttChart
        workPackages={workPackages}
        milestones={allMilestones as any}
        dependencies={dependencies as any}
        projectStart={projectStart}
        projectEnd={projectEnd}
        users={users}
      />

      {/* Work packages */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package2 className="h-5 w-5" />
            {t("tab_work_packages")}
          </CardTitle>
          {canManage && (
            <Dialog open={wpOpen} onOpenChange={(v) => { setWpOpen(v); if (!v) resetWpForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />{t("wp_add")}</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{wpEditId ? t("wp_edit") : t("wp_add")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>{t("wp_title")} *</Label>
                    <Input value={wpForm.title} onChange={(e) => setWpForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("wp_description")}</Label>
                    <Textarea value={wpForm.description} onChange={(e) => setWpForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("wp_start_date")}</Label>
                      <Input type="date" value={wpForm.start_date} onChange={(e) => setWpForm((f) => ({ ...f, start_date: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("wp_end_date")}</Label>
                      <Input type="date" value={wpForm.end_date} onChange={(e) => setWpForm((f) => ({ ...f, end_date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("wp_status")}</Label>
                    <Select value={wpForm.status} onValueChange={(v) => setWpForm((f) => ({ ...f, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">{t("milestone_status_planned")}</SelectItem>
                        <SelectItem value="in_progress">{t("milestone_status_in_progress")}</SelectItem>
                        <SelectItem value="completed">{t("milestone_status_completed")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Milestones und Abhängigkeiten werden pro Arbeitspaket in der Detailansicht verwaltet */}
                  <div className="space-y-2">
                    <Label>{t("wp_assignees")}</Label>
                    <div className="flex flex-wrap gap-2 min-h-9 p-2 border rounded-md">
                      {wpForm.assignee_ids.length === 0 && (
                        <span className="text-xs text-muted-foreground">{t("wp_no_assignees")}</span>
                      )}
                      {wpForm.assignee_ids.map((uid) => (
                        <Badge key={uid} variant="secondary" className="gap-1">
                          {getUserName(uid)}
                          <button type="button" onClick={() => toggleAssignee(uid)} className="hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <PersonSelect
                      value=""
                      onValueChange={(v) => v && toggleAssignee(v)}
                      users={activeUsers as any[]}
                      excludeIds={wpForm.assignee_ids}
                      placeholder={t("wp_add_assignee")}
                    />
                  </div>

                  <Button className="w-full" onClick={handleSaveWp} disabled={createWp.isPending || updateWp.isPending}>
                    {t("time_save")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>{t("wp_title")}</TableHead>
                <TableHead>{t("wp_start_date")}</TableHead>
                <TableHead>{t("wp_end_date")}</TableHead>
                <TableHead>{t("wp_assignees")}</TableHead>
                <TableHead>{t("wp_details")}</TableHead>
                <TableHead>{t("milestone_status")}</TableHead>
                {canManage && <TableHead className="w-24"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {wpLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">{t("loading")}</TableCell></TableRow>
              ) : workPackages.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("wp_none")}</TableCell></TableRow>
              ) : (
                workPackages.map((wp: any) => {
                  const Icon = STATUS_ICONS[wp.status] || Flag;
                  const wpMs = (allMilestones as any[]).filter((m) => m.work_package_id === wp.id);
                  const wpDeps = (dependencies as any[]).filter((d) => d.successor_id === wp.id);
                  const isOpen = expandedWp === wp.id;
                  return (
                    <Fragment key={wp.id}>
                    <TableRow>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => setExpandedWp(isOpen ? null : wp.id)}>
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>{wp.title}</div>
                        {wp.description && <div className="text-xs text-muted-foreground truncate max-w-xs">{wp.description}</div>}
                      </TableCell>
                      <TableCell>{wp.start_date ? new Date(wp.start_date).toLocaleDateString(locale) : "–"}</TableCell>
                      <TableCell>{wp.end_date ? new Date(wp.end_date).toLocaleDateString(locale) : "–"}</TableCell>
                      <TableCell>
                        {wp.assignees.length === 0 ? (
                          <span className="text-muted-foreground text-xs">–</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {wp.assignees.map((uid: string) => (
                              <Badge key={uid} variant="outline" className="text-xs">{getUserName(uid)}</Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant="outline" className="text-xs gap-1"><Flag className="h-3 w-3" />{wpMs.length}</Badge>
                          <Badge variant="outline" className="text-xs gap-1"><Link2 className="h-3 w-3" />{wpDeps.length}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[wp.status] || ""}>
                          <Icon className="h-3 w-3 mr-1" />{t(`milestone_status_${wp.status}`)}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditWp(wp)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t("wp_delete_title")}</AlertDialogTitle>
                                  <AlertDialogDescription>{t("wp_delete_desc")}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t("cancel", { ns: "common" })}</AlertDialogCancel>
                                  <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => handleDeleteWp(wp.id)}>
                                    {t("delete", { ns: "common" })}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={canManage ? 8 : 7} className="p-0">
                          <WorkPackageDetails
                            wp={wp}
                            projectId={projectId}
                            allWps={workPackages as any}
                            wpMilestones={wpMs as any}
                            allProjectMilestones={allMilestones as any}
                            dependencies={dependencies as any}
                            canManage={canManage}
                            locale={locale}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            {t("tab_milestones")}
          </CardTitle>
          {canManage && (
            <Dialog open={msOpen} onOpenChange={(v) => { setMsOpen(v); if (!v) resetMsForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-2" />{t("milestone_add")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{msEditId ? t("milestone_edit") : t("milestone_add")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>{t("milestone_title")} *</Label>
                    <Input value={msForm.title} onChange={(e) => setMsForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("milestone_description")}</Label>
                    <Textarea value={msForm.description} onChange={(e) => setMsForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("milestone_date")} *</Label>
                    <Input type="date" value={msForm.milestone_date} onChange={(e) => setMsForm((f) => ({ ...f, milestone_date: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("milestone_status")}</Label>
                    <Select value={msForm.status} onValueChange={(v) => setMsForm((f) => ({ ...f, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">{t("milestone_status_planned")}</SelectItem>
                        <SelectItem value="in_progress">{t("milestone_status_in_progress")}</SelectItem>
                        <SelectItem value="completed">{t("milestone_status_completed")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" onClick={handleSaveMs} disabled={createMilestone.isPending || updateMilestone.isPending}>
                    {t("time_save")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("milestone_title")}</TableHead>
                <TableHead>{t("milestone_description")}</TableHead>
                <TableHead>{t("milestone_date")}</TableHead>
                <TableHead>{t("milestone_status")}</TableHead>
                {canManage && <TableHead className="w-24"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {msLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">{t("loading")}</TableCell></TableRow>
              ) : (milestones as any[]).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t("milestone_none")}</TableCell></TableRow>
              ) : (
                (milestones as any[]).map((m: any) => {
                  const Icon = STATUS_ICONS[m.status] || Flag;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.title}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">{m.description || "–"}</TableCell>
                      <TableCell>{m.milestone_date ? new Date(m.milestone_date).toLocaleDateString(locale) : "–"}</TableCell>
                      <TableCell>
                        {canManage ? (
                          <Select value={m.status} onValueChange={(v) => updateMilestone.mutate({ id: m.id, projectId, status: v })}>
                            <SelectTrigger className="w-40">
                              <div className="flex items-center gap-1">
                                <Icon className="h-3.5 w-3.5" />
                                <SelectValue />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="planned">{t("milestone_status_planned")}</SelectItem>
                              <SelectItem value="in_progress">{t("milestone_status_in_progress")}</SelectItem>
                              <SelectItem value="completed">{t("milestone_status_completed")}</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className={STATUS_COLORS[m.status] || ""}>
                            <Icon className="h-3 w-3 mr-1" />{t(`milestone_status_${m.status}`)}
                          </Badge>
                        )}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditMs(m)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t("milestone_delete_title")}</AlertDialogTitle>
                                  <AlertDialogDescription>{t("milestone_delete_desc")}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t("cancel", { ns: "common" })}</AlertDialogCancel>
                                  <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => handleDeleteMs(m.id)}>
                                    {t("delete", { ns: "common" })}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
