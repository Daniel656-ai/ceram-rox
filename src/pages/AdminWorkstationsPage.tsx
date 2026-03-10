import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { StatusBadge } from "@/components/StatusBadge";
import { WorkstationMeasurementsList } from "@/components/WorkstationMeasurementsList";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useWorkstations,
  useCreateWorkstation,
  useUpdateWorkstation,
  useDeleteWorkstation,
  useWorkstationTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  type Workstation,
  type WorkstationTask,
} from "@/hooks/useWorkstations";

function useAssignableUsers() {
  const { t } = useTranslation(["common"]);
  return useQuery({
    queryKey: ["assignable-users"],
    queryFn: async () => {
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles").select("user_id, role").in("role", ["durchfuehrer", "master"]);
      if (rolesErr) throw rolesErr;
      if (!roles?.length) return [];
      const userIds = [...new Set(roles.map((r) => r.user_id))];
      const { data: profiles, error: profErr } = await supabase
        .from("profiles").select("user_id, first_name, last_name").in("user_id", userIds);
      if (profErr) throw profErr;
      const roleMap = new Map<string, string>();
      roles.forEach((r) => roleMap.set(r.user_id, r.role));
      return (profiles ?? []).map((p) => ({
        user_id: p.user_id,
        name: `${p.first_name} ${p.last_name}`.trim() || "–",
        role: roleMap.get(p.user_id) ?? "",
        roleLabel: roleMap.get(p.user_id) === "master" ? "Administrator" : "Technician",
      }));
    },
  });
}

