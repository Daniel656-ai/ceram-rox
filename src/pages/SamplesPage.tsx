import { useSamples, useCreateSample, useDeleteSample } from "@/hooks/useSamples";
import { useEstimatedCompletion } from "@/hooks/useEstimatedCompletion";
import { useProjects } from "@/hooks/useProjects";
import { useStorageLocations } from "@/hooks/useRawMaterials";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Trash2, AlertTriangle, Eye, Inbox, FlaskConical, Clock, Archive, Timer, ShieldAlert, CalendarClock } from "lucide-react";
import { SampleScannerInput } from "@/components/SampleScanner";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

const HAZARD_CATEGORIES = [
  "gesundheitsschaedlich", "toxisch", "reizend", "aetzend", "entzuendlich", "umweltgefaehrlich", "sonstiges",
] as const;

const DISPOSAL_CATEGORIES = ["laborabfall", "gefahrstoff", "sondermuell"] as const;

function formatLocation(loc: any) {
  if (!loc) return "–";
  return [loc.hall, loc.room, loc.shelf, loc.position].filter(Boolean).join(" › ");
}

type SubCategory = "all" | "eingang" | "in_bearbeitung" | "wartend" | "eingelagert" | "kritisch" | "gefahrstoff";

function getDaysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const diff = new Date(expiryDate).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function SamplesPage() {
  const { t } = useTranslation("samples");
  const { data: samples = [], isLoading } = useSamples();
  const { data: projects = [] } = useProjects();
  const { data: locations = [] } = useStorageLocations();
  const { user, role } = useAuth();
  const createSample = useCreateSample();
  const deleteSample = useDeleteSample();
  const etaMap = useEstimatedCompletion();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SubCategory>("all");
  const [form, setForm] = useState({
    sample_name: "", project_id: "", description: "",
    post_measurement_action: "" as string, post_measurement_action_text: "",
    storage_min_duration: "", storage_hints: "", storage_expiry_date: "",
    disposal_method: "", disposal_hints: "", disposal_category: "",
    hazard_categories: [] as string[], is_hazardous: false, location_id: "",
  });

  const canCreate = role === "master" || role === "auftraggeber" || role === "durchfuehrer";

  // Categorize samples
  const categorized = useMemo(() => {
    const all = samples as any[];
    const eingang = all.filter(s => s.status === "neu");
    const in_bearbeitung = all.filter(s => s.status === "in_bearbeitung");
    const wartend = all.filter(s => s.status === "teilweise_verbraucht");
    const eingelagert = all.filter(s => s.status === "eingelagert");
    const kritisch = all.filter(s => {
      const days = getDaysUntilExpiry(s.storage_expiry_date);
      return days !== null && days <= 30 && days >= 0 && s.status === "eingelagert";
    });
    const gefahrstoff = all.filter(s => s.is_hazardous);
    return { all, eingang, in_bearbeitung, wartend, eingelagert, kritisch, gefahrstoff };
  }, [samples]);

  const currentList = categorized[activeTab] || categorized.all;

  const filtered = currentList.filter((s: any) =>
    !search ||
    s.sample_number.toLowerCase().includes(search.toLowerCase()) ||
    s.sample_name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleHazard = (cat: string) => {
    setForm(f => {
      const cats = f.hazard_categories.includes(cat)
        ? f.hazard_categories.filter(c => c !== cat)
        : [...f.hazard_categories, cat];
      return { ...f, hazard_categories: cats, is_hazardous: cats.length > 0 };
    });
  };

  const resetForm = () => setForm({
    sample_name: "", project_id: "", description: "",
    post_measurement_action: "", post_measurement_action_text: "",
    storage_min_duration: "", storage_hints: "", storage_expiry_date: "",
    disposal_method: "", disposal_hints: "", disposal_category: "",
    hazard_categories: [], is_hazardous: false, location_id: "",
  });

  const handleCreate = async () => {
    if (!form.sample_name.trim() || !form.project_id || !form.description.trim() || !form.post_measurement_action) {
      toast.error(t("all_required")); return;
    }
    try {
      await createSample.mutateAsync({
        sample_name: form.sample_name.trim(), project_id: form.project_id,
        description: form.description.trim(), created_by: user!.id,
        post_measurement_action: form.post_measurement_action || undefined,
        post_measurement_action_text: form.post_measurement_action_text || undefined,
        storage_min_duration: form.storage_min_duration || undefined,
        storage_hints: form.storage_hints || undefined,
        storage_expiry_date: form.storage_expiry_date || undefined,
        disposal_method: form.disposal_method || undefined,
        disposal_hints: form.disposal_hints || undefined,
        disposal_category: form.disposal_category || undefined,
        hazard_categories: form.hazard_categories, is_hazardous: form.is_hazardous,
        location_id: form.location_id || undefined,
      });
      toast.success(t("created")); resetForm(); setOpen(false);
    } catch (e: any) { toast.error(e.message || t("create_error")); }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      neu: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      eingelagert: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      in_bearbeitung: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      teilweise_verbraucht: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
      vollstaendig_verbraucht: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      entsorgt: "bg-muted text-muted-foreground",
      zurueckgesendet: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    };
    return <Badge variant="outline" className={colors[status] || ""}>{t(`status_${status}`)}</Badge>;
  };

  const tabItems: { value: SubCategory; icon: React.ReactNode; labelKey: string; count: number }[] = [
    { value: "all", icon: null, labelKey: "cat_all", count: categorized.all.length },
    { value: "eingang", icon: <Inbox className="h-3.5 w-3.5" />, labelKey: "cat_eingang", count: categorized.eingang.length },
    { value: "in_bearbeitung", icon: <FlaskConical className="h-3.5 w-3.5" />, labelKey: "cat_in_bearbeitung", count: categorized.in_bearbeitung.length },
    { value: "wartend", icon: <Clock className="h-3.5 w-3.5" />, labelKey: "cat_wartend", count: categorized.wartend.length },
    { value: "eingelagert", icon: <Archive className="h-3.5 w-3.5" />, labelKey: "cat_eingelagert", count: categorized.eingelagert.length },
    { value: "kritisch", icon: <Timer className="h-3.5 w-3.5" />, labelKey: "cat_kritisch", count: categorized.kritisch.length },
    { value: "gefahrstoff", icon: <ShieldAlert className="h-3.5 w-3.5" />, labelKey: "cat_gefahrstoff", count: categorized.gefahrstoff.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />{t("new_sample")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{t("create_title")}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("sample_name_required")}</Label>
                    <Input value={form.sample_name} onChange={e => setForm(f => ({ ...f, sample_name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("project_number")}</Label>
                    <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v }))}>
                      <SelectTrigger><SelectValue placeholder={t("select_project")} /></SelectTrigger>
                      <SelectContent>
                        {projects.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.project_number}{p.project_name ? ` – ${p.project_name}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("description")}</Label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={t("description_placeholder")} rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>{t("post_measurement")}</Label>
                  <Select value={form.post_measurement_action} onValueChange={v => setForm(f => ({ ...f, post_measurement_action: v }))}>
                    <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aufbewahren">{t("post_aufbewahren")}</SelectItem>
                      <SelectItem value="entsorgen">{t("post_entsorgen")}</SelectItem>
                      <SelectItem value="zurueck">{t("post_zurueck")}</SelectItem>
                      <SelectItem value="andere">{t("post_andere")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.post_measurement_action === "andere" && (
                  <Input value={form.post_measurement_action_text} onChange={e => setForm(f => ({ ...f, post_measurement_action_text: e.target.value }))} placeholder={t("post_action_text_placeholder")} />
                )}
                {form.post_measurement_action === "aufbewahren" && (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="space-y-2">
                      <Label>{t("storage_min_duration")}</Label>
                      <Input value={form.storage_min_duration} onChange={e => setForm(f => ({ ...f, storage_min_duration: e.target.value }))} placeholder={t("storage_min_duration_placeholder")} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("storage_hints")}</Label>
                      <Input value={form.storage_hints} onChange={e => setForm(f => ({ ...f, storage_hints: e.target.value }))} placeholder={t("storage_hints_placeholder")} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("storage_expiry_date")}</Label>
                      <Input type="date" value={form.storage_expiry_date} onChange={e => setForm(f => ({ ...f, storage_expiry_date: e.target.value }))} />
                    </div>
                  </div>
                )}
                {form.post_measurement_action === "entsorgen" && (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="space-y-2">
                      <Label>{t("disposal_method")}</Label>
                      <Input value={form.disposal_method} onChange={e => setForm(f => ({ ...f, disposal_method: e.target.value }))} placeholder={t("disposal_method_placeholder")} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("disposal_hints")}</Label>
                      <Input value={form.disposal_hints} onChange={e => setForm(f => ({ ...f, disposal_hints: e.target.value }))} placeholder={t("disposal_hints_placeholder")} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("disposal_category")}</Label>
                      <Select value={form.disposal_category} onValueChange={v => setForm(f => ({ ...f, disposal_category: v }))}>
                        <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent>
                          {DISPOSAL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{t(`disposal_${c}`)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{t("location_section")}</Label>
                  <Select value={form.location_id || "__none__"} onValueChange={v => setForm(f => ({ ...f, location_id: v === "__none__" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder={t("select_location")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("no_location")}</SelectItem>
                      {locations.map(l => <SelectItem key={l.id} value={l.id}>{formatLocation(l)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3 rounded-md border p-3">
                  <Label className="font-semibold">{t("hazard_section")}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {HAZARD_CATEGORIES.map(cat => (
                      <div key={cat} className="flex items-center space-x-2">
                        <Checkbox checked={form.hazard_categories.includes(cat)} onCheckedChange={() => toggleHazard(cat)} />
                        <Label className="text-sm font-normal">{t(`hazard_${cat}`)}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t("auto_number")}</p>
                <Button className="w-full" onClick={handleCreate} disabled={createSample.isPending}>
                  {createSample.isPending ? t("creating") : t("create_sample")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Subcategory Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SubCategory)}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {tabItems.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 text-xs sm:text-sm">
              {tab.icon}
              {t(tab.labelKey)}
              <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px]">
                {tab.count}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Search + Scanner */}
      <div className="flex flex-wrap gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("search_placeholder")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <SampleScannerInput />
      </div>

      {/* Critical storage warning */}
      {activeTab === "kritisch" && categorized.kritisch.length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 flex items-center gap-2 text-sm text-destructive">
          <Timer className="h-4 w-4 shrink-0" />
          <span>{t("cat_kritisch_warning", { count: categorized.kritisch.length })}</span>
        </div>
      )}

      {/* Hazard warning */}
      {activeTab === "gefahrstoff" && categorized.gefahrstoff.length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 flex items-center gap-2 text-sm text-destructive">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{t("cat_gefahrstoff_warning", { count: categorized.gefahrstoff.length })}</span>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("sample_number")}</TableHead>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("project")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("eta_short")}</TableHead>
                <TableHead>{t("location")}</TableHead>
                <TableHead>{t("hazardous")}</TableHead>
                {activeTab === "kritisch" && <TableHead>{t("expiry_remaining")}</TableHead>}
                <TableHead>{t("created_at")}</TableHead>
                <TableHead className="w-24">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={activeTab === "kritisch" ? 9 : 8} className="text-center py-8">{t("loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={activeTab === "kritisch" ? 9 : 8} className="text-center py-8 text-muted-foreground">{t("no_samples")}</TableCell></TableRow>
              ) : (
                filtered.map((s: any) => {
                  const project = s.projects;
                  const location = s.storage_locations;
                  const canDelete = role === "master" || s.created_by === user?.id;
                  const daysLeft = getDaysUntilExpiry(s.storage_expiry_date);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.sample_number}</TableCell>
                      <TableCell>{s.sample_name}</TableCell>
                      <TableCell>{project?.project_number || "–"}</TableCell>
                      <TableCell>{getStatusBadge(s.status || "neu")}</TableCell>
                      <TableCell className="text-sm">{formatLocation(location)}</TableCell>
                      <TableCell>
                        {s.is_hazardous ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />{t("hazard_yes")}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">{t("hazard_no")}</span>
                        )}
                      </TableCell>
                      {activeTab === "kritisch" && (
                        <TableCell>
                          {daysLeft !== null && (
                            <Badge variant={daysLeft <= 7 ? "destructive" : "outline"} className="gap-1">
                              <Timer className="h-3 w-3" />
                              {daysLeft <= 0 ? t("expiry_overdue") : t("expiry_days", { count: daysLeft })}
                            </Badge>
                          )}
                        </TableCell>
                      )}
                      <TableCell>{new Date(s.created_at).toLocaleDateString("de-DE")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/proben/${s.id}`}><Eye className="h-4 w-4" /></Link>
                          </Button>
                          {canCreate && canDelete && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t("delete_title")}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t("delete_description_prefix")}{s.sample_number}{t("delete_description_suffix")}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={async () => {
                                      try {
                                        await deleteSample.mutateAsync(s.id);
                                        toast.success(t("deleted"));
                                      } catch (e: any) {
                                        toast.error(e.message || t("delete_error"));
                                      }
                                    }}
                                  >{t("delete")}</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
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
