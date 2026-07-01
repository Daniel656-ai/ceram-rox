import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
} from "@/hooks/useProjectMilestones";
import {
  useCreateWorkPackageDependency,
  useDeleteWorkPackageDependency,
  useUpdateWorkPackageDependency,
  type WorkPackageDependency,
  type WpDependencyType,
} from "@/hooks/useWorkPackageDependencies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Trash2, Pencil, Flag, Check, X, Link2, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface WP {
  id: string;
  title: string;
  project_id: string;
}

interface MS {
  id: string;
  title: string;
  milestone_date: string | null;
  status: string;
  description?: string | null;
  work_package_id?: string | null;
}

const DEP_TYPES: WpDependencyType[] = ["FS", "FF", "SS", "SF"];

export function WorkPackageDetails({
  wp,
  projectId,
  allWps,
  wpMilestones,
  allProjectMilestones = [],
  dependencies,
  canManage,
  locale,
}: {
  wp: WP;
  projectId: string;
  allWps: WP[];
  wpMilestones: MS[];
  allProjectMilestones?: MS[];
  dependencies: WorkPackageDependency[];
  canManage: boolean;
  locale: string;
}) {
  const { t } = useTranslation("projects");
  const { user } = useAuth();

  const createMs = useCreateMilestone();
  const updateMs = useUpdateMilestone();
  const deleteMs = useDeleteMilestone();

  const createDep = useCreateWorkPackageDependency();
  const deleteDep = useDeleteWorkPackageDependency();
  const updateDep = useUpdateWorkPackageDependency();

  // --- Milestone inline row ---
  const [msDraft, setMsDraft] = useState<{ title: string; date: string }>({ title: "", date: "" });
  const [editingMs, setEditingMs] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ title: string; date: string; status: string }>({ title: "", date: "", status: "planned" });

  const sortedMs = [...wpMilestones].sort((a, b) => {
    if (!a.milestone_date) return 1;
    if (!b.milestone_date) return -1;
    return a.milestone_date.localeCompare(b.milestone_date);
  });

  // Suggestions: milestones from this project not already attached to this WP
  const attachedIds = new Set(wpMilestones.map((m) => m.id));
  const suggestions = useMemo(() => {
    const q = msDraft.title.trim().toLowerCase();
    return (allProjectMilestones || [])
      .filter((m) => !attachedIds.has(m.id))
      .filter((m) => (q ? m.title.toLowerCase().includes(q) : true))
      .sort((a, b) => a.title.localeCompare(b.title, locale));
  }, [allProjectMilestones, msDraft.title, wpMilestones, locale]);

  const exactMatch = useMemo(() => {
    const q = msDraft.title.trim().toLowerCase();
    if (!q) return null;
    return (allProjectMilestones || []).find((m) => m.title.trim().toLowerCase() === q) || null;
  }, [allProjectMilestones, msDraft.title]);

  const [showSuggest, setShowSuggest] = useState(false);
  const suggestRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) setShowSuggest(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const attachExisting = async (m: MS) => {
    try {
      await updateMs.mutateAsync({ id: m.id, projectId, work_package_id: wp.id });
      setMsDraft({ title: "", date: "" });
      setShowSuggest(false);
      toast.success(t("milestone_updated"));
    } catch (e: any) { toast.error(e.message); }
  };

  const addMs = async () => {
    const title = msDraft.title.trim();
    if (!title) { toast.error(t("milestone_title_required")); return; }
    try {
      if (exactMatch) {
        if (exactMatch.work_package_id === wp.id) {
          toast.info(t("milestone_updated"));
        } else {
          await updateMs.mutateAsync({ id: exactMatch.id, projectId, work_package_id: wp.id });
          toast.success(t("milestone_updated"));
        }
      } else {
        await createMs.mutateAsync({
          project_id: projectId,
          title,
          milestone_date: msDraft.date || undefined,
          work_package_id: wp.id,
          created_by: user!.id,
        });
        toast.success(t("milestone_created"));
      }
      setMsDraft({ title: "", date: "" });
      setShowSuggest(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const startEditMs = (m: MS) => {
    setEditingMs(m.id);
    setEditDraft({ title: m.title, date: m.milestone_date || "", status: m.status });
  };
  const saveEditMs = async (id: string) => {
    try {
      await updateMs.mutateAsync({
        id, projectId,
        title: editDraft.title,
        milestone_date: editDraft.date || null,
        status: editDraft.status,
      });
      setEditingMs(null);
      toast.success(t("milestone_updated"));
    } catch (e: any) { toast.error(e.message); }
  };

  // --- Dependency add ---
  const [depPred, setDepPred] = useState<string>("");
  const [depType, setDepType] = useState<WpDependencyType>("FS");
  const [depLag, setDepLag] = useState<number>(0);

  const myDeps = dependencies.filter((d) => d.successor_id === wp.id);

  const addDep = async () => {
    if (!depPred) return;
    try {
      await createDep.mutateAsync({
        project_id: projectId,
        predecessor_id: depPred,
        successor_id: wp.id,
        dependency_type: depType,
        lag_days: depLag,
        created_by: user!.id,
      });
      setDepPred(""); setDepType("FS"); setDepLag(0);
      toast.success(t("wp_dependency_created"));
    } catch (e: any) {
      const msg = /Zyklische|cyclic/i.test(e.message || "") ? t("wp_dep_cycle") : e.message;
      toast.error(msg);
    }
  };

  const wpTitleById = (id: string) => allWps.find((x) => x.id === id)?.title || "–";

  return (
    <div className="grid md:grid-cols-2 gap-4 p-4 bg-muted/30 border-t">
      {/* Milestones */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Flag className="h-3.5 w-3.5" />
          {t("wp_milestones_count", { count: sortedMs.length })}
        </div>
        {sortedMs.length === 0 && (
          <div className="text-xs italic text-muted-foreground">{t("wp_milestones_none")}</div>
        )}
        <ul className="space-y-1.5">
          {sortedMs.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm bg-background rounded border px-2 py-1.5">
              {editingMs === m.id ? (
                <>
                  <Input className="h-7 flex-1" value={editDraft.title} onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))} />
                  <Input className="h-7 w-36" type="date" value={editDraft.date} onChange={(e) => setEditDraft((d) => ({ ...d, date: e.target.value }))} />
                  <Select value={editDraft.status} onValueChange={(v) => setEditDraft((d) => ({ ...d, status: v }))}>
                    <SelectTrigger className="h-7 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">{t("milestone_status_planned")}</SelectItem>
                      <SelectItem value="in_progress">{t("milestone_status_in_progress")}</SelectItem>
                      <SelectItem value="completed">{t("milestone_status_completed")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEditMs(m.id)}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingMs(null)}><X className="h-4 w-4" /></Button>
                </>
              ) : (
                <>
                  <Flag className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="flex-1 truncate">{m.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.milestone_date ? new Date(m.milestone_date).toLocaleDateString(locale) : "–"}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{t(`milestone_status_${m.status}`)}</Badge>
                  {canManage && (
                    <>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEditMs(m)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={async () => { await deleteMs.mutateAsync({ id: m.id, projectId }); toast.success(t("milestone_deleted")); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
        {canManage && (
          <div className="flex items-center gap-2 pt-1">
            <Input className="h-8 flex-1" placeholder={t("milestone_title")} value={msDraft.title} onChange={(e) => setMsDraft((d) => ({ ...d, title: e.target.value }))} />
            <Input className="h-8 w-36" type="date" value={msDraft.date} onChange={(e) => setMsDraft((d) => ({ ...d, date: e.target.value }))} />
            <Button size="sm" variant="secondary" onClick={addMs} disabled={createMs.isPending}>
              <Plus className="h-3.5 w-3.5 mr-1" />{t("wp_milestone_add")}
            </Button>
          </div>
        )}
      </div>

      {/* Dependencies */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" />
          {t("wp_dependencies_count", { count: myDeps.length })}
        </div>
        {myDeps.length === 0 && (
          <div className="text-xs italic text-muted-foreground">{t("wp_dependencies_none")}</div>
        )}
        <ul className="space-y-1.5">
          {myDeps.map((d) => (
            <li key={d.id} className="flex items-center gap-2 text-sm bg-background rounded border px-2 py-1.5">
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{wpTitleById(d.predecessor_id)}</span>
              <Select
                value={d.dependency_type}
                onValueChange={(v) => updateDep.mutate({ id: d.id, projectId, dependency_type: v as WpDependencyType })}
                disabled={!canManage}
              >
                <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEP_TYPES.map((tp) => <SelectItem key={tp} value={tp}>{tp}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                type="number"
                className="h-7 w-16 text-xs"
                value={d.lag_days}
                disabled={!canManage}
                onChange={(e) => {
                  const v = parseInt(e.target.value || "0", 10);
                  updateDep.mutate({ id: d.id, projectId, lag_days: isNaN(v) ? 0 : v });
                }}
              />
              {canManage && (
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={async () => { await deleteDep.mutateAsync({ id: d.id, projectId }); toast.success(t("wp_dependency_deleted")); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </li>
          ))}
        </ul>
        {canManage && (
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="secondary"><Plus className="h-3.5 w-3.5 mr-1" />{t("wp_dependency_add")}</Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("wp_dependency_predecessor")}</Label>
                <Select value={depPred} onValueChange={setDepPred}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="…" /></SelectTrigger>
                  <SelectContent>
                    {allWps.filter((x) => x.id !== wp.id).map((x) => (
                      <SelectItem key={x.id} value={x.id}>{x.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("wp_dependency_type")}</Label>
                  <Select value={depType} onValueChange={(v) => setDepType(v as WpDependencyType)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEP_TYPES.map((tp) => <SelectItem key={tp} value={tp}>{t(`wp_dep_type_${tp}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("wp_dependency_lag")}</Label>
                  <Input type="number" className="h-8" value={depLag} onChange={(e) => setDepLag(parseInt(e.target.value || "0", 10) || 0)} />
                </div>
              </div>
              <Button size="sm" className="w-full" onClick={addDep} disabled={!depPred || createDep.isPending}>
                {t("wp_dependency_add")}
              </Button>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
