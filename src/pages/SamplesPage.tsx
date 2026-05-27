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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Search, Plus, Trash2, AlertTriangle, Eye, Inbox, FlaskConical, Clock, Archive, Timer, ShieldAlert, CalendarClock, X, SlidersHorizontal, Tag, CopyPlus, CheckCircle2 } from "lucide-react";
import { SampleScannerInput } from "@/components/SampleScanner";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const HAZARD_CATEGORIES = [
  "gesundheitsschaedlich", "toxisch", "reizend", "aetzend", "entzuendlich", "umweltgefaehrlich", "sonstiges",
] as const;

const DISPOSAL_CATEGORIES = ["laborabfall", "gefahrstoff", "sondermuell"] as const;

function formatLocation(loc: any) {
  if (!loc) return "–";
  return [loc.hall, loc.room, loc.shelf, loc.position].filter(Boolean).join(" › ");
}

type SubCategory = "all" | "eingang" | "in_bearbeitung" | "wartend" | "eingelagert" | "kritisch" | "gefahrstoff";
type SortOption = "created_desc" | "created_asc" | "eta" | "priority" | "location" | "name";

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

  // Fetch measurement services for filter
  const { data: services = [] } = useQuery({
    queryKey: ["measurement-services-filter"],
    queryFn: async () => {
      const { data, error } = await api
        .from("measurement_services")
        .select("id, service_name")
        .eq("active", true)
        .order("service_name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch measurement orders with services for linking samples to measurement types
  const { data: sampleMeasurementTypes = new Map<string, string[]>() } = useQuery({
    queryKey: ["sample-measurement-types"],
    queryFn: async () => {
      const { data, error } = await api
        .from("measurement_orders")
        .select("sample_id, order_measurements(service_id, measurement_services:service_id(service_name))")
        .not("sample_id", "is", null);
      if (error) throw error;
      const map = new Map<string, string[]>();
      for (const order of (data || [])) {
        if (!order.sample_id) continue;
        const names = (order.order_measurements || [])
          .map((om: any) => om.measurement_services?.service_name)
          .filter(Boolean);
        const existing = map.get(order.sample_id) || [];
        map.set(order.sample_id, [...new Set([...existing, ...names])]);
      }
      return map;
    },
    enabled: !!user,
  });

  // Search & filter state
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterProject, setFilterProject] = useState<string>("__all__");
  const [filterService, setFilterService] = useState<string>("__all__");
  const [filterHazardous, setFilterHazardous] = useState<string>("__all__");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("created_desc");

  const [open, setOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"single" | "bulk">("single");
  const [activeTab, setActiveTab] = useState<SubCategory>("all");
  const [form, setForm] = useState({
    sample_name: "", project_id: "", description: "",
    post_measurement_action: "" as string, post_measurement_action_text: "",
    storage_min_duration: "", storage_hints: "", storage_expiry_date: "",
    disposal_method: "", disposal_hints: "", disposal_category: "",
    hazard_categories: [] as string[], is_hazardous: false, location_id: "",
    tags: [] as string[],
  });
  const [formTagInput, setFormTagInput] = useState("");

  // Bulk creation state
  const [bulkPrefix, setBulkPrefix] = useState("Probe_");
  const [bulkStartNum, setBulkStartNum] = useState(1);
  const [bulkEndNum, setBulkEndNum] = useState(10);
  const [bulkDescription, setBulkDescription] = useState("");
  const [bulkGroupName, setBulkGroupName] = useState("");
  const [bulkProjectId, setBulkProjectId] = useState("");
  const [isBulkCreating, setIsBulkCreating] = useState(false);
  const [bulkCreatedCount, setBulkCreatedCount] = useState<number | null>(null);
  const [bulkForm, setBulkForm] = useState({
    post_measurement_action: "" as string, post_measurement_action_text: "",
    storage_min_duration: "", storage_hints: "", storage_expiry_date: "",
    disposal_method: "", disposal_hints: "", disposal_category: "",
    hazard_categories: [] as string[], is_hazardous: false, location_id: "",
    tags: [] as string[],
  });
  const [bulkFormTagInput, setBulkFormTagInput] = useState("");

  const canCreate = role === "master" || role === "auftraggeber" || role === "durchfuehrer";

  const hasActiveFilters = filterProject !== "__all__" || filterService !== "__all__" || filterHazardous !== "__all__" || filterTags.length > 0;

  // Collect all unique tags across samples for autocomplete
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    (samples as any[]).forEach(s => {
      const tags = Array.isArray(s.tags) ? s.tags : [];
      tags.forEach((t: string) => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [samples]);

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

  // Apply all filters + search + sort
  const filtered = useMemo(() => {
    let result = [...currentList];
    const q = search.toLowerCase().trim();

    // Text search: sample_number, sample_name, description, tags
    if (q) {
      result = result.filter((s: any) => {
        const tags = Array.isArray(s.tags) ? s.tags : [];
        return (
          s.sample_number.toLowerCase().includes(q) ||
          s.sample_name.toLowerCase().includes(q) ||
          (s.description || "").toLowerCase().includes(q) ||
          tags.some((t: string) => t.toLowerCase().includes(q))
        );
      });
    }

    // Project filter
    if (filterProject !== "__all__") {
      result = result.filter((s: any) => s.project_id === filterProject);
    }

    // Measurement type filter
    if (filterService !== "__all__") {
      result = result.filter((s: any) => {
        const types = sampleMeasurementTypes.get(s.id) || [];
        return types.some(name => {
          const svc = services.find(sv => sv.service_name === name);
          return svc?.id === filterService;
        });
      });
    }

    // Hazardous filter
    if (filterHazardous === "yes") result = result.filter((s: any) => s.is_hazardous);
    if (filterHazardous === "no") result = result.filter((s: any) => !s.is_hazardous);

    // Tags filter
    if (filterTags.length > 0) {
      result = result.filter((s: any) => {
        const tags: string[] = Array.isArray(s.tags) ? s.tags : [];
        return filterTags.every(ft => tags.some(t => t.toLowerCase() === ft.toLowerCase()));
      });
    }

    // Sort
    result.sort((a: any, b: any) => {
      switch (sortBy) {
        case "created_asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "created_desc": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "name": return (a.sample_name || "").localeCompare(b.sample_name || "");
        case "location": return formatLocation(a.storage_locations).localeCompare(formatLocation(b.storage_locations));
        case "eta": {
          const etaA = etaMap.get(a.id)?.getTime() || Infinity;
          const etaB = etaMap.get(b.id)?.getTime() || Infinity;
          return etaA - etaB;
        }
        case "priority": {
          const etaA = etaMap.get(a.id)?.getTime() || Infinity;
          const etaB = etaMap.get(b.id)?.getTime() || Infinity;
          return etaA - etaB;
        }
        default: return 0;
      }
    });

    return result;
  }, [currentList, search, filterProject, filterService, filterHazardous, filterTags, sortBy, sampleMeasurementTypes, services, etaMap]);

  const toggleHazard = (cat: string) => {
    setForm(f => {
      const cats = f.hazard_categories.includes(cat)
        ? f.hazard_categories.filter(c => c !== cat)
        : [...f.hazard_categories, cat];
      return { ...f, hazard_categories: cats, is_hazardous: cats.length > 0 };
    });
  };

  const resetForm = () => {
    setForm({
      sample_name: "", project_id: "", description: "",
      post_measurement_action: "", post_measurement_action_text: "",
      storage_min_duration: "", storage_hints: "", storage_expiry_date: "",
      disposal_method: "", disposal_hints: "", disposal_category: "",
      hazard_categories: [], is_hazardous: false, location_id: "",
      tags: [],
    });
    setBulkPrefix("Probe_"); setBulkStartNum(1); setBulkEndNum(10);
    setBulkDescription(""); setBulkGroupName(""); setBulkProjectId("");
    setBulkCreatedCount(null); setCreateMode("single");
    setBulkForm({
      post_measurement_action: "", post_measurement_action_text: "",
      storage_min_duration: "", storage_hints: "", storage_expiry_date: "",
      disposal_method: "", disposal_hints: "", disposal_category: "",
      hazard_categories: [], is_hazardous: false, location_id: "",
      tags: [],
    });
    setBulkFormTagInput("");
  };

  const bulkCount = Math.max(0, bulkEndNum - bulkStartNum + 1);
  const bulkPadLength = Math.max(3, String(bulkEndNum).length);
  const bulkPreviewNames = Array.from({ length: Math.min(bulkCount, 5) }, (_, i) =>
    `${bulkPrefix}${String(bulkStartNum + i).padStart(bulkPadLength, "0")}`
  );

  const handleBulkCreate = async () => {
    if (!bulkProjectId || !bulkPrefix.trim() || bulkCount <= 0) {
      toast.error("Bitte Projekt, Präfix und gültigen Nummernbereich angeben");
      return;
    }
    if (bulkCount > 200) {
      toast.error("Maximal 200 Proben gleichzeitig");
      return;
    }
    setIsBulkCreating(true);
    try {
      const group = bulkGroupName || `bulk_${Date.now()}`;
      const samples = Array.from({ length: bulkCount }, (_, i) => ({
        sample_name: `${bulkPrefix}${String(bulkStartNum + i).padStart(bulkPadLength, "0")}`,
        sample_number: "WILL_BE_OVERWRITTEN",
        project_id: bulkProjectId,
        description: bulkDescription || `Serienprobe ${bulkPrefix}`,
        created_by: user!.id,
        sample_group: group,
        hazard_categories: bulkForm.hazard_categories,
        is_hazardous: bulkForm.is_hazardous,
        post_measurement_action: bulkForm.post_measurement_action || undefined,
        post_measurement_action_text: bulkForm.post_measurement_action_text || undefined,
        storage_min_duration: bulkForm.storage_min_duration || undefined,
        storage_hints: bulkForm.storage_hints || undefined,
        storage_expiry_date: bulkForm.storage_expiry_date || undefined,
        disposal_method: bulkForm.disposal_method || undefined,
        disposal_hints: bulkForm.disposal_hints || undefined,
        disposal_category: bulkForm.disposal_category || undefined,
        location_id: bulkForm.location_id || undefined,
        tags: bulkForm.tags,
      }));
      let total = 0;
      for (let i = 0; i < samples.length; i += 50) {
        const batch = samples.slice(i, i + 50);
        const { error } = await api.from("samples").insert(batch as any);
        if (error) throw error;
        total += batch.length;
      }
      setBulkCreatedCount(total);
      toast.success(`${total} Proben erstellt`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsBulkCreating(false);
    }
  };

  const toggleBulkHazard = (cat: string) => {
    setBulkForm(f => {
      const cats = f.hazard_categories.includes(cat)
        ? f.hazard_categories.filter(c => c !== cat)
        : [...f.hazard_categories, cat];
      return { ...f, hazard_categories: cats, is_hazardous: cats.length > 0 };
    });
  };

  const addBulkFormTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !bulkForm.tags.includes(trimmed)) {
      setBulkForm(f => ({ ...f, tags: [...f.tags, trimmed] }));
    }
    setBulkFormTagInput("");
  };

  const removeBulkFormTag = (tag: string) => {
    setBulkForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));
  };

  const resetFilters = () => {
    setFilterProject("__all__");
    setFilterService("__all__");
    setFilterHazardous("__all__");
    setFilterTags([]);
    setSortBy("created_desc");
    setSearch("");
  };

  const addFilterTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !filterTags.includes(trimmed)) {
      setFilterTags(prev => [...prev, trimmed]);
    }
    setTagInput("");
  };

  const removeFilterTag = (tag: string) => {
    setFilterTags(prev => prev.filter(t => t !== tag));
  };

  const addFormTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !form.tags.includes(trimmed)) {
      setForm(f => ({ ...f, tags: [...f.tags, trimmed] }));
    }
    setFormTagInput("");
  };

  const removeFormTag = (tag: string) => {
    setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));
  };

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
        tags: form.tags,
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

  // Tag suggestions for filter input
  const tagSuggestions = useMemo(() => {
    if (!tagInput.trim()) return [];
    const q = tagInput.toLowerCase();
    return allTags.filter(t => t.toLowerCase().includes(q) && !filterTags.includes(t)).slice(0, 5);
  }, [tagInput, allTags, filterTags]);

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

              {/* Mode toggle */}
              <div className="flex gap-2 border-b pb-3">
                <Button
                  variant={createMode === "single" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCreateMode("single")}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Einzelprobe
                </Button>
                <Button
                  variant={createMode === "bulk" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCreateMode("bulk")}
                  className="gap-1.5"
                >
                  <CopyPlus className="h-4 w-4" />
                  Serienerstellung
                </Button>
              </div>

              {createMode === "single" ? (
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
                <div className="space-y-2">
                  <Label>{t("tags_section")}</Label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {form.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                        <Tag className="h-3 w-3" />
                        {tag}
                        <button type="button" onClick={() => removeFormTag(tag)} className="ml-0.5 hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Input
                    value={formTagInput}
                    onChange={e => setFormTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") { e.preventDefault(); addFormTag(formTagInput); }
                    }}
                    placeholder={t("tags_placeholder")}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t("auto_number")}</p>
                <Button className="w-full" onClick={handleCreate} disabled={createSample.isPending}>
                  {createSample.isPending ? t("creating") : t("create_sample")}
                </Button>
              </div>
              ) : (
              /* Bulk creation mode */
              <div className="space-y-4 pt-2">
                {bulkCreatedCount !== null ? (
                  <div className="py-8 text-center">
                    <CheckCircle2 className="h-14 w-14 mx-auto mb-3 text-green-500" />
                    <h3 className="text-lg font-bold mb-2">{bulkCreatedCount} Proben erstellt!</h3>
                    <p className="text-sm text-muted-foreground mb-4">Die Proben wurden erfolgreich angelegt.</p>
                    <div className="flex gap-2 justify-center">
                      <Button variant="outline" size="sm" onClick={() => setBulkCreatedCount(null)}>Weitere erstellen</Button>
                      <Button size="sm" onClick={() => { resetForm(); setOpen(false); }}>Schließen</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Projekt *</Label>
                      <Select value={bulkProjectId} onValueChange={setBulkProjectId}>
                        <SelectTrigger><SelectValue placeholder="Projekt wählen" /></SelectTrigger>
                        <SelectContent>
                          {projects.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.project_number}{p.project_name ? ` – ${p.project_name}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Namenspräfix *</Label>
                      <Input value={bulkPrefix} onChange={e => setBulkPrefix(e.target.value)} placeholder="z.B. Probe_" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Startnummer</Label>
                        <Input type="number" min={1} value={bulkStartNum} onChange={e => setBulkStartNum(parseInt(e.target.value) || 1)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Endnummer</Label>
                        <Input type="number" min={bulkStartNum} value={bulkEndNum} onChange={e => setBulkEndNum(parseInt(e.target.value) || bulkStartNum)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Gruppenname</Label>
                      <Input value={bulkGroupName} onChange={e => setBulkGroupName(e.target.value)} placeholder="Optional – für spätere Filterung" />
                    </div>
                    <div className="space-y-2">
                      <Label>Beschreibung *</Label>
                      <Textarea value={bulkDescription} onChange={e => setBulkDescription(e.target.value)} placeholder="Gemeinsame Beschreibung für alle Proben" rows={2} />
                    </div>

                    <div className="space-y-2">
                      <Label>{t("post_measurement")}</Label>
                      <Select value={bulkForm.post_measurement_action} onValueChange={v => setBulkForm(f => ({ ...f, post_measurement_action: v }))}>
                        <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aufbewahren">{t("post_aufbewahren")}</SelectItem>
                          <SelectItem value="entsorgen">{t("post_entsorgen")}</SelectItem>
                          <SelectItem value="zurueck">{t("post_zurueck")}</SelectItem>
                          <SelectItem value="andere">{t("post_andere")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {bulkForm.post_measurement_action === "andere" && (
                      <Input value={bulkForm.post_measurement_action_text} onChange={e => setBulkForm(f => ({ ...f, post_measurement_action_text: e.target.value }))} placeholder={t("post_action_text_placeholder")} />
                    )}
                    {bulkForm.post_measurement_action === "aufbewahren" && (
                      <div className="space-y-3 rounded-md border p-3">
                        <div className="space-y-2">
                          <Label>{t("storage_min_duration")}</Label>
                          <Input value={bulkForm.storage_min_duration} onChange={e => setBulkForm(f => ({ ...f, storage_min_duration: e.target.value }))} placeholder={t("storage_min_duration_placeholder")} />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("storage_hints")}</Label>
                          <Input value={bulkForm.storage_hints} onChange={e => setBulkForm(f => ({ ...f, storage_hints: e.target.value }))} placeholder={t("storage_hints_placeholder")} />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("storage_expiry_date")}</Label>
                          <Input type="date" value={bulkForm.storage_expiry_date} onChange={e => setBulkForm(f => ({ ...f, storage_expiry_date: e.target.value }))} />
                        </div>
                      </div>
                    )}
                    {bulkForm.post_measurement_action === "entsorgen" && (
                      <div className="space-y-3 rounded-md border p-3">
                        <div className="space-y-2">
                          <Label>{t("disposal_method")}</Label>
                          <Input value={bulkForm.disposal_method} onChange={e => setBulkForm(f => ({ ...f, disposal_method: e.target.value }))} placeholder={t("disposal_method_placeholder")} />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("disposal_hints")}</Label>
                          <Input value={bulkForm.disposal_hints} onChange={e => setBulkForm(f => ({ ...f, disposal_hints: e.target.value }))} placeholder={t("disposal_hints_placeholder")} />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("disposal_category")}</Label>
                          <Select value={bulkForm.disposal_category} onValueChange={v => setBulkForm(f => ({ ...f, disposal_category: v }))}>
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
                      <Select value={bulkForm.location_id || "__none__"} onValueChange={v => setBulkForm(f => ({ ...f, location_id: v === "__none__" ? "" : v }))}>
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
                            <Checkbox checked={bulkForm.hazard_categories.includes(cat)} onCheckedChange={() => toggleBulkHazard(cat)} />
                            <Label className="text-sm font-normal">{t(`hazard_${cat}`)}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("tags_section")}</Label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {bulkForm.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                            <Tag className="h-3 w-3" />
                            {tag}
                            <button type="button" onClick={() => removeBulkFormTag(tag)} className="ml-0.5 hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <Input
                        value={bulkFormTagInput}
                        onChange={e => setBulkFormTagInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") { e.preventDefault(); addBulkFormTag(bulkFormTagInput); }
                        }}
                        placeholder={t("tags_placeholder")}
                      />
                    </div>

                    {/* Preview */}
                    <div className="rounded-md border p-3 space-y-2">
                      <p className="text-sm font-medium">{bulkCount} Proben werden erstellt:</p>
                      <div className="bg-muted rounded-md p-3 font-mono text-sm space-y-1">
                        {bulkPreviewNames.map(n => (
                          <div key={n} className="flex items-center gap-2">
                            <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
                            {n}
                          </div>
                        ))}
                        {bulkCount > 5 && <div className="text-muted-foreground">… und {bulkCount - 5} weitere</div>}
                      </div>
                    </div>

                    <Button className="w-full" size="lg" onClick={handleBulkCreate} disabled={isBulkCreating || bulkCount <= 0 || !bulkProjectId}>
                      <CopyPlus className="h-4 w-4 mr-2" />
                      {isBulkCreating ? "Erstelle…" : `${bulkCount} Proben erstellen`}
                    </Button>
                  </>
                )}
              </div>
              )}
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

      {/* Search + Scanner + Filter toggle */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("search_placeholder")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <SampleScannerInput />
        <Button
          variant={hasActiveFilters ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterOpen(o => !o)}
          className="gap-1.5"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {t("filter_show")}
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px] bg-primary-foreground text-primary">
              !
            </Badge>
          )}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-muted-foreground">
            <X className="h-3.5 w-3.5" />
            {t("filter_reset")}
          </Button>
        )}
      </div>

      {/* Expandable Filter Panel */}
      <Collapsible open={filterOpen} onOpenChange={setFilterOpen}>
        <CollapsibleContent>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Project filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">{t("filter_project")}</Label>
                  <Select value={filterProject} onValueChange={setFilterProject}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">{t("filter_project_all")}</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.project_number}{p.project_name ? ` – ${p.project_name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Measurement type filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">{t("filter_measurement_type")}</Label>
                  <Select value={filterService} onValueChange={setFilterService}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">{t("filter_measurement_type_all")}</SelectItem>
                      {services.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.service_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Hazardous filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">{t("filter_hazardous")}</Label>
                  <Select value={filterHazardous} onValueChange={setFilterHazardous}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">{t("filter_hazardous_all")}</SelectItem>
                      <SelectItem value="yes">{t("filter_hazardous_yes")}</SelectItem>
                      <SelectItem value="no">{t("filter_hazardous_no")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">{t("filter_sort")}</Label>
                  <Select value={sortBy} onValueChange={v => setSortBy(v as SortOption)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_desc">{t("sort_created_desc")}</SelectItem>
                      <SelectItem value="created_asc">{t("sort_created_asc")}</SelectItem>
                      <SelectItem value="name">{t("sort_name")}</SelectItem>
                      <SelectItem value="eta">{t("sort_eta")}</SelectItem>
                      <SelectItem value="location">{t("sort_location")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tags filter row */}
              <div className="mt-4 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{t("filter_tags")}</Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {filterTags.map(tag => (
                    <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                      <Tag className="h-3 w-3" />
                      {tag}
                      <button type="button" onClick={() => removeFilterTag(tag)} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="relative max-w-sm">
                  <Input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") { e.preventDefault(); addFilterTag(tagInput); }
                    }}
                    placeholder={t("filter_tags_placeholder")}
                    className="h-9"
                  />
                  {tagSuggestions.length > 0 && (
                    <div className="absolute z-10 top-full left-0 mt-1 w-full rounded-md border bg-popover shadow-md">
                      {tagSuggestions.map(suggestion => (
                        <button
                          key={suggestion}
                          type="button"
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                          onClick={() => addFilterTag(suggestion)}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

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
                <TableHead>{t("tags")}</TableHead>
                <TableHead>{t("hazardous")}</TableHead>
                {activeTab === "kritisch" && <TableHead>{t("expiry_remaining")}</TableHead>}
                <TableHead>{t("created_at")}</TableHead>
                <TableHead className="w-24">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={activeTab === "kritisch" ? 12 : 11} className="text-center py-8">{t("loading")}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={activeTab === "kritisch" ? 12 : 11} className="text-center py-8 text-muted-foreground">{t("no_samples")}</TableCell></TableRow>
              ) : (
                filtered.map((s: any) => {
                  const project = s.projects;
                  const location = s.storage_locations;
                  const canDelete = role === "master" || s.created_by === user?.id;
                  const daysLeft = getDaysUntilExpiry(s.storage_expiry_date);
                  const sampleTags: string[] = Array.isArray(s.tags) ? s.tags : [];
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.sample_number}</TableCell>
                      <TableCell>{s.sample_name}</TableCell>
                      <TableCell>{project?.project_number || "–"}</TableCell>
                      <TableCell>{getStatusBadge(s.status || "neu")}</TableCell>
                      <TableCell>
                        {(() => {
                          const completed = ["vollstaendig_verbraucht", "entsorgt", "zurueckgesendet"];
                          if (completed.includes(s.status)) return <span className="text-muted-foreground text-xs">{t("eta_completed")}</span>;
                          const eta = etaMap.get(s.id);
                          if (!eta) return <span className="text-muted-foreground text-xs">{t("eta_no_orders")}</span>;
                          return <Badge variant="outline" className="gap-1 text-xs"><CalendarClock className="h-3 w-3" />{eta.toLocaleDateString("de-DE")}</Badge>;
                        })()}
                      </TableCell>
                      <TableCell className="text-sm">{formatLocation(location)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {sampleTags.length > 0 ? sampleTags.slice(0, 3).map(tag => (
                            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                              {tag}
                            </Badge>
                          )) : <span className="text-muted-foreground text-xs">–</span>}
                          {sampleTags.length > 3 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{sampleTags.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
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
