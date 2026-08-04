import { useState, useMemo } from "react";
import { useSamples, useCreateSample } from "@/hooks/useSamples";
import { useProjects } from "@/hooks/useProjects";
import { useStorageLocations } from "@/hooks/useRawMaterials";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronsUpDown, Check, Plus, X, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { SampleParametersFields } from "@/components/SampleParametersFields";
import { EMPTY_SAMPLE_PARAMETERS, sampleParametersToPayload, type SampleParameters } from "@/lib/sampleParameters";


const HAZARD_CATEGORIES = [
  "gesundheitsschaedlich", "toxisch", "reizend", "aetzend", "entzuendlich", "umweltgefaehrlich", "sonstiges",
] as const;

const DISPOSAL_CATEGORIES = ["laborabfall", "gefahrstoff", "sondermuell"] as const;

function formatLocation(loc: any) {
  if (!loc) return "–";
  return [loc.hall, loc.room, loc.shelf, loc.position].filter(Boolean).join(" › ");
}

interface SampleSelectorProps {
  value: string;
  onSelect: (sampleId: string) => void;
  projectId?: string;
}

export default function SampleSelector({ value, onSelect, projectId }: SampleSelectorProps) {
  const { t } = useTranslation("samples");
  const { data: samples = [] } = useSamples();
  const { data: projects = [] } = useProjects();
  const { data: locations = [] } = useStorageLocations();
  const { user, role } = useAuth();
  const createSample = useCreateSample();

  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formTagInput, setFormTagInput] = useState("");
  const [params, setParams] = useState<SampleParameters>(EMPTY_SAMPLE_PARAMETERS);

  const [form, setForm] = useState({
    sample_name: "", project_id: "", description: "",
    post_measurement_action: "" as string, post_measurement_action_text: "",
    storage_min_duration: "", storage_hints: "", storage_expiry_date: "",
    disposal_method: "", disposal_hints: "", disposal_category: "",
    hazard_categories: [] as string[], is_hazardous: false, location_id: "",
    tags: [] as string[],
  });

  const canCreate = role === "master" || role === "auftraggeber" || role === "durchfuehrer";

  const filteredSamples = useMemo(() => {
    if (projectId) return samples.filter((s) => s.project_id === projectId);
    return samples;
  }, [samples, projectId]);

  const selected = samples.find((s) => s.id === value);

  const resetForm = () => {
    setForm({
      sample_name: "", project_id: "", description: "",
      post_measurement_action: "", post_measurement_action_text: "",
      storage_min_duration: "", storage_hints: "", storage_expiry_date: "",
      disposal_method: "", disposal_hints: "", disposal_category: "",
      hazard_categories: [], is_hazardous: false, location_id: "",
      tags: [],
    });
    setFormTagInput("");
    setParams(EMPTY_SAMPLE_PARAMETERS);
  };


  const toggleHazard = (cat: string) => {
    setForm(f => {
      const cats = f.hazard_categories.includes(cat)
        ? f.hazard_categories.filter(c => c !== cat)
        : [...f.hazard_categories, cat];
      return { ...f, hazard_categories: cats, is_hazardous: cats.length > 0 };
    });
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
      toast.error(t("all_required"));
      return;
    }
    try {
      const newSample = await createSample.mutateAsync({
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
        tags: form.tags,
        ...sampleParametersToPayload(params),

      });
      toast.success(t("created"));
      onSelect(newSample.id);
      resetForm();
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || t("create_error"));
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
            {selected ? `${selected.sample_number} – ${selected.sample_name}` : t("select_project").replace("Projekt", "Probe")}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={t("scan_placeholder")} />
            <CommandList>
              {canCreate && (
                <CommandGroup forceMount>
                  <CommandItem
                    value="__create_new_sample__"
                    forceMount
                    onSelect={() => {
                      setOpen(false);
                      setForm((f) => ({ ...f, project_id: projectId || "" }));
                      setDialogOpen(true);
                    }}
                    className="text-primary data-[selected=true]:bg-primary/10"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    <span className="font-medium">+ {t("new_sample")}</span>
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandEmpty>{t("no_samples")}</CommandEmpty>
              <CommandGroup>
                {filteredSamples.map((s) => {
                  const proj = (s as any).projects;
                  return (
                    <CommandItem
                      key={s.id}
                      value={`${s.sample_number} ${s.sample_name} ${proj?.project_number || ""}`}
                      onSelect={() => {
                        onSelect(s.id);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === s.id ? "opacity-100" : "opacity-0")} />
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {s.sample_number} – {s.sample_name}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>

          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("create_title")}</DialogTitle>
          </DialogHeader>
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
            <SampleParametersFields value={params} onChange={setParams} idPrefix="selector-params" />

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
        </DialogContent>
      </Dialog>
    </>
  );
}
