import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown, Power, ChevronRight, ChevronDown as CDown,
  ListChecks, Link2,
} from "lucide-react";
import type { PortfolioTaskStatus, PortfolioWorkPackageStatus } from "@/lib/api/portfolioStructure";
import PortfolioProjectWpMappingDialog from "./PortfolioProjectWpMappingDialog";

const TASK_STATUS_LABEL: Record<PortfolioTaskStatus, string> = {
  offen: "Offen",
  in_arbeit: "In Arbeit",
  erledigt: "Erledigt",
};

const WP_STATUS_LABEL: Record<PortfolioWorkPackageStatus, string> = {
  geplant: "Geplant",
  in_arbeit: "In Arbeit",
  abgeschlossen: "Abgeschlossen",
  on_hold: "On Hold",
  abgebrochen: "Abgebrochen",
};

interface Props {
  portfolioId: string;
  canManage: boolean;
}

export default function PortfolioStructureTab({ portfolioId, canManage }: Props) {
  const qc = useQueryClient();

  const { data: wps = [], isLoading: wpLoading } = useQuery({
    queryKey: ["portfolio-wps", portfolioId],
    queryFn: () => api.portfolioWorkPackages.listByPortfolio(portfolioId),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["portfolio-tasks", portfolioId],
    queryFn: () => api.portfolioTasks.listByPortfolio(portfolioId),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["wp-categories"],
    queryFn: () => api.workPackageCategories.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-lookup"],
    queryFn: () => api.users.listWithRoles(),
  });

  const userNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of users as any[]) {
      map[u.user_id] = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.user_id;
    }
    return map;
  }, [users]);

  const tasksByWp = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const t of tasks) {
      const key = (t as any).portfolio_work_package_id;
      (map[key] ||= []).push(t);
    }
    return map;
  }, [tasks]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["portfolio-wps", portfolioId] });
    qc.invalidateQueries({ queryKey: ["portfolio-tasks", portfolioId] });
  };

  // ----- WP dialog -----
  const [wpDialog, setWpDialog] = useState<{ open: boolean; id?: string; draft: any }>({
    open: false,
    draft: {},
  });
  const openNewWp = () => setWpDialog({
    open: true,
    draft: {
      name: "",
      code: `AP${wps.length + 1}`,
      description: "",
      category_id: categories[0]?.id ?? null,
      is_active: true,
      status: "geplant",
      start_date: null,
      end_date: null,
      budget: null,
      responsible_user_id: null,
    },
  });
  const openEditWp = (wp: any) => setWpDialog({
    open: true,
    id: wp.id,
    draft: {
      name: wp.name,
      code: wp.code ?? "",
      description: wp.description ?? "",
      category_id: wp.category_id ?? null,
      is_active: wp.is_active,
      status: wp.status ?? "geplant",
      start_date: wp.start_date ?? null,
      end_date: wp.end_date ?? null,
      budget: wp.budget ?? null,
      responsible_user_id: wp.responsible_user_id ?? null,
    },
  });

  const saveWp = useMutation({
    mutationFn: async () => {
      const d = wpDialog.draft;
      const payload = {
        name: d.name.trim(),
        code: d.code?.trim() || null,
        description: d.description?.trim() || null,
        category_id: d.category_id || null,
        is_active: d.is_active,
        status: d.status || "geplant",
        start_date: d.start_date || null,
        end_date: d.end_date || null,
        budget: d.budget === "" || d.budget === null ? null : Number(d.budget),
        responsible_user_id: d.responsible_user_id || null,
      };
      if (wpDialog.id) return api.portfolioWorkPackages.update(wpDialog.id, payload);
      return api.portfolioWorkPackages.create({
        portfolio_id: portfolioId,
        ...payload,
        sort_order: wps.length,
      });
    },
    onSuccess: () => {
      toast.success("Gespeichert");
      setWpDialog({ open: false, draft: {} });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Fehler"),
  });

  const removeWp = useMutation({
    mutationFn: (id: string) => api.portfolioWorkPackages.remove(id),
    onSuccess: () => { toast.success("Arbeitspaket gelöscht"); invalidate(); },
    onError: (e: any) => toast.error(e?.message || "Löschen fehlgeschlagen (evtl. Tasks vorhanden)"),
  });

  const reorderWp = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: -1 | 1 }) => {
      const idx = wps.findIndex((w) => w.id === id);
      const swap = wps[idx + direction];
      if (!swap) return;
      await Promise.all([
        api.portfolioWorkPackages.update(id, { sort_order: swap.sort_order }),
        api.portfolioWorkPackages.update(swap.id, { sort_order: wps[idx].sort_order }),
      ]);
    },
    onSuccess: invalidate,
  });

  const toggleActive = useMutation({
    mutationFn: (wp: any) => api.portfolioWorkPackages.update(wp.id, { is_active: !wp.is_active }),
    onSuccess: invalidate,
  });

  // ----- Task dialog -----
  const [taskDialog, setTaskDialog] = useState<{ open: boolean; wpId?: string; id?: string; draft: any }>({
    open: false,
    draft: {},
  });
  const openNewTask = (wpId: string) => {
    const siblings = tasksByWp[wpId] || [];
    const wp = wps.find((w) => w.id === wpId);
    const parentCode = wp?.code?.replace(/[^\d]/g, "") || String(wps.indexOf(wp!) + 1);
    setTaskDialog({
      open: true,
      wpId,
      draft: {
        name: "",
        code: `${parentCode}.${siblings.length + 1}`,
        description: "",
        status: "offen",
        start_date: null,
        end_date: null,
        planned_effort_hours: null,
      },
    });
  };
  const openEditTask = (task: any) => setTaskDialog({
    open: true,
    wpId: task.portfolio_work_package_id,
    id: task.id,
    draft: {
      name: task.name,
      code: task.code ?? "",
      description: task.description ?? "",
      status: task.status,
      start_date: task.start_date ?? null,
      end_date: task.end_date ?? null,
      planned_effort_hours: task.planned_effort_hours ?? null,
    },
  });

  const saveTask = useMutation({
    mutationFn: async () => {
      const d = taskDialog.draft;
      const payload = {
        name: d.name.trim(),
        code: d.code?.trim() || null,
        description: d.description?.trim() || null,
        status: d.status,
        start_date: d.start_date || null,
        end_date: d.end_date || null,
        planned_effort_hours:
          d.planned_effort_hours === "" || d.planned_effort_hours === null
            ? null
            : Number(d.planned_effort_hours),
      };
      if (taskDialog.id) return api.portfolioTasks.update(taskDialog.id, payload);
      return api.portfolioTasks.create({
        portfolio_work_package_id: taskDialog.wpId!,
        ...payload,
        sort_order: (tasksByWp[taskDialog.wpId!] || []).length,
      });
    },
    onSuccess: () => {
      toast.success("Gespeichert");
      setTaskDialog({ open: false, draft: {} });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Fehler"),
  });

  const removeTask = useMutation({
    mutationFn: (id: string) => api.portfolioTasks.remove(id),
    onSuccess: () => { toast.success("Task gelöscht"); invalidate(); },
    onError: (e: any) => toast.error(e?.message || "Fehler"),
  });

  const reorderTask = useMutation({
    mutationFn: async ({ id, wpId, direction }: { id: string; wpId: string; direction: -1 | 1 }) => {
      const list = tasksByWp[wpId] || [];
      const idx = list.findIndex((t: any) => t.id === id);
      const swap = list[idx + direction] as any;
      if (!swap) return;
      await Promise.all([
        api.portfolioTasks.update(id, { sort_order: swap.sort_order }),
        api.portfolioTasks.update(swap.id, { sort_order: (list[idx] as any).sort_order }),
      ]);
    },
    onSuccess: invalidate,
  });

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setExpanded((s) => ({ ...s, [id]: !s[id] }));

  // ----- Mapping dialog -----
  const [mapDialog, setMapDialog] = useState<{
    open: boolean;
    target: { kind: "wp"; portfolioWpId: string; title: string } | { kind: "task"; portfolioTaskId: string; title: string } | null;
  }>({ open: false, target: null });

  const fmtRange = (s?: string | null, e?: string | null) => {
    if (!s && !e) return "—";
    const f = (d?: string | null) => (d ? new Date(d).toLocaleDateString("de-AT") : "—");
    return `${f(s)} – ${f(e)}`;
  };
  const fmtEuro = (v?: number | null) =>
    v == null ? "—" : new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="h-4 w-4" /> Portfolio-Arbeitspakete &amp; Tasks
          </CardTitle>
          {canManage && (
            <Button size="sm" onClick={openNewWp}>
              <Plus className="h-4 w-4 mr-2" /> Neues Arbeitspaket
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {wpLoading ? (
            <p className="text-sm text-muted-foreground">Lade …</p>
          ) : wps.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Noch keine Portfolio-Arbeitspakete angelegt.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="w-20">Nr.</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>Zeitraum</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verantwortlich</TableHead>
                  <TableHead className="w-64 text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wps.map((wp: any, idx) => {
                  const wpTasks = tasksByWp[wp.id] || [];
                  const isOpen = expanded[wp.id];
                  return (
                    <>
                      <TableRow key={wp.id} className={!wp.is_active ? "opacity-60" : ""}>
                        <TableCell>
                          <button onClick={() => toggle(wp.id)} className="hover:text-primary">
                            {isOpen ? <CDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{wp.code ?? `AP${idx + 1}`}</TableCell>
                        <TableCell>
                          <div className="font-medium">{wp.name}</div>
                          {wp.category && (
                            <Badge variant="outline" className="text-[10px] mt-1">{wp.category.name}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtRange(wp.start_date, wp.end_date)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtEuro(wp.budget)}</TableCell>
                        <TableCell>
                          <Badge variant={wp.is_active ? "default" : "secondary"} className="text-[10px]">
                            {WP_STATUS_LABEL[(wp.status ?? "geplant") as PortfolioWorkPackageStatus]}
                          </Badge>
                          {wpTasks.length > 0 && (
                            <span className="ml-2 text-xs text-muted-foreground">{wpTasks.length} Tasks</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{wp.responsible_user_id ? (userNameById[wp.responsible_user_id] ?? "—") : "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setMapDialog({
                                  open: true,
                                  target: { kind: "wp", portfolioWpId: wp.id, title: `${wp.code ?? ""} ${wp.name}` },
                                })
                              }
                            >
                              <Link2 className="h-3.5 w-3.5 mr-1" /> Projekt-APs
                            </Button>
                            {canManage && (
                              <>
                                <Button size="icon" variant="ghost" onClick={() => reorderWp.mutate({ id: wp.id, direction: -1 })} disabled={idx === 0}>
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => reorderWp.mutate({ id: wp.id, direction: 1 })} disabled={idx === wps.length - 1}>
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" title={wp.is_active ? "Deaktivieren" : "Aktivieren"} onClick={() => toggleActive.mutate(wp)}>
                                  <Power className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => openEditWp(wp)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => {
                                  if (wpTasks.length > 0) {
                                    toast.error("Arbeitspaket enthält Tasks und kann nicht gelöscht werden.");
                                    return;
                                  }
                                  if (confirm(`Arbeitspaket „${wp.name}" löschen?`)) removeWp.mutate(wp.id);
                                }}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow key={`${wp.id}-tasks`}>
                          <TableCell colSpan={8} className="bg-muted/40 py-3">
                            <div className="pl-8 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                  Tasks in {wp.code ?? wp.name}
                                </div>
                                {canManage && (
                                  <Button size="sm" variant="outline" onClick={() => openNewTask(wp.id)}>
                                    <Plus className="h-3.5 w-3.5 mr-1" /> Task
                                  </Button>
                                )}
                              </div>
                              {wpTasks.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Noch keine Tasks.</p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-24">Nr.</TableHead>
                                      <TableHead>Titel</TableHead>
                                      <TableHead>Zeitraum</TableHead>
                                      <TableHead className="w-24">Aufwand&nbsp;(h)</TableHead>
                                      <TableHead className="w-32">Status</TableHead>
                                      <TableHead className="w-56 text-right">Aktionen</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {wpTasks.map((t: any, tidx) => (
                                      <TableRow key={t.id}>
                                        <TableCell className="font-mono text-xs">{t.code ?? "—"}</TableCell>
                                        <TableCell>
                                          <div className="text-sm font-medium">{t.name}</div>
                                          {t.description && (
                                            <div className="text-xs text-muted-foreground line-clamp-1">{t.description}</div>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">{fmtRange(t.start_date, t.end_date)}</TableCell>
                                        <TableCell className="text-xs">{t.planned_effort_hours ?? "—"}</TableCell>
                                        <TableCell>
                                          <Badge variant="outline" className="text-xs">
                                            {TASK_STATUS_LABEL[t.status as PortfolioTaskStatus] ?? t.status}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <div className="inline-flex gap-1">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() =>
                                                setMapDialog({
                                                  open: true,
                                                  target: { kind: "task", portfolioTaskId: t.id, title: `${t.code ?? ""} ${t.name}` },
                                                })
                                              }
                                            >
                                              <Link2 className="h-3.5 w-3.5 mr-1" /> Projekt-APs
                                            </Button>
                                            {canManage && (
                                              <>
                                                <Button size="icon" variant="ghost" onClick={() => reorderTask.mutate({ id: t.id, wpId: wp.id, direction: -1 })} disabled={tidx === 0}>
                                                  <ChevronUp className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" onClick={() => reorderTask.mutate({ id: t.id, wpId: wp.id, direction: 1 })} disabled={tidx === wpTasks.length - 1}>
                                                  <ChevronDown className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" onClick={() => openEditTask(t)}>
                                                  <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" onClick={() => {
                                                  if (confirm(`Task „${t.name}" löschen?`)) removeTask.mutate(t.id);
                                                }}>
                                                  <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                              </>
                                            )}
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* WP dialog */}
      <Dialog open={wpDialog.open} onOpenChange={(o) => setWpDialog((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{wpDialog.id ? "Arbeitspaket bearbeiten" : "Neues Arbeitspaket"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Nummer</Label>
                <Input value={wpDialog.draft.code ?? ""} onChange={(e) => setWpDialog((s) => ({ ...s, draft: { ...s.draft, code: e.target.value } }))} placeholder="AP1" />
              </div>
              <div className="col-span-2">
                <Label>Titel *</Label>
                <Input value={wpDialog.draft.name ?? ""} onChange={(e) => setWpDialog((s) => ({ ...s, draft: { ...s.draft, name: e.target.value } }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kategorie</Label>
                <Select
                  value={wpDialog.draft.category_id ?? "__none__"}
                  onValueChange={(v) => setWpDialog((s) => ({ ...s, draft: { ...s.draft, category_id: v === "__none__" ? null : v } }))}
                >
                  <SelectTrigger><SelectValue placeholder="Keine" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— keine —</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={wpDialog.draft.status ?? "geplant"}
                  onValueChange={(v) => setWpDialog((s) => ({ ...s, draft: { ...s.draft, status: v } }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(WP_STATUS_LABEL) as PortfolioWorkPackageStatus[]).map((k) => (
                      <SelectItem key={k} value={k}>{WP_STATUS_LABEL[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Startdatum</Label>
                <Input type="date" value={wpDialog.draft.start_date ?? ""} onChange={(e) => setWpDialog((s) => ({ ...s, draft: { ...s.draft, start_date: e.target.value || null } }))} />
              </div>
              <div>
                <Label>Enddatum</Label>
                <Input type="date" value={wpDialog.draft.end_date ?? ""} onChange={(e) => setWpDialog((s) => ({ ...s, draft: { ...s.draft, end_date: e.target.value || null } }))} />
              </div>
              <div>
                <Label>Budget (€)</Label>
                <Input type="number" step="0.01" value={wpDialog.draft.budget ?? ""} onChange={(e) => setWpDialog((s) => ({ ...s, draft: { ...s.draft, budget: e.target.value } }))} />
              </div>
            </div>
            <div>
              <Label>Verantwortlicher</Label>
              <Select
                value={wpDialog.draft.responsible_user_id ?? "__none__"}
                onValueChange={(v) => setWpDialog((s) => ({ ...s, draft: { ...s.draft, responsible_user_id: v === "__none__" ? null : v } }))}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— keiner —</SelectItem>
                  {users.map((u: any) => (
                    <SelectItem key={u.user_id} value={u.user_id}>{`${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.user_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea rows={3} value={wpDialog.draft.description ?? ""} onChange={(e) => setWpDialog((s) => ({ ...s, draft: { ...s.draft, description: e.target.value } }))} />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="wp-active"
                checked={wpDialog.draft.is_active ?? true}
                onChange={(e) => setWpDialog((s) => ({ ...s, draft: { ...s.draft, is_active: e.target.checked } }))}
              />
              <Label htmlFor="wp-active" className="cursor-pointer">Aktiv</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWpDialog((s) => ({ ...s, open: false }))}>Abbrechen</Button>
            <Button onClick={() => saveWp.mutate()} disabled={!wpDialog.draft.name?.trim() || saveWp.isPending}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task dialog */}
      <Dialog open={taskDialog.open} onOpenChange={(o) => setTaskDialog((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{taskDialog.id ? "Task bearbeiten" : "Neuer Task"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Nummer</Label>
                <Input value={taskDialog.draft.code ?? ""} onChange={(e) => setTaskDialog((s) => ({ ...s, draft: { ...s.draft, code: e.target.value } }))} placeholder="2.1" />
              </div>
              <div className="col-span-2">
                <Label>Titel *</Label>
                <Input value={taskDialog.draft.name ?? ""} onChange={(e) => setTaskDialog((s) => ({ ...s, draft: { ...s.draft, name: e.target.value } }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Startdatum</Label>
                <Input type="date" value={taskDialog.draft.start_date ?? ""} onChange={(e) => setTaskDialog((s) => ({ ...s, draft: { ...s.draft, start_date: e.target.value || null } }))} />
              </div>
              <div>
                <Label>Enddatum</Label>
                <Input type="date" value={taskDialog.draft.end_date ?? ""} onChange={(e) => setTaskDialog((s) => ({ ...s, draft: { ...s.draft, end_date: e.target.value || null } }))} />
              </div>
              <div>
                <Label>Geplanter Aufwand (h)</Label>
                <Input type="number" step="0.25" value={taskDialog.draft.planned_effort_hours ?? ""} onChange={(e) => setTaskDialog((s) => ({ ...s, draft: { ...s.draft, planned_effort_hours: e.target.value } }))} />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={taskDialog.draft.status ?? "offen"} onValueChange={(v) => setTaskDialog((s) => ({ ...s, draft: { ...s.draft, status: v } }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="offen">Offen</SelectItem>
                  <SelectItem value="in_arbeit">In Arbeit</SelectItem>
                  <SelectItem value="erledigt">Erledigt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea rows={3} value={taskDialog.draft.description ?? ""} onChange={(e) => setTaskDialog((s) => ({ ...s, draft: { ...s.draft, description: e.target.value } }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialog((s) => ({ ...s, open: false }))}>Abbrechen</Button>
            <Button onClick={() => saveTask.mutate()} disabled={!taskDialog.draft.name?.trim() || saveTask.isPending}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mapping dialog */}
      <PortfolioProjectWpMappingDialog
        open={mapDialog.open}
        onOpenChange={(o) => setMapDialog((s) => ({ ...s, open: o }))}
        target={mapDialog.target}
        canManage={canManage}
      />
    </div>
  );
}
