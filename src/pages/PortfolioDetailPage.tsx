import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Pencil, Save, X, FolderPlus, Briefcase, CalendarDays } from "lucide-react";
import PortfolioAnalyticsTab from "@/components/PortfolioAnalyticsTab";
import PortfolioDocumentsTab from "@/components/PortfolioDocumentsTab";
import PortfolioDashboardTab from "@/components/PortfolioDashboardTab";
import PortfolioStructureTab from "@/components/portfolio/PortfolioStructureTab";
import PortfolioFundingMappingTab from "@/components/portfolio/PortfolioFundingMappingTab";
import PortfolioFfgReportTab from "@/components/portfolio/PortfolioFfgReportTab";
import PortfolioTimeEntries from "@/components/portfolio/PortfolioTimeEntries";
import PortfolioControllingTab from "@/components/portfolio/controlling/PortfolioControllingTab";
import { useCanManagePortfolio } from "@/hooks/useCanManagePortfolio";
import { CurrencyInput } from "@/components/ui/currency-input";
import { formatCurrency } from "@/lib/formatCurrency";

const STATUS_LABEL: Record<string, string> = {
  planung: "In Planung", aktiv: "Aktiv", pausiert: "Pausiert",
  abgeschlossen: "Abgeschlossen", abgebrochen: "Abgebrochen",
};

const MILESTONE_STATUS_LABEL: Record<string, string> = {
  offen: "Offen",
  erledigt: "Erledigt",
  ueberfaellig: "Überfällig",
};

const MILESTONE_TYPE_LABEL: Record<string, string> = {
  antrag: "Antrag",
  genehmigung: "Genehmigung",
  zwischenbericht: "Zwischenbericht",
  review: "Review",
  abschluss: "Abschluss",
  sonstiges: "Sonstiges",
  projekt: "Projekt-Meilenstein",
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("de-DE") : "—";
}

