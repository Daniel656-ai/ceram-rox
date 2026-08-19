import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Flag, Search, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { useProjects } from "@/hooks/useProjects";
import { useUsers } from "@/hooks/useUsers";
import { useCreateWeeklyReview } from "@/hooks/useWeeklyReviews";
import { PersonSelect } from "@/components/PersonSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getISOWeek, formatDateWithWeek } from "@/lib/isoWeek";

interface Props {
  projectId: string;
  /** Reviews des Projekts – für den Hinweis "KW enthält bereits ein Review". */
  existingReviews?: any[];
  onSaved?: () => void;
  onCancel?: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Projekteigner",
  leader: "Projektleiter",
  member: "Projektmitarbeiter",
};

const QUESTIONS = [
  { key: "completed_this_week", label: "Aktivitäten der Woche" },
  { key: "currently_working_on", label: "Woran arbeitest du im Augenblick?" },
  { key: "next_steps", label: "Was machst du als nächstes?" },
  { key: "help_needed", label: "Benötigst du irgendwo Hilfe?" },
  { key: "risks", label: "Gibt es aktuelle Risiken im Projekt?" },
  { key: "other_comments", label: "Sonstige Kommentare / Anmerkungen" },
] as const;

/** Formular zum Erstellen eines Weekly Reviews (Split-Ansicht, kein Modal). */
export function WeeklyReviewForm({ projectId, existingReviews = [], onSaved, onCancel }: Props) {
  const { user, profile, customRoleName } = useAuth();
  const { hasPermission } = usePermissions();
  const isPMO = (customRoleName ?? "").trim().toLowerCase() === "pmo" || hasPermission("weekly_reviews.manage_all");

  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId);
  useEffect(() => { setSelectedProjectId(projectId); }, [projectId]);
  const effectiveProjectId = isPMO ? selectedProjectId : projectId;

  const { data: allProjects = [] } = useProjects();
  const { data: members = [] } = useProjectMembers(effectiveProjectId);
  const { data: users = [] } = useUsers();
  const createMut = useCreateWeeklyReview();

  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectQuery, setProjectQuery] = useState("");

  const sortedProjects = useMemo(() => {
    const label = (p: any) => `${p.project_name || p.project_number || ""}`.trim();
    return [...(allProjects as any[])].sort((a, b) => label(a).localeCompare(label(b), "de", { sensitivity: "base" }));
  }, [allProjects]);

  const filteredProjects = useMemo(() => {
    const q = projectQuery.trim().toLowerCase();
    if (!q) return sortedProjects;
    return sortedProjects.filter((p: any) =>
      `${p.project_name ?? ""} ${p.project_number ?? ""} ${p.description ?? ""}`.toLowerCase().includes(q)
    );
  }, [sortedProjects, projectQuery]);

  const selectedProject = (allProjects as any[]).find((p) => p.id === effectiveProjectId);

  const myMember = useMemo(() => (members as any[]).find((m: any) => m.user_id === user?.id), [members, user]);
  const myRole = (myMember?.role as string | undefined) || "member";

  const [pmoPersonId, setPmoPersonId] = useState<string>("");
  const [pmoRole, setPmoRole] = useState<string>("");

  useEffect(() => {
    if (isPMO) { setPmoPersonId(""); setPmoRole(""); }
  }, [effectiveProjectId, isPMO]);

  const memberUsers = useMemo(() => {
    const memberIds = new Set((members as any[]).map((m: any) => m.user_id));
    return (users as any[]).filter((u: any) => memberIds.has(u.user_id));
  }, [members, users]);

  const availableRolesForPerson = useMemo(() => {
    if (!pmoPersonId) return [] as string[];
    const roles = (members as any[]).filter((m: any) => m.user_id === pmoPersonId).map((m: any) => m.role as string);
    return Array.from(new Set(roles)).sort((a, b) => (ROLE_LABELS[a] ?? a).localeCompare(ROLE_LABELS[b] ?? b, "de"));
  }, [members, pmoPersonId]);

  useEffect(() => {
    if (isPMO && availableRolesForPerson.length === 1) setPmoRole(availableRolesForPerson[0]);
    else if (isPMO && !availableRolesForPerson.includes(pmoRole)) setPmoRole("");
  }, [availableRolesForPerson, isPMO]); // eslint-disable-line react-hooks/exhaustive-deps

  const myName = useMemo(() => {
    if (profile) return `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || user?.email || "–";
    const u = (users as any[]).find((u: any) => u.user_id === user?.id);
    return u ? `${u.first_name} ${u.last_name}`.trim() : user?.email || "–";
  }, [profile, user, users]);

  // Datum ist frei wählbar – KW wird automatisch daraus abgeleitet.
  const [reviewDate, setReviewDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const iso = getISOWeek(reviewDate) ?? { year: new Date().getFullYear(), week: 1 };

  const sameWeekCount = useMemo(
    () =>
      (existingReviews as any[]).filter(
        (r) => r.project_id === effectiveProjectId && r.iso_year === iso.year && r.iso_week === iso.week
      ).length,
    [existingReviews, effectiveProjectId, iso.year, iso.week]
  );

  const [form, setForm] = useState({
    completed_this_week: "",
    currently_working_on: "",
    next_steps: "",
    help_needed: "",
    risks: "",
    other_comments: "",
  });
  const [rating, setRating] = useState<1 | 2 | 3 | null>(null);
  const [ratingReason, setRatingReason] = useState("");

  const reasonRequired = rating === 1 || rating === 2;

  const reset = () => {
    setForm({ completed_this_week: "", currently_working_on: "", next_steps: "", help_needed: "", risks: "", other_comments: "" });
    setRating(null);
    setRatingReason("");
    setReviewDate(new Date().toISOString().slice(0, 10));
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (isPMO && !effectiveProjectId) return toast.error("Bitte ein Projekt auswählen");
    if (isPMO && !pmoPersonId) return toast.error("Bitte eine Person auswählen");
    if (isPMO && !pmoRole) return toast.error("Bitte eine Projektrolle auswählen");
    if (isPMO) {
      const valid = (members as any[]).some((m: any) => m.user_id === pmoPersonId && m.role === pmoRole);
      if (!valid) return toast.error("Ungültige Person/Rollen-Kombination für dieses Projekt");
    }
    if (!rating) return toast.error("Bitte eine Gesamtbewertung auswählen");
    if (reasonRequired && !ratingReason.trim())
      return toast.error("Bitte eine Begründung für die Projektbewertung angeben");

    try {
      await createMut.mutateAsync({
        project_id: effectiveProjectId,
        author_user_id: isPMO ? pmoPersonId : user.id,
        author_role_snapshot: isPMO ? pmoRole : myRole,
        iso_year: iso.year,
        iso_week: iso.week,
        review_date: reviewDate,
        ...form,
        overall_rating: rating,
        rating_reason: reasonRequired ? ratingReason.trim() : "",
      });
      toast.success("Weekly Review gespeichert");
      reset();
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.message || "Fehler beim Speichern");
    }
  };

  const flagBtn = (value: 1 | 2 | 3, count: number, color: string, label: string) => (
    <button
      type="button"
      onClick={() => setRating(value)}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 rounded-lg border-2 px-3 py-3 transition-all",
        rating === value ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/40 hover:bg-muted/40"
      )}
      aria-pressed={rating === value}
    >
      <div className="flex gap-0.5">
        {Array.from({ length: count }).map((_, i) => (
          <Flag key={i} className="h-5 w-5" style={{ color, fill: color }} />
        ))}
      </div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      {isPMO && (
        <div className="space-y-1.5">
          <Label>Projekt</Label>
          <Popover open={projectPickerOpen} onOpenChange={(o) => { setProjectPickerOpen(o); if (!o) setProjectQuery(""); }}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" role="combobox" aria-expanded={projectPickerOpen} className="w-full justify-between font-normal">
                <span className={cn("truncate", !selectedProject && "text-muted-foreground")}>
                  {selectedProject
                    ? `${selectedProject.project_name || selectedProject.project_number}${selectedProject.project_name && selectedProject.project_number ? ` (${selectedProject.project_number})` : ""}`
                    : "Projekt auswählen…"}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input autoFocus value={projectQuery} onChange={(e) => setProjectQuery(e.target.value)} placeholder="Projekt suchen…" className="pl-9 h-9" />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {filteredProjects.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">Keine Projekte gefunden</div>
                ) : (
                  filteredProjects.map((p: any) => {
                    const isSel = p.id === effectiveProjectId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground", isSel && "bg-accent/50")}
                        onClick={() => { setSelectedProjectId(p.id); setProjectPickerOpen(false); }}
                      >
                        <Check className={cn("h-4 w-4", isSel ? "opacity-100" : "opacity-0")} />
                        <span className="truncate">{p.project_name || p.project_number}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {isPMO && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Person *</Label>
            <PersonSelect
              value={pmoPersonId}
              onValueChange={(id) => setPmoPersonId(id)}
              users={memberUsers}
              placeholder={effectiveProjectId ? "Person auswählen…" : "Zuerst Projekt wählen"}
              searchPlaceholder="Person suchen…"
              disabled={!effectiveProjectId || memberUsers.length === 0}
              activeOnly={false}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Projektrolle *</Label>
            <Select value={pmoRole} onValueChange={setPmoRole} disabled={!pmoPersonId || availableRolesForPerson.length === 0}>
              <SelectTrigger><SelectValue placeholder={pmoPersonId ? "Rolle wählen…" : "Zuerst Person wählen"} /></SelectTrigger>
              <SelectContent>
                {availableRolesForPerson.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r] ?? r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Datum + abgeleitete KW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Datum · KW</div>
          <Input type="date" className="h-9" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
          <div className="text-xs text-muted-foreground">KW {iso.week}/{iso.year}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Mitarbeiter</div>
          <div className="font-medium truncate">
            {isPMO
              ? (() => {
                  const p = (users as any[]).find((u: any) => u.user_id === pmoPersonId);
                  return p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email : "–";
                })()
              : myName}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Projektrolle</div>
          <div className="font-medium">{isPMO ? (pmoRole ? (ROLE_LABELS[pmoRole] ?? pmoRole) : "–") : (ROLE_LABELS[myRole] ?? myRole)}</div>
        </div>
      </div>

      {sameWeekCount > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs">
          <Info className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            Für diese Kalenderwoche existiert bereits ein Weekly Review ({sameWeekCount}). Du kannst trotzdem ein weiteres Review erstellen.
          </span>
        </div>
      )}

      {/* Bewertung – Pflichtfeld */}
      <div className="space-y-2">
        <Label>Overall Projektbewertung *</Label>
        <div className="flex gap-3">
          {flagBtn(1, 1, "#dc2626", "Schlecht")}
          {flagBtn(2, 2, "#eab308", "Mittel")}
          {flagBtn(3, 3, "#16a34a", "Gut")}
        </div>
      </div>

      {reasonRequired && (
        <div className="space-y-1.5">
          <Label htmlFor="rating_reason">Begründung für die Projektbewertung *</Label>
          <Textarea
            id="rating_reason"
            rows={3}
            value={ratingReason}
            onChange={(e) => setRatingReason(e.target.value)}
            placeholder="Warum wurde diese Bewertung gewählt?"
          />
        </div>
      )}

      {/* Optionale Textfelder */}
      {QUESTIONS.map((q) => (
        <div key={q.key} className="space-y-1.5">
          <Label htmlFor={q.key}>{q.label}</Label>
          <Textarea
            id={q.key}
            rows={3}
            value={(form as any)[q.key]}
            onChange={(e) => setForm({ ...form, [q.key]: e.target.value })}
          />
        </div>
      ))}

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-xs text-muted-foreground">{formatDateWithWeek(reviewDate, true)}</span>
        <div className="flex gap-2">
          {onCancel && <Button variant="outline" onClick={onCancel}>Abbrechen</Button>}
          <Button onClick={handleSubmit} disabled={createMut.isPending}>
            {createMut.isPending ? "Speichern…" : "Weekly Review speichern"}
          </Button>
        </div>
      </div>
    </div>
  );
}
