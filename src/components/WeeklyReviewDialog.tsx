import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Flag } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjectMembers } from "@/hooks/useProjectMembers";
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
  const { user, profile } = useAuth();
  const { data: members = [] } = useProjectMembers(projectId);
  const { data: users = [] } = useUsers();
  const createMut = useCreateWeeklyReview();

  const myMember = useMemo(
    () => (members as any[]).find((m: any) => m.user_id === user?.id),
    [members, user]
  );
  const myRole = (myMember?.role as string | undefined) || "member";

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
        project_id: projectId,
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