export default function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const portfolioId = id!;
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const { hasPermission } = usePermissions();
  const canManageStructure = useCanManagePortfolio();
  const isMaster = role === "master";
  const canEdit = isMaster || hasPermission("portfolios.edit" as any);
  const canAssign = isMaster || hasPermission("portfolios.assign_projects" as any);
  const canRemove = isMaster || hasPermission("portfolios.remove_projects" as any);
  const canDelete = isMaster || hasPermission("portfolios.delete" as any);

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ["portfolio", portfolioId, user?.id ?? "anon"],
    queryFn: () => api.projectPortfolios.get(portfolioId),
    enabled: !!user && !!portfolioId,
  });

  const { data: members = [] } = useQuery<any[]>({
    queryKey: ["portfolio-members", portfolioId, user?.id ?? "anon"],
    queryFn: () => api.portfolioMembers.listForPortfolio(portfolioId) as any,
    enabled: !!user && !!portfolioId,
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ["projects", "for-portfolio-select", user?.id ?? "anon"],
    queryFn: () => api.projects.list(),
    enabled: !!user,
  });

  const { data: milestoneTimeline = [] } = useQuery<any[]>({
    queryKey: ["portfolio-milestone-timeline", portfolioId, user?.id ?? "anon"],
    queryFn: () => api.portfolioMilestones.timeline(portfolioId) as any,
    enabled: !!user && !!portfolioId,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<any>({});
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [projectToAdd, setProjectToAdd] = useState<string>("");
  const [contributionGoal, setContributionGoal] = useState("");

  const openEdit = () => {
    if (!portfolio) return;
    setEditDraft({
      name: portfolio.name, short_code: portfolio.short_code ?? "",
      category: portfolio.category ?? "", funding_program: portfolio.funding_program ?? "",
      funding_body: portfolio.funding_body ?? "", description: portfolio.description ?? "",
      start_date: portfolio.start_date ?? "", end_date: portfolio.end_date ?? "",
      status: portfolio.status,
      planned_budget: portfolio.planned_budget ?? "",
      approved_budget: portfolio.approved_budget ?? "",
      notes: portfolio.notes ?? "",
    });
    setEditOpen(true);
  };

  const updateMut = useMutation({
    mutationFn: () => api.projectPortfolios.update(portfolioId, {
      ...editDraft,
      planned_budget: editDraft.planned_budget === "" ? null : Number(editDraft.planned_budget),
      approved_budget: editDraft.approved_budget === "" ? null : Number(editDraft.approved_budget),
      short_code: editDraft.short_code || null,
      category: editDraft.category || null,
      funding_program: editDraft.funding_program || null,
      funding_body: editDraft.funding_body || null,
      description: editDraft.description || null,
      start_date: editDraft.start_date || null,
      end_date: editDraft.end_date || null,
      notes: editDraft.notes || null,
    }),
    onSuccess: () => {
      toast.success("Gespeichert");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["portfolio", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolios"] });
    },
    onError: (e: any) => toast.error(e?.message || "Fehler"),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.projectPortfolios.delete(portfolioId),
    onSuccess: () => {
      toast.success("Portfolio gelöscht");
      window.location.assign("/portfolios");
    },
    onError: (e: any) => toast.error(e?.message || "Fehler beim Löschen"),
  });

  const addMemberMut = useMutation({
    mutationFn: () => api.portfolioMembers.add({
      portfolio_id: portfolioId,
      project_id: projectToAdd,
      contribution_goal: contributionGoal || undefined,
    }),
    onSuccess: () => {
      toast.success("Projekt hinzugefügt");
      setAddProjectOpen(false);
      setProjectToAdd("");
      setContributionGoal("");
      qc.invalidateQueries({ queryKey: ["portfolio-members", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolio-members-all"] });
      qc.invalidateQueries({ queryKey: ["portfolio-milestone-timeline", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolio-dashboard", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolio-analytics", portfolioId] });
    },
    onError: (e: any) => toast.error(e?.message || "Fehler"),
  });

  const removeMemberMut = useMutation({
    mutationFn: (id: string) => api.portfolioMembers.remove(id),
    onSuccess: () => {
      toast.success("Projekt entfernt");
      qc.invalidateQueries({ queryKey: ["portfolio-members", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolio-members-all"] });
      qc.invalidateQueries({ queryKey: ["portfolio-milestone-timeline", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolio-dashboard", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolio-analytics", portfolioId] });
    },
    onError: (e: any) => toast.error(e?.message || "Fehler"),
  });

  const assignedProjectIds = useMemo(() => new Set(members.map((m: any) => m.project_id)), [members]);
  const availableProjects = useMemo(
    () => (allProjects as any[]).filter((p) => !assignedProjectIds.has(p.id)),
    [allProjects, assignedProjectIds]
  );

  const [milestoneDraft, setMilestoneDraft] = useState({
    title: "", milestone_type: "sonstiges" as const, due_date: "",
  });
  const createMilestoneMut = useMutation({
    mutationFn: () => api.portfolioMilestones.create({
      portfolio_id: portfolioId,
      title: milestoneDraft.title.trim(),
      milestone_type: milestoneDraft.milestone_type,
      due_date: milestoneDraft.due_date || null,
    }),
    onSuccess: () => {
      toast.success("Meilenstein hinzugefügt");
      setMilestoneDraft({ title: "", milestone_type: "sonstiges", due_date: "" });
      qc.invalidateQueries({ queryKey: ["portfolio-milestones", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolio-milestone-timeline", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolio-dashboard", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolio-analytics", portfolioId] });
    },
    onError: (e: any) => toast.error(e?.message || "Fehler"),
  });

  const setMilestoneStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.portfolioMilestones.update(id, {
        status,
        completed_at: status === "erledigt" ? new Date().toISOString() : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio-milestones", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolio-milestone-timeline", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolio-dashboard", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolio-analytics", portfolioId] });
    },
  });

  const removeMilestoneMut = useMutation({
    mutationFn: (id: string) => api.portfolioMilestones.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio-milestones", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolio-milestone-timeline", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolio-dashboard", portfolioId] });
      qc.invalidateQueries({ queryKey: ["portfolio-analytics", portfolioId] });
    },
  });

  const sortedTimeline = useMemo(
    () => [...milestoneTimeline].sort((a: any, b: any) => {
      const aDate = a.sort_date || a.milestone_date || "9999-12-31";
      const bDate = b.sort_date || b.milestone_date || "9999-12-31";
      return aDate.localeCompare(bDate) || String(a.title ?? "").localeCompare(String(b.title ?? ""));
    }),
    [milestoneTimeline]
  );

  if (isLoading || !portfolio) {
    return <div className="p-6 text-sm text-muted-foreground">Lade …</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link to="/portfolios" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Zurück zur Übersicht
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Briefcase className="h-7 w-7 text-primary mt-1" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{portfolio.name}</h1>
              {portfolio.short_code && <Badge variant="outline">{portfolio.short_code}</Badge>}
              <Badge>{STATUS_LABEL[portfolio.status]}</Badge>
              <span
                title={`Ampelstatus: ${portfolio.traffic_light ?? "green"}`}
                className={`inline-block h-3 w-3 rounded-full ${
                  portfolio.traffic_light === "red" ? "bg-red-500"
                    : portfolio.traffic_light === "yellow" ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
              />
            </div>
            {portfolio.description && (
              <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{portfolio.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="h-4 w-4 mr-2" /> Bearbeiten
            </Button>
          )}
          {canDelete && (
            <Button variant="outline" size="sm" onClick={() => {
              if (confirm("Portfolio wirklich löschen? Alle Zuordnungen, Meilensteine und Dokumente gehen verloren.")) deleteMut.mutate();
            }}>
              <Trash2 className="h-4 w-4 mr-2" /> Löschen
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Stammdaten</TabsTrigger>
          <TabsTrigger value="structure">Struktur (APs &amp; Tasks)</TabsTrigger>
          <TabsTrigger value="projects">Projekte ({members.length})</TabsTrigger>
          <TabsTrigger value="milestones">Meilensteine ({milestoneTimeline.length})</TabsTrigger>
          <TabsTrigger value="documents">Dokumente</TabsTrigger>
          <TabsTrigger value="analytics">Auswertungen</TabsTrigger>
          <TabsTrigger value="mapping">Förder-Zuordnungen</TabsTrigger>
          <TabsTrigger value="ffg">FFG-Bericht</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard &amp; KPIs</TabsTrigger>
          <TabsTrigger value="controlling">Controlling</TabsTrigger>
          {canManageStructure && <TabsTrigger value="time">Zeiterfassung</TabsTrigger>}
        </TabsList>

        <TabsContent value="structure" className="mt-4">
          <PortfolioStructureTab portfolioId={portfolioId} canManage={canManageStructure} />
        </TabsContent>

        <TabsContent value="mapping" className="mt-4">
          <PortfolioFundingMappingTab portfolioId={portfolioId} />
        </TabsContent>

        <TabsContent value="ffg" className="mt-4">
          <PortfolioFfgReportTab portfolioId={portfolioId} portfolioName={portfolio.name} />
        </TabsContent>

        {canManageStructure && (
          <TabsContent value="time" className="mt-4">
            <PortfolioTimeEntries portfolioId={portfolioId} />
          </TabsContent>
        )}




        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="pt-6 grid grid-cols-2 gap-6 text-sm">
              <Field label="Kategorie" value={portfolio.category} />
              <Field label="Status" value={STATUS_LABEL[portfolio.status]} />
              <Field label="Förderprogramm" value={portfolio.funding_program} />
              <Field label="Fördergeber" value={portfolio.funding_body} />
              <Field label="Start" value={portfolio.start_date} />
              <Field label="Ende" value={portfolio.end_date} />
              <Field label="Geplantes Budget" value={portfolio.planned_budget != null ? `${formatCurrency(portfolio.planned_budget)} €` : null} />
              <Field label="Bewilligtes Budget" value={portfolio.approved_budget != null ? `${formatCurrency(portfolio.approved_budget)} €` : null} />
              <div className="col-span-2">
                <Field label="Notizen" value={portfolio.notes} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="mt-4 space-y-4">
          {canAssign && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setAddProjectOpen(true)}>
                <FolderPlus className="h-4 w-4 mr-2" /> Projekt zuordnen
              </Button>
            </div>
          )}
          <Card>
            <CardContent className="pt-6">
              {members.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Noch keine Projekte zugeordnet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Projekt-Nr.</TableHead>
                      <TableHead>Projektname</TableHead>
                      <TableHead>Beitrag zum Portfolio</TableHead>
                      <TableHead>Status</TableHead>
                      {canRemove && <TableHead className="w-10"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono">
                          <Link to={`/projekte/${m.project_id}`} className="text-primary hover:underline">
                            {m.projects?.project_number ?? "—"}
                          </Link>
                        </TableCell>
                        <TableCell>{m.projects?.project_name ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.contribution_goal ?? "—"}</TableCell>
                        <TableCell><Badge variant="outline">{m.projects?.project_status ?? "—"}</Badge></TableCell>
                        {canRemove && (
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => {
                              if (confirm("Projekt aus Portfolio entfernen?")) removeMemberMut.mutate(m.id);
                            }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="milestones" className="mt-4 space-y-4">
          {canEdit && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Neuer Portfolio-Meilenstein</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-4 gap-3">
                <div className="col-span-2">
                  <Label>Titel</Label>
                  <Input value={milestoneDraft.title} onChange={(e) => setMilestoneDraft({ ...milestoneDraft, title: e.target.value })} />
                </div>
                <div>
                  <Label>Typ</Label>
                  <Select value={milestoneDraft.milestone_type} onValueChange={(v) => setMilestoneDraft({ ...milestoneDraft, milestone_type: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="antrag">Antrag</SelectItem>
                      <SelectItem value="genehmigung">Genehmigung</SelectItem>
                      <SelectItem value="zwischenbericht">Zwischenbericht</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                      <SelectItem value="abschluss">Abschluss</SelectItem>
                      <SelectItem value="sonstiges">Sonstiges</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fällig am</Label>
                  <Input type="date" value={milestoneDraft.due_date} onChange={(e) => setMilestoneDraft({ ...milestoneDraft, due_date: e.target.value })} />
                </div>
                <div className="col-span-4 flex justify-end">
                  <Button size="sm" disabled={!milestoneDraft.title.trim() || createMilestoneMut.isPending} onClick={() => createMilestoneMut.mutate()}>
                    <Plus className="h-4 w-4 mr-2" /> Hinzufügen
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4" /> Gemeinsame Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {sortedTimeline.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Noch keine Meilensteine in Portfolio oder zugeordneten Projekten vorhanden.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Termin</TableHead>
                      <TableHead>Ebene</TableHead>
                      <TableHead>Titel</TableHead>
                      <TableHead>Projekt</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-32"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTimeline.map((m: any) => (
                      <TableRow key={`${m.source}-${m.id}`}>
                        <TableCell>{formatDate(m.milestone_date)}</TableCell>
                        <TableCell>
                          <Badge variant={m.source === "portfolio" ? "default" : "outline"}>
                            {m.source === "portfolio" ? "Portfolio" : "Projekt"}
                          </Badge>
                        </TableCell>
                        <TableCell>{m.title}</TableCell>
                        <TableCell>
                          {m.project_id ? (
                            <Link to={`/projekte/${m.project_id}`} className="text-primary hover:underline">
                              <span className="font-mono">{m.project_number}</span> {m.project_name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell><Badge variant="outline">{MILESTONE_TYPE_LABEL[m.milestone_type] ?? m.milestone_type}</Badge></TableCell>
                        <TableCell>
                          {m.source === "portfolio" ? (
                            <Select value={m.status} disabled={!canEdit} onValueChange={(v) => setMilestoneStatusMut.mutate({ id: m.id, status: v })}>
                              <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="offen">Offen</SelectItem>
                                <SelectItem value="erledigt">Erledigt</SelectItem>
                                <SelectItem value="ueberfaellig">Überfällig</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline">{MILESTONE_STATUS_LABEL[m.status] ?? m.status}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {canEdit && m.source === "portfolio" && (
                            <Button size="icon" variant="ghost" onClick={() => {
                              if (confirm("Meilenstein löschen?")) removeMilestoneMut.mutate(m.id);
                            }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <PortfolioDocumentsTab portfolioId={portfolioId} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <PortfolioAnalyticsTab portfolioId={portfolioId} />
        </TabsContent>

        <TabsContent value="dashboard" className="mt-4">
          <PortfolioDashboardTab portfolioId={portfolioId} portfolio={portfolio} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="controlling" className="mt-4">
          <PortfolioControllingTab portfolioId={portfolioId} portfolioName={portfolio?.name} />
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Portfolio bearbeiten</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Name *</Label>
              <Input value={editDraft.name ?? ""} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} />
            </div>
            <div>
              <Label>Kürzel</Label>
              <Input value={editDraft.short_code ?? ""} onChange={(e) => setEditDraft({ ...editDraft, short_code: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editDraft.status} onValueChange={(v) => setEditDraft({ ...editDraft, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Kategorie</Label>
              <Input value={editDraft.category ?? ""} onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })} />
            </div>
            <div>
              <Label>Förderprogramm</Label>
              <Input value={editDraft.funding_program ?? ""} onChange={(e) => setEditDraft({ ...editDraft, funding_program: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Fördergeber</Label>
              <Input value={editDraft.funding_body ?? ""} onChange={(e) => setEditDraft({ ...editDraft, funding_body: e.target.value })} />
            </div>
            <div>
              <Label>Start</Label>
              <Input type="date" value={editDraft.start_date ?? ""} onChange={(e) => setEditDraft({ ...editDraft, start_date: e.target.value })} />
            </div>
            <div>
              <Label>Ende</Label>
              <Input type="date" value={editDraft.end_date ?? ""} onChange={(e) => setEditDraft({ ...editDraft, end_date: e.target.value })} />
            </div>
            <div>
              <Label>Geplantes Budget (€)</Label>
              <CurrencyInput value={editDraft.planned_budget ?? ""} onChange={(raw) => setEditDraft({ ...editDraft, planned_budget: raw })} />
            </div>
            <div>
              <Label>Bewilligtes Budget (€)</Label>
              <CurrencyInput value={editDraft.approved_budget ?? ""} onChange={(raw) => setEditDraft({ ...editDraft, approved_budget: raw })} />
            </div>
            <div className="col-span-2">
              <Label>Beschreibung</Label>
              <Textarea rows={3} value={editDraft.description ?? ""} onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Notizen</Label>
              <Textarea rows={2} value={editDraft.notes ?? ""} onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}><X className="h-4 w-4 mr-2" />Abbrechen</Button>
            <Button onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
              <Save className="h-4 w-4 mr-2" /> Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add project dialog */}
      <Dialog open={addProjectOpen} onOpenChange={setAddProjectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Projekt zum Portfolio hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Projekt</Label>
              <Select value={projectToAdd} onValueChange={setProjectToAdd}>
                <SelectTrigger><SelectValue placeholder="Projekt auswählen" /></SelectTrigger>
                <SelectContent>
                  {availableProjects.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.project_number} — {p.project_name ?? "(ohne Namen)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Beitrag / Zielsetzung im Portfolio (optional)</Label>
              <Textarea rows={3} value={contributionGoal} onChange={(e) => setContributionGoal(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddProjectOpen(false)}>Abbrechen</Button>
            <Button onClick={() => addMemberMut.mutate()} disabled={!projectToAdd || addMemberMut.isPending}>
              Hinzufügen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value ?? <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}
