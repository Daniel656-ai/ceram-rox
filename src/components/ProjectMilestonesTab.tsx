import { useTranslation } from "react-i18next";
import { useProjectMilestones, useCreateMilestone, useUpdateMilestone, useDeleteMilestone } from "@/hooks/useProjectMilestones";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, Flag, Target, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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

interface Props {
  projectId: string;
  canManage: boolean;
}

export function ProjectMilestonesTab({ projectId, canManage }: Props) {
  const { t, i18n } = useTranslation("projects");
  const { user } = useAuth();
  const { data: milestones = [], isLoading } = useProjectMilestones(projectId);
  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", start_date: "", end_date: "", status: "planned" });

  const resetForm = () => {
    setForm({ title: "", description: "", start_date: "", end_date: "", status: "planned" });
    setEditId(null);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error(t("milestone_title_required"));
      return;
    }
    try {
      if (editId) {
        await updateMilestone.mutateAsync({
          id: editId,
          projectId,
          title: form.title,
          description: form.description || undefined,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          status: form.status,
        });
        toast.success(t("milestone_updated"));
      } else {
        await createMilestone.mutateAsync({
          project_id: projectId,
          title: form.title,
          description: form.description || undefined,
          start_date: form.start_date || undefined,
          end_date: form.end_date || undefined,
          status: form.status,
          created_by: user!.id,
        });
        toast.success(t("milestone_created"));
      }
      resetForm();
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleEdit = (m: any) => {
    setEditId(m.id);
    setForm({
      title: m.title,
      description: m.description || "",
      start_date: m.start_date || "",
      end_date: m.end_date || "",
      status: m.status,
    });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMilestone.mutateAsync({ id, projectId });
      toast.success(t("milestone_deleted"));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const locale = i18n.language === "en" ? "en-GB" : "de-DE";

  // Simple timeline visualization
  const timelineMilestones = (milestones as any[]).filter((m: any) => m.start_date || m.end_date);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("tab_milestones")}</CardTitle>
          {canManage && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />{t("milestone_add")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editId ? t("milestone_edit") : t("milestone_add")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>{t("milestone_title")} *</Label>
                    <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("milestone_description")}</Label>
                    <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("milestone_start_date")}</Label>
                      <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("milestone_end_date")}</Label>
                      <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("milestone_status")}</Label>
                    <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">{t("milestone_status_planned")}</SelectItem>
                        <SelectItem value="in_progress">{t("milestone_status_in_progress")}</SelectItem>
                        <SelectItem value="completed">{t("milestone_status_completed")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" onClick={handleSave} disabled={createMilestone.isPending || updateMilestone.isPending}>
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
                <TableHead>{t("milestone_start_date")}</TableHead>
                <TableHead>{t("milestone_end_date")}</TableHead>
                <TableHead>{t("milestone_status")}</TableHead>
                {canManage && <TableHead className="w-24"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">{t("loading")}</TableCell></TableRow>
              ) : (milestones as any[]).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("milestone_none")}</TableCell></TableRow>
              ) : (
                (milestones as any[]).map((m: any) => {
                  const Icon = STATUS_ICONS[m.status] || Flag;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.title}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">{m.description || "–"}</TableCell>
                      <TableCell>{m.start_date ? new Date(m.start_date).toLocaleDateString(locale) : "–"}</TableCell>
                      <TableCell>{m.end_date ? new Date(m.end_date).toLocaleDateString(locale) : "–"}</TableCell>
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
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(m)}>
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
                                  <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => handleDelete(m.id)}>
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

      {/* Simple Timeline */}
      {timelineMilestones.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("milestone_timeline")}</CardTitle></CardHeader>
          <CardContent>
            <div className="relative space-y-4">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
              {timelineMilestones.map((m: any) => {
                const Icon = STATUS_ICONS[m.status] || Flag;
                return (
                  <div key={m.id} className="relative pl-10">
                    <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-background ${
                      m.status === "completed" ? "bg-green-500" : m.status === "in_progress" ? "bg-yellow-500" : "bg-blue-500"
                    }`} />
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <p className="font-medium">{m.title}</p>
                        {m.description && <p className="text-sm text-muted-foreground">{m.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          {m.start_date && new Date(m.start_date).toLocaleDateString(locale)}
                          {m.start_date && m.end_date && " → "}
                          {m.end_date && new Date(m.end_date).toLocaleDateString(locale)}
                        </p>
                      </div>
                      <Badge variant="outline" className={STATUS_COLORS[m.status] || ""}>
                        <Icon className="h-3 w-3 mr-1" />{t(`milestone_status_${m.status}`)}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
