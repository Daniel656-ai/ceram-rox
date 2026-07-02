import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Check, X, Trash2, Search, Phone, Mail, MessageSquare, Sparkles, GitBranch, ClipboardCheck, Users as UsersIcon, Lightbulb } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { useWeeklyReviews } from "@/hooks/useWeeklyReviews";
import {
  useProjectChangeRequests, useChangeRequestMutations,
  useProjectDecisions, useDecisionMutations,
  useProjectStakeholders, useStakeholderMutations,
  useProjectLessonsLearned, useLessonsLearnedMutations,
} from "@/hooks/useProjectGovernance";
import { formatCurrency } from "@/lib/formatCurrency";
import { toast } from "sonner";
import { PersonSelect } from "@/components/PersonSelect";

interface Props {
  projectId: string;
  canEdit: boolean;
  canApprove: boolean;
}

function userName(users: any[], id?: string | null) {
  if (!id) return "–";
  const u = users.find((u: any) => u.user_id === id);
  return u ? `${u.first_name} ${u.last_name}`.trim() || "–" : "–";
}

export function ProjectGovernanceTab({ projectId, canEdit, canApprove }: Props) {
  return (
    <Tabs defaultValue="changes" className="w-full">
      <TabsList>
        <TabsTrigger value="changes"><GitBranch className="h-3.5 w-3.5 mr-1" />Änderungen</TabsTrigger>
        <TabsTrigger value="decisions"><ClipboardCheck className="h-3.5 w-3.5 mr-1" />Entscheidungen</TabsTrigger>
        <TabsTrigger value="stakeholders"><UsersIcon className="h-3.5 w-3.5 mr-1" />Stakeholder</TabsTrigger>
        <TabsTrigger value="lessons"><Lightbulb className="h-3.5 w-3.5 mr-1" />Lessons Learned</TabsTrigger>
      </TabsList>

      <TabsContent value="changes"><ChangeRequestsSection projectId={projectId} canEdit={canEdit} canApprove={canApprove} /></TabsContent>
      <TabsContent value="decisions"><DecisionsSection projectId={projectId} canEdit={canEdit} /></TabsContent>
      <TabsContent value="stakeholders"><StakeholdersSection projectId={projectId} canEdit={canEdit} /></TabsContent>
      <TabsContent value="lessons"><LessonsLearnedSection projectId={projectId} canEdit={canEdit} /></TabsContent>
    </Tabs>
  );
}

// ============================================================
// CHANGE REQUESTS
// ============================================================
const STATUS_LABELS: Record<string, string> = {
  pending: "Ausstehend", approved: "Genehmigt", rejected: "Abgelehnt", withdrawn: "Zurückgezogen",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  withdrawn: "bg-muted text-muted-foreground",
};

