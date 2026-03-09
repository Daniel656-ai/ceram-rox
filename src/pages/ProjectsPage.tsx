import { useProjectsWithStats } from "@/hooks/useProjectDetail";
import { useAuth } from "@/contexts/AuthContext";
import { useUsers } from "@/hooks/useUsers";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Trash2, ArrowUpDown, Package, FlaskConical, Clock, DollarSign } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCreateProject, useDeleteProject } from "@/hooks/useProjects";

type SortOption = "created_desc" | "created_asc" | "name" | "samples" | "costs";

export default function ProjectsPage() {
  const { t } = useTranslation("projects");
  const { data: projects = [], isLoading } = useProjectsWithStats();
  const { data: users = [] } = useUsers();
  const { user, role } = useAuth();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("created_desc");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ project_number: "", project_name: "", description: "" });

  const getUserName = (userId: string) => {
    const u = (users as any[]).find((u: any) => u.user_id === userId);
    return u ? `${u.first_name} ${u.last_name}`.trim() || "–" : "–";
  };

  const filtered = useMemo(() => {
    let result = [...projects];
    const q = search.toLowerCase().trim();

    if (q) {
      result = result.filter(p =>
        p.project_number.toLowerCase().includes(q) ||
        (p.project_name || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        getUserName(p.created_by).toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "created_asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "created_desc": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "name": return (a.project_name || a.project_number).localeCompare(b.project_name || b.project_number);
        case "samples": return (b.stats?.sampleCount || 0) - (a.stats?.sampleCount || 0);
        case "costs": return (b.stats?.totalCost || 0) - (a.stats?.totalCost || 0);
        default: return 0;
      }
    });

    return result;
  }, [projects, search, sortBy, users]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        {(role === "master" || role === "auftraggeber") && (
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

      {/* Search & Sort */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("search_placeholder")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-48">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_desc">{t("sort_created_desc")}</SelectItem>
            <SelectItem value="created_asc">{t("sort_created_asc")}</SelectItem>
            <SelectItem value="name">{t("sort_name")}</SelectItem>
            <SelectItem value="samples">{t("sort_samples")}</SelectItem>
            <SelectItem value="costs">{t("sort_costs")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("project_number")}</TableHead>
                <TableHead>{t("project_name")}</TableHead>
                <TableHead>{t("creator")}</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1"><Package className="h-3.5 w-3.5" />{t("samples")}</div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1"><FlaskConical className="h-3.5 w-3.5" />{t("measurements")}</div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1"><Clock className="h-3.5 w-3.5" />{t("hours")}</div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1"><DollarSign className="h-3.5 w-3.5" />{t("costs")}</div>
                </TableHead>
                <TableHead>{t("created_at")}</TableHead>
                {role === "master" && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8">{t("loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">{t("no_projects")}</TableCell></TableRow>
              ) : (
                filtered.map(p => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <Link to={`/projekte/${p.id}`} className="text-primary hover:underline">{p.project_number}</Link>
                    </TableCell>
                    <TableCell>
                      <Link to={`/projekte/${p.id}`} className="hover:underline">{p.project_name || "–"}</Link>
                    </TableCell>
                    <TableCell>{getUserName(p.created_by)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{p.stats.sampleCount}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{p.stats.measurementCount}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {p.stats.totalHours > 0 ? `${p.stats.totalHours.toFixed(1)}h` : "–"}
                    </TableCell>
                    <TableCell className="text-center">
                      {p.stats.totalCost > 0 ? `${p.stats.totalCost.toFixed(0)}€` : "–"}
                    </TableCell>
                    <TableCell>{new Date(p.created_at).toLocaleDateString("de-DE")}</TableCell>
                    {role === "master" && (
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={e => e.stopPropagation()}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("delete_title")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("delete_description_prefix")}„{p.project_number}"{t("delete_description_suffix")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
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
                                Löschen
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
