import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { useWeeklyReviews } from "@/hooks/useWeeklyReviews";
import type { ProjectClosureReport, DeliveredResult, OpenItem } from "@/lib/api/projectClosure";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  CheckCircle2, ClipboardCheck, FileDown, Plus, Printer, Save, Sparkles, Trash2, Wand2,
} from "lucide-react";
import { PersonSelect } from "@/components/PersonSelect";

interface Props {
  projectId: string;
  canEdit: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Entwurf",
  in_approval: "In Freigabe",
  approved: "Freigegeben",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  in_approval: "secondary",
  approved: "default",
};

function daysBetween(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (isNaN(ms)) return null;
  return Math.round(ms / 86400000);
}

function fmtDate(d?: string | null) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-DE");
}

function fmtMoney(n?: number | null, currency = "EUR") {
  if (n === null || n === undefined) return "–";
  try {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(Number(n));
  } catch {
    return `${n} ${currency}`;
  }
}

export function ProjectClosureTab({ projectId, canEdit }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: users = [] } = useUsers();

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.projects.get(projectId),
    enabled: !!projectId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => api.projectMembers.list(projectId),
    enabled: !!projectId,
  });

  const { data: closure, isLoading } = useQuery({
    queryKey: ["project-closure", projectId],
    queryFn: () => api.projectClosure.get(projectId),
    enabled: !!projectId,
  });

  const { data: decisions = [] } = useQuery({
    queryKey: ["project-decisions", projectId],
    queryFn: () => api.projectDecisions.list(projectId),
    enabled: !!projectId,
  });

  const { data: changeRequests = [] } = useQuery({
    queryKey: ["project-change-requests", projectId],
    queryFn: () => api.projectChangeRequests.list(projectId),
    enabled: !!projectId,
  });

  const { data: weeklyReviews = [] } = useWeeklyReviews(projectId);

  const { data: timeEntryIdx = [] } = useQuery({
    queryKey: ["project-time-entries-sum", projectId],
    queryFn: () => api.projectTimeEntries.list(projectId),
    enabled: !!projectId,
  });

  const { data: knetungIdx = [] } = useQuery({
    queryKey: ["project-knetung-materials", projectId],
    queryFn: () => api.projectKnetungMaterials.list(projectId),
    enabled: !!projectId,
  });

  const { data: consumablesIdx = [] } = useQuery({
    queryKey: ["project-consumables", projectId],
    queryFn: () => api.projectConsumables.list(projectId),
    enabled: !!projectId,
  });

  const ownerMember = (members as any[]).find((m) => m.role === "owner");
  const leaderMember = (members as any[]).find((m) => m.role === "leader");
  const userName = (uid?: string | null) => {
    if (!uid) return "–";
    const u = (users as any[]).find((u) => u.user_id === uid);
    return u ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "–" : "–";
  };

  const projectTeam = (members as any[])
    .map((m) => `${userName(m.user_id)} (${m.role})`)
    .join(", ");

  // Aggregierte Ist-Kosten (nur Material - personalkosten hier nicht zwingend sichtbar)
  const actualCostSum = useMemo(() => {
    const k = (knetungIdx as any[]).reduce((s, r) => s + Number(r.total_cost || 0), 0);
    const c = (consumablesIdx as any[]).reduce((s, r) => s + Number(r.total_cost || 0), 0);
    return k + c;
  }, [knetungIdx, consumablesIdx]);

  // --- Local form state ---
  const [form, setForm] = useState<Partial<ProjectClosureReport>>({});
  const [delivered, setDelivered] = useState<DeliveredResult[]>([]);
  const [openItems, setOpenItems] = useState<OpenItem[]>([]);
  const [selectedDecisions, setSelectedDecisions] = useState<Set<string>>(new Set());
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (closure) {
      setForm(closure);
      setDelivered(Array.isArray(closure.delivered_results) ? closure.delivered_results : []);
      setOpenItems(Array.isArray(closure.open_items) ? closure.open_items : []);
      setSelectedDecisions(new Set(closure.related_decision_ids ?? []));
      setSelectedChanges(new Set(closure.related_change_request_ids ?? []));
    } else if (project) {
      setForm({
        planned_end_date: (project as any).end_date,
        actual_end_date: new Date().toISOString().slice(0, 10),
        budget_planned: (project as any).budget_total ?? null,
        budget_actual: actualCostSum || null,
        budget_currency: (project as any).budget_currency ?? "EUR",
        project_leader_id: leaderMember?.user_id ?? ownerMember?.user_id ?? null,
      });
    }
  }, [closure, project, actualCostSum, leaderMember?.user_id, ownerMember?.user_id]);

  const set = <K extends keyof ProjectClosureReport>(k: K, v: any) =>
    setForm((p) => ({ ...p, [k]: v }));

  const scheduleDeviation = useMemo(
    () => daysBetween(form.planned_end_date, form.actual_end_date),
    [form.planned_end_date, form.actual_end_date]
  );
  const budgetDeviation = useMemo(() => {
    if (form.budget_planned === null || form.budget_planned === undefined) return null;
    if (form.budget_actual === null || form.budget_actual === undefined) return null;
    return Number(form.budget_actual) - Number(form.budget_planned);
  }, [form.budget_planned, form.budget_actual]);

  // --- Auto-prefill helpers ---
  const prefillFromWeeklyReviews = () => {
    const wells = (weeklyReviews as any[])
      .map((r) => r.completed_this_week)
      .filter(Boolean).slice(0, 8).join("\n• ");
    const risks = (weeklyReviews as any[])
      .map((r) => r.risks).filter(Boolean).slice(0, 8).join("\n• ");
    const helps = (weeklyReviews as any[])
      .map((r) => r.help_needed).filter(Boolean).slice(0, 8).join("\n• ");
    setForm((p) => ({
      ...p,
      went_well: p.went_well || (wells ? "• " + wells : ""),
      went_wrong: p.went_wrong || (helps ? "• " + helps : ""),
      risks_occurred: p.risks_occurred || (risks ? "• " + risks : ""),
    }));
    toast.success("Aus Weekly Reviews übernommen");
  };

  const prefillDecisionsAndChanges = () => {
    setSelectedDecisions(new Set((decisions as any[]).map((d) => d.id)));
    setSelectedChanges(new Set((changeRequests as any[]).map((c) => c.id)));
    const decSummary = (decisions as any[])
      .map((d) => `• ${fmtDate(d.decision_date)}: ${d.title}`)
      .join("\n");
    const chgSummary = (changeRequests as any[])
      .map((c) => `• ${c.title}${c.approval_status ? ` [${c.approval_status}]` : ""}`)
      .join("\n");
    setForm((p) => ({
      ...p,
      key_decisions_summary: p.key_decisions_summary || decSummary,
      key_changes_summary: p.key_changes_summary || chgSummary,
    }));
    toast.success("Entscheidungen und Änderungen übernommen");
  };

  // --- Save ---
  const save = async (newStatus?: ProjectClosureReport["status"]) => {
    if (!user) return;
    try {
      const payload: any = {
        ...form,
        delivered_results: delivered,
        open_items: openItems,
        related_decision_ids: Array.from(selectedDecisions),
        related_change_request_ids: Array.from(selectedChanges),
        schedule_deviation_days: scheduleDeviation,
        updated_by: user.id,
      };
      if (newStatus) payload.status = newStatus;
      if (closure) {
        await api.projectClosure.update(closure.id, payload);
      } else {
        await api.projectClosure.create({
          project_id: projectId,
          created_by: user.id,
          ...payload,
        });
      }
      toast.success("Abschlussbericht gespeichert");
      qc.invalidateQueries({ queryKey: ["project-closure", projectId] });
    } catch (e: any) {
      toast.error(e.message || "Speichern fehlgeschlagen");
    }
  };

  const finalize = async () => {
    if (!closure) {
      await save("approved");
    }
    try {
      const current = await api.projectClosure.get(projectId);
      if (!current) return;
      await api.projectClosure.update(current.id, {
        project_leader_signed_at: form.project_leader_signed_at || new Date().toISOString(),
        approval_date: form.approval_date || new Date().toISOString().slice(0, 10),
      });
      await api.projectClosure.finalize(current.id);
      toast.success("Projekt erfolgreich abgeschlossen");
      qc.invalidateQueries({ queryKey: ["project-closure", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    } catch (e: any) {
      toast.error(e.message || "Abschluss fehlgeschlagen");
    }
  };

  if (isLoading) return <div className="p-4 text-muted-foreground">Lädt…</div>;

  const status = (form.status as ProjectClosureReport["status"]) || "draft";
  const isApproved = status === "approved";

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" /> Projektabschluss
              <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Geführter Prozess zur Dokumentation und Freigabe des Projektabschlusses.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />Druckansicht / PDF
            </Button>
            {canEdit && !isApproved && (
              <>
                <Button size="sm" variant="outline" onClick={() => save("draft")}>
                  <Save className="h-4 w-4 mr-2" />Entwurf speichern
                </Button>
                <Button size="sm" variant="outline" onClick={() => save("in_approval")}>
                  In Freigabe geben
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm">
                      <CheckCircle2 className="h-4 w-4 mr-2" />Freigeben & Projekt abschließen
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Projekt endgültig abschließen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Der Abschlussbericht wird freigegeben und das Projekt erhält den Status „Abgeschlossen". Diese Aktion sollte erst nach vollständiger Dokumentation erfolgen.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction onClick={finalize}>Projekt abschließen</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </CardHeader>
      </Card>

      <Accordion type="multiple" defaultValue={["overview", "goals", "schedule", "budget"]} className="space-y-2">
        {/* 1. Projektübersicht */}
        <AccordionItem value="overview" className="border rounded-md px-4 bg-card">
          <AccordionTrigger>1. Projektübersicht</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Projektname:</span> <b>{(project as any)?.project_name ?? (project as any)?.project_number}</b></div>
              <div><span className="text-muted-foreground">Projektnummer:</span> {(project as any)?.project_number}</div>
              <div><span className="text-muted-foreground">Projektleiter:</span> {userName(leaderMember?.user_id) || userName(ownerMember?.user_id)}</div>
              <div><span className="text-muted-foreground">Projektowner:</span> {userName(ownerMember?.user_id)}</div>
              <div><span className="text-muted-foreground">Startdatum:</span> {fmtDate((project as any)?.start_date)}</div>
              <div><span className="text-muted-foreground">Enddatum (geplant):</span> {fmtDate((project as any)?.end_date)}</div>
              <div className="md:col-span-2"><span className="text-muted-foreground">Projektteam:</span> {projectTeam || "–"}</div>
              <div><span className="text-muted-foreground">Aktueller Status:</span> {(project as any)?.project_status ?? "–"}</div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 2. Zielerreichung */}
        <AccordionItem value="goals" className="border rounded-md px-4 bg-card">
          <AccordionTrigger>2. Zielerreichung</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div>
              <Label>Ursprüngliche Projektziele</Label>
              <Textarea rows={3} disabled={!canEdit || isApproved}
                value={form.original_goals ?? ""}
                onChange={(e) => set("original_goals", e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Erreichte Ziele</Label>
                <Textarea rows={3} disabled={!canEdit || isApproved}
                  value={form.achieved_goals ?? ""}
                  onChange={(e) => set("achieved_goals", e.target.value)} />
              </div>
              <div>
                <Label>Nicht erreichte Ziele</Label>
                <Textarea rows={3} disabled={!canEdit || isApproved}
                  value={form.missed_goals ?? ""}
                  onChange={(e) => set("missed_goals", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Begründungen für Abweichungen</Label>
              <Textarea rows={2} disabled={!canEdit || isApproved}
                value={form.deviation_reasons ?? ""}
                onChange={(e) => set("deviation_reasons", e.target.value)} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 3. Terminbewertung */}
        <AccordionItem value="schedule" className="border rounded-md px-4 bg-card">
          <AccordionTrigger>3. Terminbewertung</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Geplanter Fertigstellungstermin</Label>
                <Input type="date" disabled={!canEdit || isApproved}
                  value={form.planned_end_date ?? ""}
                  onChange={(e) => set("planned_end_date", e.target.value || null)} />
              </div>
              <div>
                <Label>Tatsächlicher Fertigstellungstermin</Label>
                <Input type="date" disabled={!canEdit || isApproved}
                  value={form.actual_end_date ?? ""}
                  onChange={(e) => set("actual_end_date", e.target.value || null)} />
              </div>
              <div>
                <Label>Terminabweichung</Label>
                <div className="h-10 flex items-center px-3 border rounded-md bg-muted/40 text-sm">
                  {scheduleDeviation === null ? "–" : `${scheduleDeviation > 0 ? "+" : ""}${scheduleDeviation} Tage`}
                </div>
              </div>
            </div>
            <div>
              <Label>Ursachenanalyse</Label>
              <Textarea rows={2} disabled={!canEdit || isApproved}
                value={form.schedule_root_cause ?? ""}
                onChange={(e) => set("schedule_root_cause", e.target.value)} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 4. Budgetbewertung */}
        <AccordionItem value="budget" className="border rounded-md px-4 bg-card">
          <AccordionTrigger>4. Budgetbewertung</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label>Geplantes Budget</Label>
                <Input type="number" step="0.01" disabled={!canEdit || isApproved}
                  value={form.budget_planned ?? ""}
                  onChange={(e) => set("budget_planned", e.target.value === "" ? null : Number(e.target.value))} />
              </div>
              <div>
                <Label>Tatsächliche Kosten</Label>
                <Input type="number" step="0.01" disabled={!canEdit || isApproved}
                  value={form.budget_actual ?? ""}
                  onChange={(e) => set("budget_actual", e.target.value === "" ? null : Number(e.target.value))} />
              </div>
              <div>
                <Label>Währung</Label>
                <Input disabled={!canEdit || isApproved}
                  value={form.budget_currency ?? "EUR"}
                  onChange={(e) => set("budget_currency", e.target.value)} />
              </div>
              <div>
                <Label>Budgetabweichung</Label>
                <div className="h-10 flex items-center px-3 border rounded-md bg-muted/40 text-sm">
                  {budgetDeviation === null ? "–" : fmtMoney(budgetDeviation, form.budget_currency ?? "EUR")}
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Erfasste Materialkosten im System: {fmtMoney(actualCostSum, form.budget_currency ?? "EUR")}.
              {canEdit && !isApproved && (
                <Button size="sm" variant="ghost" className="ml-2 h-6"
                  onClick={() => set("budget_actual", actualCostSum)}>
                  <Wand2 className="h-3 w-3 mr-1" />übernehmen
                </Button>
              )}
            </div>
            <div>
              <Label>Erläuterung wesentlicher Abweichungen</Label>
              <Textarea rows={2} disabled={!canEdit || isApproved}
                value={form.budget_deviation_explanation ?? ""}
                onChange={(e) => set("budget_deviation_explanation", e.target.value)} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 5. Ergebnisbewertung */}
        <AccordionItem value="results" className="border rounded-md px-4 bg-card">
          <AccordionTrigger>5. Ergebnisbewertung</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Gelieferte Ergebnisse</Label>
                {canEdit && !isApproved && (
                  <Button size="sm" variant="outline"
                    onClick={() => setDelivered((p) => [...p, { title: "", description: "", status: "ok" }])}>
                    <Plus className="h-3 w-3 mr-1" />Ergebnis
                  </Button>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titel</TableHead>
                    <TableHead>Beschreibung</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {delivered.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm">Noch keine Ergebnisse erfasst</TableCell></TableRow>
                  )}
                  {delivered.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell><Input disabled={!canEdit || isApproved} value={r.title} onChange={(e) => setDelivered((p) => p.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))} /></TableCell>
                      <TableCell><Input disabled={!canEdit || isApproved} value={r.description ?? ""} onChange={(e) => setDelivered((p) => p.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} /></TableCell>
                      <TableCell>
                        <Select value={r.status ?? "ok"} disabled={!canEdit || isApproved}
                          onValueChange={(v) => setDelivered((p) => p.map((x, idx) => idx === i ? { ...x, status: v as any } : x))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ok">Geliefert</SelectItem>
                            <SelectItem value="partial">Teilweise</SelectItem>
                            <SelectItem value="missing">Fehlt</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {canEdit && !isApproved && (
                          <Button size="icon" variant="ghost" onClick={() => setDelivered((p) => p.filter((_, idx) => idx !== i))}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Qualitätsbewertung</Label>
                <Textarea rows={3} disabled={!canEdit || isApproved}
                  value={form.quality_assessment ?? ""}
                  onChange={(e) => set("quality_assessment", e.target.value)} />
              </div>
              <div>
                <Label>Kundenzufriedenheit (1–5, optional)</Label>
                <Input type="number" min={1} max={5} disabled={!canEdit || isApproved}
                  value={form.customer_satisfaction ?? ""}
                  onChange={(e) => set("customer_satisfaction", e.target.value === "" ? null : Number(e.target.value))} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Offene Restpunkte</Label>
                {canEdit && !isApproved && (
                  <Button size="sm" variant="outline"
                    onClick={() => setOpenItems((p) => [...p, { title: "", owner: "", due_date: "", notes: "" }])}>
                    <Plus className="h-3 w-3 mr-1" />Restpunkt
                  </Button>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titel</TableHead>
                    <TableHead>Verantwortlich</TableHead>
                    <TableHead className="w-40">Fällig bis</TableHead>
                    <TableHead>Notiz</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openItems.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm">Keine offenen Punkte</TableCell></TableRow>
                  )}
                  {openItems.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell><Input disabled={!canEdit || isApproved} value={r.title} onChange={(e) => setOpenItems((p) => p.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))} /></TableCell>
                      <TableCell><Input disabled={!canEdit || isApproved} value={r.owner ?? ""} onChange={(e) => setOpenItems((p) => p.map((x, idx) => idx === i ? { ...x, owner: e.target.value } : x))} /></TableCell>
                      <TableCell><Input type="date" disabled={!canEdit || isApproved} value={r.due_date ?? ""} onChange={(e) => setOpenItems((p) => p.map((x, idx) => idx === i ? { ...x, due_date: e.target.value } : x))} /></TableCell>
                      <TableCell><Input disabled={!canEdit || isApproved} value={r.notes ?? ""} onChange={(e) => setOpenItems((p) => p.map((x, idx) => idx === i ? { ...x, notes: e.target.value } : x))} /></TableCell>
                      <TableCell>
                        {canEdit && !isApproved && (
                          <Button size="icon" variant="ghost" onClick={() => setOpenItems((p) => p.filter((_, idx) => idx !== i))}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 6. Lessons Learned */}
        <AccordionItem value="lessons" className="border rounded-md px-4 bg-card">
          <AccordionTrigger>6. Lessons Learned</AccordionTrigger>
          <AccordionContent className="space-y-3">
            {canEdit && !isApproved && (weeklyReviews as any[]).length > 0 && (
              <Button size="sm" variant="outline" onClick={prefillFromWeeklyReviews}>
                <Sparkles className="h-3 w-3 mr-1" />Aus Weekly Reviews vorbefüllen ({(weeklyReviews as any[]).length})
              </Button>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Was lief gut?</Label>
                <Textarea rows={4} disabled={!canEdit || isApproved}
                  value={form.went_well ?? ""}
                  onChange={(e) => set("went_well", e.target.value)} />
              </div>
              <div>
                <Label>Was lief nicht gut?</Label>
                <Textarea rows={4} disabled={!canEdit || isApproved}
                  value={form.went_wrong ?? ""}
                  onChange={(e) => set("went_wrong", e.target.value)} />
              </div>
              <div>
                <Label>Eingetretene Risiken</Label>
                <Textarea rows={3} disabled={!canEdit || isApproved}
                  value={form.risks_occurred ?? ""}
                  onChange={(e) => set("risks_occurred", e.target.value)} />
              </div>
              <div>
                <Label>Erfolgsfaktoren</Label>
                <Textarea rows={3} disabled={!canEdit || isApproved}
                  value={form.success_factors ?? ""}
                  onChange={(e) => set("success_factors", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Empfehlungen für zukünftige Projekte</Label>
              <Textarea rows={3} disabled={!canEdit || isApproved}
                value={form.recommendations ?? ""}
                onChange={(e) => set("recommendations", e.target.value)} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 7. Wichtige Entscheidungen & Änderungen */}
        <AccordionItem value="decisions" className="border rounded-md px-4 bg-card">
          <AccordionTrigger>7. Entscheidungen & Änderungen im Projektverlauf</AccordionTrigger>
          <AccordionContent className="space-y-4">
            {canEdit && !isApproved && (
              <Button size="sm" variant="outline" onClick={prefillDecisionsAndChanges}>
                <Sparkles className="h-3 w-3 mr-1" />Aus Logs übernehmen
              </Button>
            )}

            <div>
              <Label className="mb-2 block">Entscheidungslog ({(decisions as any[]).length})</Label>
              <div className="border rounded-md max-h-60 overflow-y-auto divide-y">
                {(decisions as any[]).length === 0 && <div className="p-3 text-sm text-muted-foreground">Keine Einträge</div>}
                {(decisions as any[]).map((d: any) => (
                  <label key={d.id} className="flex items-start gap-2 p-2 text-sm cursor-pointer hover:bg-muted/50">
                    <input type="checkbox" disabled={!canEdit || isApproved}
                      checked={selectedDecisions.has(d.id)}
                      onChange={(e) => setSelectedDecisions((s) => {
                        const n = new Set(s);
                        if (e.target.checked) n.add(d.id); else n.delete(d.id);
                        return n;
                      })} className="mt-1" />
                    <div>
                      <div className="font-medium">{d.title}</div>
                      <div className="text-xs text-muted-foreground">{fmtDate(d.decision_date)} · {d.rationale ?? ""}</div>
                    </div>
                  </label>
                ))}
              </div>
              <Textarea className="mt-2" rows={3} placeholder="Zusammenfassung relevanter Entscheidungen"
                disabled={!canEdit || isApproved}
                value={form.key_decisions_summary ?? ""}
                onChange={(e) => set("key_decisions_summary", e.target.value)} />
            </div>

            <div>
              <Label className="mb-2 block">Change Log ({(changeRequests as any[]).length})</Label>
              <div className="border rounded-md max-h-60 overflow-y-auto divide-y">
                {(changeRequests as any[]).length === 0 && <div className="p-3 text-sm text-muted-foreground">Keine Einträge</div>}
                {(changeRequests as any[]).map((c: any) => (
                  <label key={c.id} className="flex items-start gap-2 p-2 text-sm cursor-pointer hover:bg-muted/50">
                    <input type="checkbox" disabled={!canEdit || isApproved}
                      checked={selectedChanges.has(c.id)}
                      onChange={(e) => setSelectedChanges((s) => {
                        const n = new Set(s);
                        if (e.target.checked) n.add(c.id); else n.delete(c.id);
                        return n;
                      })} className="mt-1" />
                    <div>
                      <div className="font-medium">{c.title} {c.approval_status && <Badge variant="outline" className="ml-1">{c.approval_status}</Badge>}</div>
                      <div className="text-xs text-muted-foreground">{c.impact_description ?? c.description ?? ""}</div>
                    </div>
                  </label>
                ))}
              </div>
              <Textarea className="mt-2" rows={3} placeholder="Zusammenfassung wesentlicher Änderungen"
                disabled={!canEdit || isApproved}
                value={form.key_changes_summary ?? ""}
                onChange={(e) => set("key_changes_summary", e.target.value)} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 8. Abschlussfreigabe */}
        <AccordionItem value="approval" className="border rounded-md px-4 bg-card">
          <AccordionTrigger>8. Abschlussfreigabe</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Projektleiter</Label>
                <Select value={form.project_leader_id ?? "__none__"}
                  onValueChange={(v) => set("project_leader_id", v === "__none__" ? null : v)}
                  disabled={!canEdit || isApproved}>
                  <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">– nicht zugewiesen –</SelectItem>
                    {(users as any[]).map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {`${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.user_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground mt-1">
                  Freigabe: {form.project_leader_signed_at ? new Date(form.project_leader_signed_at).toLocaleString("de-DE") : "noch nicht freigegeben"}
                </div>
              </div>
              <div>
                <Label>Auftraggeber / Sponsor</Label>
                <Input disabled={!canEdit || isApproved}
                  placeholder="Name des Auftraggebers"
                  value={form.sponsor_name ?? ""}
                  onChange={(e) => set("sponsor_name", e.target.value)} />
                <div className="text-xs text-muted-foreground mt-1">
                  Freigabe: {form.sponsor_signed_at ? new Date(form.sponsor_signed_at).toLocaleString("de-DE") : "noch nicht freigegeben"}
                </div>
              </div>
              <div>
                <Label>Freigabedatum</Label>
                <Input type="date" disabled={!canEdit || isApproved}
                  value={form.approval_date ?? ""}
                  onChange={(e) => set("approval_date", e.target.value || null)} />
              </div>
              <div>
                <Label>Abschlussstatus</Label>
                <div className="h-10 flex items-center px-3 border rounded-md bg-muted/40 text-sm">
                  <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
                </div>
              </div>
            </div>
            <div>
              <Label>Schlussbemerkungen</Label>
              <Textarea rows={3} disabled={!canEdit || isApproved}
                value={form.final_remarks ?? ""}
                onChange={(e) => set("final_remarks", e.target.value)} />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="text-xs text-muted-foreground print:hidden">
        Tipp: „Druckansicht / PDF" speichert den Bericht über den Browser-Druckdialog als PDF.
      </div>
    </div>
  );
}
