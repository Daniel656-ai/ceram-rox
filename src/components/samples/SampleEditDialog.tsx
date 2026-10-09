import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Pencil, Tag, X, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SampleParametersFields } from "@/components/SampleParametersFields";
import { HazardClassSelector } from "@/components/HazardClassSelector";
import { useUpdateSampleFields } from "@/hooks/useSamples";
import {
  buildSampleEditForm, diffSampleEdit, setHazardous, validateSampleEditForm,
  type SampleEditForm,
} from "@/lib/samples/sampleEdit";

const DISPOSAL_CATEGORIES = ["laborabfall", "gefahrstoff", "sondermuell"] as const;

interface Props {
  sample: Record<string, any>;
  projects: Array<{ id: string; project_number: string; project_name?: string | null }>;
  linkedOrderCount: number;
  userId: string;
}

export function SampleEditDialog({ sample, projects, linkedOrderCount, userId }: Props) {
  const { t } = useTranslation("samples");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SampleEditForm>(() => buildSampleEditForm(sample));
  const [tagInput, setTagInput] = useState("");
  const update = useUpdateSampleFields();

  useEffect(() => { if (open) { setForm(buildSampleEditForm(sample)); setTagInput(""); } }, [open, sample]);

  const set = (patch: Partial<SampleEditForm>) => setForm((f) => ({ ...f, ...patch }));
  const projectChanged = form.project_id !== (sample.project_id ?? "");
  const showOrderWarning = projectChanged && linkedOrderCount > 0;

  const addTag = (raw: string) => {
    const v = raw.trim();
    if (v && !form.tags.includes(v)) set({ tags: [...form.tags, v] });
    setTagInput("");
  };

  const handleSave = async () => {
    if (validateSampleEditForm(form).length > 0) { toast.error(t("all_required")); return; }
    const { patch, changes, hazardCleared } = diffSampleEdit(sample, form);
    if (changes.length === 0) { toast.info(t("edit_no_changes")); setOpen(false); return; }
    try {
      await update.mutateAsync({ id: sample.id, patch, userId, changes, hazardCleared });
      toast.success(t("edit_saved"));
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || t("edit_save_error"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1" />{t("edit_sample")}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("edit_sample_title")}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("sample_number")}</Label>
              <Input value={sample.sample_number ?? ""} readOnly disabled />
            </div>
            <div className="space-y-2">
              <Label>{t("created_at")}</Label>
              <Input value={sample.created_at ? new Date(sample.created_at).toLocaleDateString("de-DE") : ""} readOnly disabled />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("sample_name_required")}</Label>
              <Input value={form.sample_name} onChange={(e) => set({ sample_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("project_number")}</Label>
              <Select value={form.project_id || "__none__"} onValueChange={(v) => set({ project_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder={t("select_project")} /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.project_number}{p.project_name ? ` – ${p.project_name}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {showOrderWarning && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{t("edit_project_order_warning")}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label>{t("description")}</Label>
            <Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={2} />
          </div>
          <SampleParametersFields value={form.params} onChange={(params) => set({ params })} idPrefix="edit-params" />
          <div className="space-y-2">
            <Label>{t("post_measurement")}</Label>
            <Select value={form.post_measurement_action || undefined} onValueChange={(v) => set({ post_measurement_action: v })}>
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
            <Input value={form.post_measurement_action_text} onChange={(e) => set({ post_measurement_action_text: e.target.value })} placeholder={t("post_action_text_placeholder")} />
          )}
          {form.post_measurement_action === "aufbewahren" && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-2"><Label>{t("storage_min_duration")}</Label>
                <Input value={form.storage_min_duration} onChange={(e) => set({ storage_min_duration: e.target.value })} /></div>
              <div className="space-y-2"><Label>{t("storage_hints")}</Label>
                <Input value={form.storage_hints} onChange={(e) => set({ storage_hints: e.target.value })} /></div>
              <div className="space-y-2"><Label>{t("storage_expiry_date")}</Label>
                <Input type="date" value={form.storage_expiry_date} onChange={(e) => set({ storage_expiry_date: e.target.value })} /></div>
            </div>
          )}
          {form.post_measurement_action === "entsorgen" && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-2"><Label>{t("disposal_method")}</Label>
                <Input value={form.disposal_method} onChange={(e) => set({ disposal_method: e.target.value })} /></div>
              <div className="space-y-2"><Label>{t("disposal_hints")}</Label>
                <Input value={form.disposal_hints} onChange={(e) => set({ disposal_hints: e.target.value })} /></div>
              <div className="space-y-2"><Label>{t("disposal_category")}</Label>
                <Select value={form.disposal_category || undefined} onValueChange={(v) => set({ disposal_category: v })}>
                  <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                  <SelectContent>
                    {DISPOSAL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{t(`disposal_${c}`)}</SelectItem>)}
                  </SelectContent>
                </Select></div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm" htmlFor="edit-is-hazardous">
            <Checkbox id="edit-is-hazardous" checked={form.is_hazardous} onCheckedChange={(c) => setForm((f) => setHazardous(f, !!c))} />
            {t("edit_is_hazardous")}
          </label>
          {form.is_hazardous ? (
            <HazardClassSelector
              value={form.hazard_categories}
              onChange={(next) => set({ hazard_categories: next as string[] })}
              label={t("hazard_section")}
              idPrefix="edit-haz"
            />
          ) : sample.is_hazardous && (sample.hazard_categories?.length ?? 0) > 0 ? (
            <p className="text-xs text-muted-foreground">{t("edit_hazard_cleared_hint")}</p>
          ) : null}
          <div className="space-y-2">
            <Label>{t("tags_section")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {form.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                  <Tag className="h-3 w-3" />{tag}
                  <button type="button" onClick={() => set({ tags: form.tags.filter((x) => x !== tag) })} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
            <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
              placeholder={t("tags_placeholder")} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
          <Button onClick={handleSave} disabled={update.isPending}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
