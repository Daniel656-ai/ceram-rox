import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Flag, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { useProjects } from "@/hooks/useProjects";
import { useUsers } from "@/hooks/useUsers";
import { useCreateWeeklyReview } from "@/hooks/useWeeklyReviews";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** ISO-8601 week-of-year. */
function getISOWeek(date: Date): { year: number; week: number } {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.getTime() - firstThursday.getTime();
  const week = 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
  return { year: target.getUTCFullYear(), week };
}

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Projekteigner",
  leader: "Projektleiter",
  member: "Projektmitarbeiter",
};

export function WeeklyReviewDialog({ projectId, open, onOpenChange }: Props) {
  const { user, profile, customRoleName } = useAuth();
  const { hasPermission } = require("@/hooks/usePermissions").usePermissions();
  const isPMO = (customRoleName ?? "").trim().toLowerCase() === "pmo" || hasPermission("weekly_reviews.manage_all");

  // PMO users may pick any project; others are locked to the current project.
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId);
  useEffect(() => { setSelectedProjectId(projectId); }, [projectId, open]);

  const effectiveProjectId = isPMO ? selectedProjectId : projectId;

  const { data: allProjects = [] } = useProjects();
  const { data: members = [] } = useProjectMembers(effectiveProjectId);
  const { data: users = [] } = useUsers();
  const createMut = useCreateWeeklyReview();

  // Project combobox state (PMO only)
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectQuery, setProjectQuery] = useState("");

  const sortedProjects = useMemo(() => {
    const label = (p: any) =>
      `${p.project_name || p.project_number || ""}`.trim();
    return [...(allProjects as any[])].sort((a, b) =>
      label(a).localeCompare(label(b), "de", { sensitivity: "base" })
    );
  }, [allProjects]);

  const filteredProjects = useMemo(() => {
    const q = projectQuery.trim().toLowerCase();
    if (!q) return sortedProjects;
    return sortedProjects.filter((p: any) => {
      const hay = `${p.project_name ?? ""} ${p.project_number ?? ""} ${p.description ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sortedProjects, projectQuery]);

  const selectedProject = (allProjects as any[]).find((p) => p.id === effectiveProjectId);

  const myMember = useMemo(
    () => (members as any[]).find((m: any) => m.user_id === user?.id),
    [members, user]
  );
  const myRole = (myMember?.role as string | undefined) || (isPMO ? "member" : "member");

  const myName = useMemo(() => {
    if (profile) return `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || user?.email || "–";
    const u = (users as any[]).find((u: any) => u.user_id === user?.id);
    return u ? `${u.first_name} ${u.last_name}`.trim() : user?.email || "–";
  }, [profile, user, users]);

  const today = new Date();
  const todayStr = today.toLocaleDateString("de-DE");
  const { year: isoYear, week: isoWeek } = getISOWeek(today);

  const [form, setForm] = useState({
    completed_this_week: "",
    currently_working_on: "",
    next_steps: "",
    help_needed: "",
    risks: "",
    other_comments: "",
  });
  const [rating, setRating] = useState<1 | 2 | 3 | null>(null);

  const reset = () => {
    setForm({
      completed_this_week: "",
      currently_working_on: "",
      next_steps: "",
      help_needed: "",
      risks: "",
      other_comments: "",
    });
    setRating(null);
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (isPMO && !effectiveProjectId) {
      toast.error("Bitte ein Projekt auswählen");
      return;
    }
    if (!rating) {
      toast.error("Bitte eine Gesamtbewertung auswählen");
      return;
    }
    if (!form.completed_this_week.trim() && !form.currently_working_on.trim()) {
      toast.error("Bitte mindestens 'Abgeschlossen' oder 'Aktuell' ausfüllen");
      return;
    }
    try {
      await createMut.mutateAsync({
        project_id: effectiveProjectId,
        author_user_id: user.id,
        author_role_snapshot: myRole,
        iso_year: isoYear,
        iso_week: isoWeek,
        review_date: today.toISOString().slice(0, 10),
        ...form,
        overall_rating: rating,
      });
      toast.success("Weekly Review gespeichert");
      reset();
      onOpenChange(false);
    } catch (e: any) {
      if (e?.code === "23505" || /duplicate|unique/i.test(e?.message || "")) {
        toast.error("Für diese Kalenderwoche existiert bereits ein Review von dir");
      } else {
        toast.error(e?.message || "Fehler beim Speichern");
      }
    }
  };

  const flagBtn = (value: 1 | 2 | 3, count: number, color: string, label: string) => (
    <button
      type="button"
      onClick={() => setRating(value)}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border-2 px-4 py-3 transition-all",
        rating === value
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border hover:border-primary/40 hover:bg-muted/40"
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
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Weekly Review erstellen</DialogTitle>
          <DialogDescription>
            Kalenderwoche {isoWeek}/{isoYear} – die Antworten werden unveränderlich gespeichert.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isPMO && (
            <div className="space-y-1.5">
              <Label>Projekt</Label>
              <Popover
                open={projectPickerOpen}
                onOpenChange={(o) => { setProjectPickerOpen(o); if (!o) setProjectQuery(""); }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={projectPickerOpen}
                    className="w-full justify-between font-normal"
                  >
                    <span className={cn("truncate", !selectedProject && "text-muted-foreground")}>
                      {selectedProject
                        ? `${selectedProject.project_name || selectedProject.project_number}${selectedProject.project_name && selectedProject.project_number ? ` (${selectedProject.project_number})` : ""}`
                        : "Projekt auswählen…"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0"
                  align="start"
                  onOpenAutoFocus={(e) => {
                    e.preventDefault();
                    const el = (e.currentTarget as HTMLElement).querySelector<HTMLInputElement>("input");
                    el?.focus();
                  }}
                >
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        autoFocus
                        value={projectQuery}
                        onChange={(e) => setProjectQuery(e.target.value)}
                        placeholder="Projekt suchen…"
                        className="pl-9 h-9"
                      />
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {filteredProjects.length === 0 ? (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                        Keine Projekte gefunden
                      </div>
                    ) : (
                      filteredProjects.map((p: any) => {
                        const isSel = p.id === effectiveProjectId;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                              isSel && "bg-accent/50",
                            )}
                            onClick={() => {
                              setSelectedProjectId(p.id);
                              setProjectPickerOpen(false);
                            }}
                          >
                            <Check className={cn("h-4 w-4", isSel ? "opacity-100" : "opacity-0")} />
                            <span className="truncate">
                              {p.project_name || p.project_number}
                            </span>
                            {p.project_number && p.project_name ? (
                              <span className="ml-auto text-xs text-muted-foreground">{p.project_number}</span>
                            ) : null}
                          </button>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Read-only auto fields */}
          <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Datum</div>
              <div className="font-medium">{todayStr}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Mitarbeiter</div>
              <div className="font-medium truncate" title={myName}>{myName}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Projektrolle</div>
              <div className="font-medium">{ROLE_LABELS[myRole] ?? myRole}</div>
            </div>
          </div>

          {/* Questions */}
          {[
            { key: "completed_this_week", label: "Was hast du diese Woche abgeschlossen?" },
            { key: "currently_working_on", label: "Woran arbeitest du im Augenblick?" },
            { key: "next_steps", label: "Was machst du als nächstes?" },
            { key: "help_needed", label: "Benötigst du irgendwo Hilfe?" },
            { key: "risks", label: "Gibt es aktuelle Risiken im Projekt?" },
            { key: "other_comments", label: "Sonstige Kommentare / Anmerkungen" },
          ].map((q) => (
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

          {/* Rating */}
          <div className="space-y-2">
            <Label>Overall Projektbewertung</Label>
            <div className="flex gap-3">
              {flagBtn(1, 1, "#dc2626", "Schlecht")}
              {flagBtn(2, 2, "#eab308", "Mittel")}
              {flagBtn(3, 3, "#16a34a", "Gut")}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSubmit} disabled={createMut.isPending}>
            {createMut.isPending ? "Speichert..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