function WorkstationDialog({ open, onOpenChange, initial, users }: {
  open: boolean; onOpenChange: (o: boolean) => void; initial?: Workstation;
  users: ReturnType<typeof useAssignableUsers>["data"];
}) {
  const { t } = useTranslation(["admin", "common"]);
  const create = useCreateWorkstation();
  const update = useUpdateWorkstation();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(initial?.status ?? "active");
  const [responsibleUserId, setResponsibleUserId] = useState(initial?.responsible_user_id ?? "none");

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: t("admin:name_is_required"), variant: "destructive" }); return; }
    const payload = { name: name.trim(), description: description.trim() || undefined, status, responsible_user_id: responsibleUserId === "none" ? null : responsibleUserId };
    try {
      if (initial) { await update.mutateAsync({ id: initial.id, ...payload }); toast({ title: t("admin:workstation_updated") }); }
      else { await create.mutateAsync(payload); toast({ title: t("admin:workstation_created") }); }
      onOpenChange(false);
    } catch { toast({ title: t("admin:save_error"), variant: "destructive" }); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? t("admin:edit_workstation") : t("admin:new_workstation")}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label>{t("admin:workstation_name")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>{t("common:description")}</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div>
            <Label>{t("common:status")}</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "active" | "inactive")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("admin:active")}</SelectItem>
                <SelectItem value="inactive">{t("admin:inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("admin:workstation_responsible")}</Label>
            <Select value={responsibleUserId ?? "none"} onValueChange={setResponsibleUserId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("admin:workstation_none")}</SelectItem>
                {users?.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>{u.name} ({u.roleLabel})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common:cancel")}</Button>
          <Button onClick={handleSave} disabled={create.isPending || update.isPending}>{t("common:save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskDialog({ open, onOpenChange, workstationId, initial, users }: {
  open: boolean; onOpenChange: (o: boolean) => void; workstationId: string;
  initial?: WorkstationTask; users: ReturnType<typeof useAssignableUsers>["data"];
}) {
  const { t } = useTranslation(["admin", "common"]);
  const create = useCreateTask();
  const update = useUpdateTask();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [assignedTo, setAssignedTo] = useState(initial?.assigned_to ?? "none");
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [hourlyRate, setHourlyRate] = useState(String(initial?.hourly_rate ?? 0));
  const [status, setStatus] = useState<"open" | "in_progress" | "completed">(initial?.status ?? "open");

  const handleSave = async () => {
    if (!title.trim()) { toast({ title: t("admin:title_required"), variant: "destructive" }); return; }
    const payload = { workstation_id: workstationId, title: title.trim(), description: description.trim() || undefined, assigned_to: assignedTo === "none" ? null : assignedTo, due_date: dueDate || null, hourly_rate: parseFloat(hourlyRate) || 0, status };
    try {
      if (initial) { await update.mutateAsync({ id: initial.id, ...payload }); toast({ title: t("admin:task_updated") }); }
      else { await create.mutateAsync(payload); toast({ title: t("admin:task_created") }); }
      onOpenChange(false);
    } catch { toast({ title: t("admin:save_error"), variant: "destructive" }); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? t("admin:edit_task") : t("admin:new_task")}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label>{t("admin:task_title")}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>{t("common:description")}</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div>
            <Label>{t("admin:task_assigned")}</Label>
            <Select value={assignedTo ?? "none"} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("admin:task_nobody")}</SelectItem>
                {users?.map((u) => (<SelectItem key={u.user_id} value={u.user_id}>{u.name} ({u.roleLabel})</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>{t("admin:task_due_date")}</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div><Label>{t("admin:task_rate")}</Label><Input type="number" min="0" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} /></div>
          </div>
          <div>
            <Label>{t("common:status")}</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "open" | "in_progress" | "completed")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">{t("common:status_open")}</SelectItem>
                <SelectItem value="in_progress">{t("common:status_in_progress")}</SelectItem>
                <SelectItem value="completed">{t("common:status_completed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common:cancel")}</Button>
          <Button onClick={handleSave} disabled={create.isPending || update.isPending}>{t("common:save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkstationTasksList({ workstationId, users }: { workstationId: string; users: ReturnType<typeof useAssignableUsers>["data"] }) {
  const { t } = useTranslation(["admin", "common"]);
  const { data: tasks, isLoading } = useWorkstationTasks(workstationId);
  const deleteTask = useDeleteTask();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<WorkstationTask | undefined>();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const userMap = new Map(users?.map((u) => [u.user_id, u]) ?? []);
  const filtered = (tasks ?? []).filter((t) => statusFilter === "all" || t.status === statusFilter);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-xs">{t("admin:task_filter")}</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common:all")}</SelectItem>
              <SelectItem value="open">{t("common:status_open")}</SelectItem>
              <SelectItem value="in_progress">{t("common:status_in_progress")}</SelectItem>
              <SelectItem value="completed">{t("common:status_completed")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => { setEditingTask(undefined); setTaskDialogOpen(true); }}>
          <Plus className="h-3 w-3 mr-1" /> {t("admin:new_task")}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common:loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("admin:no_tasks")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin:task_table_title")}</TableHead>
              <TableHead>{t("admin:task_table_assigned")}</TableHead>
              <TableHead>{t("admin:task_table_due")}</TableHead>
              <TableHead>€/h</TableHead>
              <TableHead>{t("common:status")}</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((tk) => {
              const assignee = tk.assigned_to ? userMap.get(tk.assigned_to) : null;
              return (
                <TableRow key={tk.id}>
                  <TableCell className="font-medium">{tk.title}</TableCell>
                  <TableCell>
                    {assignee ? (
                      <span>{assignee.name} <Badge variant="outline" className="ml-1 text-[10px]">{assignee.roleLabel}</Badge></span>
                    ) : (<span className="text-muted-foreground">–</span>)}
                  </TableCell>
                  <TableCell>{tk.due_date ?? "–"}</TableCell>
                  <TableCell>{tk.hourly_rate}</TableCell>
                  <TableCell><StatusBadge status={tk.status} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingTask(tk); setTaskDialogOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => { await deleteTask.mutateAsync({ id: tk.id, workstation_id: workstationId }); toast({ title: t("admin:task_deleted") }); }}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {taskDialogOpen && (
        <TaskDialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen} workstationId={workstationId} initial={editingTask} users={users} />
      )}
    </div>
  );
}

export default function AdminWorkstationsPage() {
  const { t } = useTranslation(["admin", "common"]);
  const { data: workstations, isLoading } = useWorkstations();
  const { data: users } = useAssignableUsers();
  const deleteWs = useDeleteWorkstation();
  const [wsDialogOpen, setWsDialogOpen] = useState(false);
  const [editingWs, setEditingWs] = useState<Workstation | undefined>();

  const userMap = new Map(users?.map((u) => [u.user_id, u]) ?? []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("admin:workstations_title")}</h1>
          <p className="text-muted-foreground">{t("admin:workstations_subtitle")}</p>
        </div>
        <Button onClick={() => { setEditingWs(undefined); setWsDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> {t("admin:new_workstation")}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{t("common:loading")}</p>
      ) : !workstations?.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">{t("admin:no_workstations")}</p>
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {workstations.map((ws) => {
            const responsible = ws.responsible_user_id ? userMap.get(ws.responsible_user_id) : null;
            return (
              <AccordionItem key={ws.id} value={ws.id} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 text-left flex-1">
                    <span className="font-semibold">{ws.name}</span>
                    <Badge variant={ws.status === "active" ? "default" : "secondary"}>
                      {ws.status === "active" ? t("admin:active") : t("admin:inactive")}
                    </Badge>
                    {responsible && (
                      <span className="text-sm text-muted-foreground">{responsible.name} ({responsible.roleLabel})</span>
                    )}
                    <div className="ml-auto flex gap-1 mr-2" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingWs(ws); setWsDialogOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => { await deleteWs.mutateAsync(ws.id); toast({ title: t("admin:workstation_deleted") }); }}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {ws.description && <p className="text-sm text-muted-foreground mb-4">{ws.description}</p>}
                  <WorkstationMeasurementsList workstationId={ws.id} userMap={userMap} />
                  <WorkstationTasksList workstationId={ws.id} users={users} />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {wsDialogOpen && <WorkstationDialog open={wsDialogOpen} onOpenChange={setWsDialogOpen} initial={editingWs} users={users} />}
    </div>
  );
}