function ChangeRequestsSection({ projectId, canEdit, canApprove }: { projectId: string; canEdit: boolean; canApprove: boolean }) {
  const { data: items = [] } = useProjectChangeRequests(projectId);
  const { data: users = [] } = useUsers();
  const { user } = useAuth();
  const m = useChangeRequestMutations(projectId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", impact_budget: "", impact_schedule_days: "", impact_description: "" });

  const submit = async () => {
    if (!form.title.trim() || !user) return toast.error("Titel erforderlich");
    await m.create.mutateAsync({
      project_id: projectId,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      requested_by: user.id,
      impact_budget: form.impact_budget ? Number(form.impact_budget) : null,
      impact_schedule_days: form.impact_schedule_days ? Number(form.impact_schedule_days) : null,
      impact_description: form.impact_description.trim() || undefined,
    });
    setForm({ title: "", description: "", impact_budget: "", impact_schedule_days: "", impact_description: "" });
    setOpen(false);
    toast.success("Änderungsantrag erstellt");
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{(items as any[]).length} Anträge</p>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Neuer Antrag</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Änderungsantrag erstellen</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Titel *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Beschreibung der Änderung</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Budget-Auswirkung (€)</Label><Input type="number" value={form.impact_budget} onChange={(e) => setForm({ ...form, impact_budget: e.target.value })} /></div>
                  <div><Label>Zeitplan-Auswirkung (Tage)</Label><Input type="number" value={form.impact_schedule_days} onChange={(e) => setForm({ ...form, impact_schedule_days: e.target.value })} /></div>
                </div>
                <div><Label>Auswirkung – Details</Label><Textarea value={form.impact_description} onChange={(e) => setForm({ ...form, impact_description: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={submit}>Erstellen</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {(items as any[]).length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Keine Änderungsanträge</CardContent></Card>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border">
          {(items as any[]).map((cr: any) => (
            <Card key={cr.id} className="relative">
              <span className="absolute -left-[18px] top-5 h-3 w-3 rounded-full bg-primary border-2 border-background" />
              <CardContent className="p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{cr.title}</h4>
                      <Badge variant="outline" className={STATUS_COLORS[cr.approval_status]}>{STATUS_LABELS[cr.approval_status]}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Antragsteller: {userName(users as any[], cr.requested_by)} · {new Date(cr.created_at).toLocaleDateString("de-DE")}
                    </p>
                  </div>
                  {canEdit && (
                    <Button variant="ghost" size="icon" onClick={() => m.remove.mutate(cr.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  )}
                </div>
                {cr.description && <p className="text-sm">{cr.description}</p>}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {cr.impact_budget != null && <span>💰 Budget: {formatCurrency(cr.impact_budget)} €</span>}
                  {cr.impact_schedule_days != null && <span>📅 Zeitplan: {cr.impact_schedule_days} Tage</span>}
                </div>
                {cr.impact_description && <p className="text-sm italic text-muted-foreground">{cr.impact_description}</p>}
                {cr.approval_status === "approved" && cr.approver_id && (
                  <p className="text-xs text-green-700 dark:text-green-400">
                    ✓ Genehmigt von {userName(users as any[], cr.approver_id)} am {cr.approval_date ? new Date(cr.approval_date).toLocaleDateString("de-DE") : "–"}
                  </p>
                )}
                {cr.approval_status === "pending" && canApprove && user && (
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="default" onClick={() => m.decide.mutate({ id: cr.id, status: "approved", approverId: user.id })}>
                      <Check className="h-3.5 w-3.5 mr-1" />Genehmigen
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => m.decide.mutate({ id: cr.id, status: "rejected", approverId: user.id })}>
                      <X className="h-3.5 w-3.5 mr-1" />Ablehnen
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => m.decide.mutate({ id: cr.id, status: "withdrawn", approverId: user.id })}>
                      Zurückziehen
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// DECISIONS
// ============================================================
const DEC_STATUS_LABELS: Record<string, string> = { active: "Aktiv", superseded: "Ersetzt", rejected: "Verworfen" };
const DEC_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  superseded: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function DecisionsSection({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const { data: items = [] } = useProjectDecisions(projectId);
  const { data: users = [] } = useUsers();
  const { user } = useAuth();
  const m = useDecisionMutations(projectId);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("__all__");
  const [form, setForm] = useState({ title: "", decision_date: new Date().toISOString().slice(0, 10), rationale: "", decided_by: "__none__", affected_areas: "" });

  const filtered = useMemo(() => {
    return (items as any[]).filter((d: any) => {
      const q = search.toLowerCase();
      const matchesQ = !q || d.title.toLowerCase().includes(q) || (d.rationale || "").toLowerCase().includes(q);
      const matchesF = filter === "__all__" || d.status === filter;
      return matchesQ && matchesF;
    });
  }, [items, search, filter]);

  const submit = async () => {
    if (!form.title.trim() || !user) return toast.error("Titel erforderlich");
    await m.create.mutateAsync({
      project_id: projectId,
      title: form.title.trim(),
      decision_date: form.decision_date,
      rationale: form.rationale.trim() || undefined,
      decided_by: form.decided_by === "__none__" ? null : form.decided_by,
      affected_areas: form.affected_areas.split(",").map(s => s.trim()).filter(Boolean),
      created_by: user.id,
    });
    setForm({ title: "", decision_date: new Date().toISOString().slice(0, 10), rationale: "", decided_by: "__none__", affected_areas: "" });
    setOpen(false);
    toast.success("Entscheidung gespeichert");
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 items-center flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input placeholder="Suchen…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Status</SelectItem>
              <SelectItem value="active">Aktiv</SelectItem>
              <SelectItem value="superseded">Ersetzt</SelectItem>
              <SelectItem value="rejected">Verworfen</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Entscheidung</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neue Entscheidung</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Titel *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Datum</Label><Input type="date" value={form.decision_date} onChange={(e) => setForm({ ...form, decision_date: e.target.value })} /></div>
                  <div>
                    <Label>Entscheider</Label>
                    <PersonSelect
                      value={form.decided_by}
                      onValueChange={(v) => setForm({ ...form, decided_by: v || "__none__" })}
                      users={users as any[]}
                      allowClear
                      clearLabel="–"
                    />
                  </div>
                </div>
                <div><Label>Begründung</Label><Textarea value={form.rationale} onChange={(e) => setForm({ ...form, rationale: e.target.value })} /></div>
                <div><Label>Betroffene Bereiche (kommagetrennt)</Label><Input value={form.affected_areas} onChange={(e) => setForm({ ...form, affected_areas: e.target.value })} placeholder="z. B. Budget, Scope, Zeitplan" /></div>
              </div>
              <DialogFooter><Button onClick={submit}>Speichern</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Keine Entscheidungen</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((d: any) => (
            <Card key={d.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold">{d.title}</h4>
                      <Badge variant="outline" className={DEC_STATUS_COLORS[d.status]}>{DEC_STATUS_LABELS[d.status]}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(d.decision_date).toLocaleDateString("de-DE")} · {userName(users as any[], d.decided_by)}
                    </p>
                    {d.rationale && <p className="text-sm mt-2">{d.rationale}</p>}
                    {Array.isArray(d.affected_areas) && d.affected_areas.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {d.affected_areas.map((a: string) => <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>)}
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex gap-1 items-center">
                      <Select value={d.status} onValueChange={(v) => m.update.mutate({ id: d.id, updates: { status: v } })}>
                        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Aktiv</SelectItem>
                          <SelectItem value="superseded">Ersetzt</SelectItem>
                          <SelectItem value="rejected">Verworfen</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" onClick={() => m.remove.mutate(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// STAKEHOLDERS
// ============================================================
const CHANNEL_ICONS: Record<string, any> = { email: Mail, phone: Phone, meeting: UsersIcon, portal: MessageSquare, other: MessageSquare };
const FREQ_LABELS: Record<string, string> = { daily: "Täglich", weekly: "Wöchentlich", biweekly: "14-tägig", monthly: "Monatlich", quarterly: "Quartalsweise", adhoc: "Ad-hoc" };

function StakeholdersSection({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const { data: items = [] } = useProjectStakeholders(projectId);
  const { data: users = [] } = useUsers();
  const { user } = useAuth();
  const m = useStakeholderMutations(projectId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", organization: "", role: "", contact_email: "", contact_phone: "", channel: "email", frequency: "monthly", responsible_user_id: "__none__", notes: "" });

  const submit = async () => {
    if (!form.name.trim() || !user) return toast.error("Name erforderlich");
    await m.create.mutateAsync({
      project_id: projectId,
      name: form.name.trim(),
      organization: form.organization.trim() || undefined,
      role: form.role.trim() || undefined,
      contact_email: form.contact_email.trim() || undefined,
      contact_phone: form.contact_phone.trim() || undefined,
      channel: form.channel,
      frequency: form.frequency,
      responsible_user_id: form.responsible_user_id === "__none__" ? null : form.responsible_user_id,
      notes: form.notes.trim() || undefined,
      created_by: user.id,
    });
    setForm({ name: "", organization: "", role: "", contact_email: "", contact_phone: "", channel: "email", frequency: "monthly", responsible_user_id: "__none__", notes: "" });
    setOpen(false);
    toast.success("Stakeholder hinzugefügt");
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{(items as any[]).length} Stakeholder</p>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Stakeholder</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neuer Stakeholder</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div><Label>Organisation</Label><Input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} /></div>
                </div>
                <div><Label>Rolle</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>E-Mail</Label><Input value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
                  <div><Label>Telefon</Label><Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Kanal</Label>
                    <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">E-Mail</SelectItem>
                        <SelectItem value="phone">Telefon</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="portal">Portal</SelectItem>
                        <SelectItem value="other">Sonstige</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Frequenz</Label>
                    <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(FREQ_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Verantwortlich (intern)</Label>
                  <PersonSelect
                    value={form.responsible_user_id}
                    onValueChange={(v) => setForm({ ...form, responsible_user_id: v || "__none__" })}
                    users={users as any[]}
                    allowClear
                    clearLabel="–"
                  />
                </div>
                <div><Label>Notizen</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={submit}>Speichern</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {(items as any[]).length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Keine Stakeholder</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Name / Org.</th>
                  <th className="p-3">Rolle</th>
                  <th className="p-3">Kanal</th>
                  <th className="p-3">Frequenz</th>
                  <th className="p-3">Verantwortlich</th>
                  <th className="p-3">Letzter Kontakt</th>
                  <th className="p-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {(items as any[]).map((s: any) => {
                  const Icon = CHANNEL_ICONS[s.channel] || MessageSquare;
                  return (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">
                        <div className="font-medium">{s.name}</div>
                        {s.organization && <div className="text-xs text-muted-foreground">{s.organization}</div>}
                        {(s.contact_email || s.contact_phone) && (
                          <div className="text-xs text-muted-foreground">{s.contact_email}{s.contact_email && s.contact_phone ? " · " : ""}{s.contact_phone}</div>
                        )}
                      </td>
                      <td className="p-3">{s.role || "–"}</td>
                      <td className="p-3"><Icon className="h-4 w-4 inline" /></td>
                      <td className="p-3">{FREQ_LABELS[s.frequency] || s.frequency}</td>
                      <td className="p-3">{userName(users as any[], s.responsible_user_id)}</td>
                      <td className="p-3 text-xs">
                        {s.last_contact_at ? new Date(s.last_contact_at).toLocaleDateString("de-DE") : <span className="text-muted-foreground italic">noch nicht</span>}
                        {canEdit && (
                          <Button variant="link" size="sm" className="h-auto p-0 ml-2 text-xs" onClick={() => m.touch.mutate(s.id)}>Aktualisieren</Button>
                        )}
                      </td>
                      <td className="p-3">
                        {canEdit && <Button variant="ghost" size="icon" onClick={() => m.remove.mutate(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// LESSONS LEARNED
// ============================================================
function LessonsLearnedSection({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const { data: items = [] } = useProjectLessonsLearned(projectId);
  const { data: reviews = [] } = useWeeklyReviews(projectId);
  const { user } = useAuth();
  const m = useLessonsLearnedMutations(projectId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ went_well: "", went_wrong: "", recommendations: "", overall_rating: "", follow_up_actions: "" });

  const prefillFromReviews = () => {
    const recent = (reviews as any[]).slice(0, 4);
    const wells = recent.map((r: any) => r.highlights || r.achievements || r.went_well).filter(Boolean).join("\n");
    const wrongs = recent.map((r: any) => r.risks || r.issues || r.challenges || r.went_wrong).filter(Boolean).join("\n");
    setForm((f) => ({ ...f, went_well: wells || f.went_well, went_wrong: wrongs || f.went_wrong }));
    toast.success(`Aus ${recent.length} Weekly Reviews vorbefüllt`);
  };

  const submit = async () => {
    if (!user) return;
    await m.create.mutateAsync({
      project_id: projectId,
      went_well: form.went_well.trim() || undefined,
      went_wrong: form.went_wrong.trim() || undefined,
      recommendations: form.recommendations.trim() || undefined,
      overall_rating: form.overall_rating ? Number(form.overall_rating) : null,
      follow_up_actions: form.follow_up_actions.trim() || undefined,
      related_weekly_review_ids: (reviews as any[]).slice(0, 4).map((r: any) => r.id),
      created_by: user.id,
    });
    setForm({ went_well: "", went_wrong: "", recommendations: "", overall_rating: "", follow_up_actions: "" });
    setOpen(false);
    toast.success("Lessons Learned gespeichert");
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{(items as any[]).length} Einträge</p>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Neuer Eintrag</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Lessons Learned</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {(reviews as any[]).length > 0 && (
                  <Button type="button" variant="outline" size="sm" onClick={prefillFromReviews}>
                    <Sparkles className="h-4 w-4 mr-1" />Aus Weekly Reviews vorbefüllen
                  </Button>
                )}
                <div><Label>Was lief gut?</Label><Textarea rows={3} value={form.went_well} onChange={(e) => setForm({ ...form, went_well: e.target.value })} /></div>
                <div><Label>Was lief schlecht?</Label><Textarea rows={3} value={form.went_wrong} onChange={(e) => setForm({ ...form, went_wrong: e.target.value })} /></div>
                <div><Label>Empfehlungen für zukünftige Projekte</Label><Textarea rows={3} value={form.recommendations} onChange={(e) => setForm({ ...form, recommendations: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Gesamtbewertung (1–5)</Label>
                    <Select value={form.overall_rating} onValueChange={(v) => setForm({ ...form, overall_rating: v })}>
                      <SelectTrigger><SelectValue placeholder="–" /></SelectTrigger>
                      <SelectContent>{[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n} ⭐</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Maßnahmen für Folgeprojekte</Label><Textarea rows={2} value={form.follow_up_actions} onChange={(e) => setForm({ ...form, follow_up_actions: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={submit}>Speichern</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {(items as any[]).length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Noch keine Lessons Learned</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(items as any[]).map((l: any) => (
            <Card key={l.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{new Date(l.created_at).toLocaleDateString("de-DE")}</CardTitle>
                  {l.overall_rating && <Badge variant="outline">{l.overall_rating} ⭐</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {l.went_well && (<div><span className="font-medium text-green-700 dark:text-green-400">✓ Gut:</span><p className="whitespace-pre-wrap">{l.went_well}</p></div>)}
                {l.went_wrong && (<div><span className="font-medium text-red-700 dark:text-red-400">✗ Schlecht:</span><p className="whitespace-pre-wrap">{l.went_wrong}</p></div>)}
                {l.recommendations && (<div><span className="font-medium">💡 Empfehlungen:</span><p className="whitespace-pre-wrap">{l.recommendations}</p></div>)}
                {l.follow_up_actions && (<div><span className="font-medium">→ Folgemaßnahmen:</span><p className="whitespace-pre-wrap">{l.follow_up_actions}</p></div>)}
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => m.remove.mutate(l.id)} className="text-destructive">
                    <Trash2 className="h-3.5 w-3.5 mr-1" />Löschen
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
