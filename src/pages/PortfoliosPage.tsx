import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Briefcase, Search, ArrowRight } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  planung: "In Planung",
  aktiv: "Aktiv",
  pausiert: "Pausiert",
  abgeschlossen: "Abgeschlossen",
  abgebrochen: "Abgebrochen",
};

const STATUS_COLOR: Record<string, string> = {
  planung: "bg-muted text-muted-foreground",
  aktiv: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  pausiert: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  abgeschlossen: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  abgebrochen: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

export default function PortfoliosPage() {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const { hasPermission } = usePermissions();
  const canCreate = role === "master" || hasPermission("portfolios.create" as any);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    short_code: "",
    category: "",
    funding_program: "",
    funding_body: "",
    description: "",
    start_date: "",
    end_date: "",
    status: "planung" as const,
    planned_budget: "",
    approved_budget: "",
  });

  const { data: portfolios = [], isLoading } = useQuery({
    queryKey: ["portfolios", user?.id ?? "anon"],
    queryFn: () => api.projectPortfolios.list(),
    enabled: !!user,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["portfolio-members-all", user?.id ?? "anon"],
    queryFn: async () => {
      const rows = await (api.from as any)("project_portfolio_members").select("portfolio_id, project_id");
      return rows.data ?? [];
    },
    enabled: !!user,
  });

  const membersByPortfolio = useMemo(() => {
    const map: Record<string, number> = {};
    members.forEach((m: any) => {
      map[m.portfolio_id] = (map[m.portfolio_id] ?? 0) + 1;
    });
    return map;
  }, [members]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return portfolios.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return [p.name, p.short_code, p.category, p.funding_program, p.funding_body]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [portfolios, search, statusFilter]);

  const createMut = useMutation({
    mutationFn: () =>
      api.projectPortfolios.create({
        name: draft.name.trim(),
        short_code: draft.short_code.trim() || null,
        category: draft.category.trim() || null,
        funding_program: draft.funding_program.trim() || null,
        funding_body: draft.funding_body.trim() || null,
        description: draft.description.trim() || null,
        start_date: draft.start_date || null,
        end_date: draft.end_date || null,
        status: draft.status,
        planned_budget: draft.planned_budget ? Number(draft.planned_budget) : null,
        approved_budget: draft.approved_budget ? Number(draft.approved_budget) : null,
      } as any),
    onSuccess: () => {
      toast.success("Portfolio angelegt");
      setOpen(false);
      setDraft({
        name: "", short_code: "", category: "", funding_program: "", funding_body: "",
        description: "", start_date: "", end_date: "", status: "planung",
        planned_budget: "", approved_budget: "",
      });
      qc.invalidateQueries({ queryKey: ["portfolios"] });
    },
    onError: (e: any) => toast.error(e?.message || "Fehler beim Anlegen"),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Briefcase className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Projektportfolio</h1>
            <p className="text-sm text-muted-foreground">
              Übergreifende Steuerung von Projekten, Förderprogrammen und strategischen Initiativen
            </p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Neues Portfolio
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Name, Kürzel, Programm, Träger …"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Lade …</p>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              Keine Portfolios vorhanden.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kürzel</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Förderprogramm</TableHead>
                  <TableHead>Laufzeit</TableHead>
                  <TableHead className="text-right">Projekte</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => window.location.assign(`/portfolios/${p.id}`)}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.short_code ?? "—"}</TableCell>
                    <TableCell>{p.category ?? "—"}</TableCell>
                    <TableCell>
                      {p.funding_program ? (
                        <div className="text-sm">
                          {p.funding_program}
                          {p.funding_body && (
                            <div className="text-xs text-muted-foreground">{p.funding_body}</div>
                          )}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.start_date || "—"} – {p.end_date || "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">{membersByPortfolio[p.id] ?? 0}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLOR[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link to={`/portfolios/${p.id}`}>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Neues Portfolio</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Name *</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <Label>Kürzel</Label>
              <Input value={draft.short_code} onChange={(e) => setDraft({ ...draft, short_code: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as any })}>
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
              <Input placeholder="F&E, Kundenprojekt, Interne Initiative …" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
            </div>
            <div>
              <Label>Förderprogramm</Label>
              <Input placeholder="z. B. FFG Basisprogramm" value={draft.funding_program} onChange={(e) => setDraft({ ...draft, funding_program: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Fördergeber</Label>
              <Input value={draft.funding_body} onChange={(e) => setDraft({ ...draft, funding_body: e.target.value })} />
            </div>
            <div>
              <Label>Start</Label>
              <Input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} />
            </div>
            <div>
              <Label>Ende</Label>
              <Input type="date" value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} />
            </div>
            <div>
              <Label>Geplantes Budget (€)</Label>
              <Input type="number" value={draft.planned_budget} onChange={(e) => setDraft({ ...draft, planned_budget: e.target.value })} />
            </div>
            <div>
              <Label>Bewilligtes Budget (€)</Label>
              <Input type="number" value={draft.approved_budget} onChange={(e) => setDraft({ ...draft, approved_budget: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Beschreibung</Label>
              <Textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={() => createMut.mutate()} disabled={!draft.name.trim() || createMut.isPending}>
              Anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
