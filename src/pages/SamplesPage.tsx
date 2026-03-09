import { useSamples, useCreateSample, useDeleteSample } from "@/hooks/useSamples";
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
import { Search, Plus, Trash2, AlertTriangle, Eye } from "lucide-react";
import { SampleScannerInput } from "@/components/SampleScanner";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

const HAZARD_CATEGORIES = [
  "gesundheitsschaedlich",
  "toxisch",
  "reizend",
  "aetzend",
  "entzuendlich",
  "umweltgefaehrlich",
  "sonstiges",
] as const;

const DISPOSAL_CATEGORIES = ["laborabfall", "gefahrstoff", "sondermuell"] as const;

function formatLocation(loc: any) {
  if (!loc) return "–";
  return [loc.hall, loc.room, loc.shelf, loc.position].filter(Boolean).join(" › ");
}

export default function SamplesPage() {
  const { t } = useTranslation("samples");
  const { data: samples = [], isLoading } = useSamples();
  const { data: projects = [] } = useProjects();
  const { data: locations = [] } = useStorageLocations();
  const { user, role } = useAuth();
  const createSample = useCreateSample();
  const deleteSample = useDeleteSample();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    sample_name: "",
    project_id: "",
    description: "",
    post_measurement_action: "" as string,
    post_measurement_action_text: "",
    storage_min_duration: "",
    storage_hints: "",
    storage_expiry_date: "",
    disposal_method: "",
    disposal_hints: "",
    disposal_category: "",
    hazard_categories: [] as string[],
    is_hazardous: false,
    location_id: "",
  });

  const canCreate = role === "master" || role === "auftraggeber" || role === "durchfuehrer";

  const filtered = samples.filter(s =>
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
      toast.error(t("all_required"));
      return;
    }
    try {
      await createSample.mutateAsync({
        sample_name: form.sample_name.trim(),
        project_id: form.project_id,
        description: form.description.trim(),
        created_by: user!.id,
        post_measurement_action: form.post_measurement_action || undefined,
        post_measurement_action_text: form.post_measurement_action_text || undefined,
        storage_min_duration: form.storage_min_duration || undefined,
        storage_hints: form.storage_hints || undefined,
        storage_expiry_date: form.storage_expiry_date || undefined,
        disposal_method: form.disposal_method || undefined,
        disposal_hints: form.disposal_hints || undefined,
        disposal_category: form.disposal_category || undefined,
        hazard_categories: form.hazard_categories,
        is_hazardous: form.is_hazardous,
        location_id: form.location_id || undefined,
      });
      toast.success(t("created"));
      resetForm();
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || t("create_error"));
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      neu: "bg-blue-100 text-blue-800",
      eingelagert: "bg-green-100 text-green-800",
      in_bearbeitung: "bg-yellow-100 text-yellow-800",
      teilweise_verbraucht: "bg-orange-100 text-orange-800",
      vollstaendig_verbraucht: "bg-red-100 text-red-800",
      entsorgt: "bg-gray-100 text-gray-800",
      zurueckgesendet: "bg-purple-100 text-purple-800",
    };
    return (
      <Badge variant="outline" className={colors[status] || ""}>
        {t(`status_${status}`)}
      </Badge>
    );
  };

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
                {/* Basic fields */}
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

                {/* Post measurement action */}
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
                  <div className="space-y-2">
                    <Input value={form.post_measurement_action_text} onChange={e => setForm(f => ({ ...f, post_measurement_action_text: e.target.value }))} placeholder={t("post_action_text_placeholder")} />
                  </div>
                )}

                {/* Storage fields */}
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

                {/* Disposal fields */}
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
                          {DISPOSAL_CATEGORIES.map(c => (
                            <SelectItem key={c} value={c}>{t(`disposal_${c}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Location */}
                <div className="space-y-2">
                  <Label>{t("location_section")}</Label>
                  <Select value={form.location_id || "__none__"} onValueChange={v => setForm(f => ({ ...f, location_id: v === "__none__" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder={t("select_location")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("no_location")}</SelectItem>
                      {locations.map(l => (
                        <SelectItem key={l.id} value={l.id}>{formatLocation(l)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Hazard */}
                <div className="space-y-3 rounded-md border p-3">
                  <Label className="font-semibold">{t("hazard_section")}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {HAZARD_CATEGORIES.map(cat => (
                      <div key={cat} className="flex items-center space-x-2">
                        <Checkbox
                          checked={form.hazard_categories.includes(cat)}
                          onCheckedChange={() => toggleHazard(cat)}
                        />
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

      <div className="flex flex-wrap gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("search_placeholder")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <SampleScannerInput />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("sample_number")}</TableHead>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("project")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("location")}</TableHead>
                <TableHead>{t("hazardous")}</TableHead>
                <TableHead>{t("created_at")}</TableHead>
                <TableHead className="w-24">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">{t("loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("no_samples")}</TableCell></TableRow>
              ) : (
                filtered.map(s => {
                  const project = (s as any).projects;
                  const location = (s as any).storage_locations;
                  const canDelete = role === "master" || s.created_by === user?.id;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.sample_number}</TableCell>
                      <TableCell>{s.sample_name}</TableCell>
                      <TableCell>{project?.project_number || "–"}</TableCell>
                      <TableCell>{getStatusBadge((s as any).status || "neu")}</TableCell>
                      <TableCell className="text-sm">{formatLocation(location)}</TableCell>
                      <TableCell>
                        {(s as any).is_hazardous ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {t("hazard_yes")}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">{t("hazard_no")}</span>
                        )}
                      </TableCell>
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
                                  >
                                    {t("delete")}
                                  </AlertDialogAction>
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
