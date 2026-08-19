import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Flag } from "lucide-react";
import { formatDateDE, weekKey } from "@/lib/isoWeek";

export const RATING_META: Record<number, { label: string; color: string }> = {
  1: { label: "Schlecht", color: "#dc2626" },
  2: { label: "Mittel", color: "#eab308" },
  3: { label: "Gut", color: "#16a34a" },
};

export const ROLE_LABELS: Record<string, string> = {
  owner: "Projekteigner",
  leader: "Projektleiter",
  member: "Projektmitarbeiter",
};

export function FlagBadge({ rating }: { rating: number }) {
  const meta = RATING_META[rating];
  if (!meta) return null;
  return (
    <Badge variant="outline" className="gap-1" style={{ borderColor: meta.color, color: meta.color }}>
      <div className="flex">
        {Array.from({ length: rating }).map((_, i) => (
          <Flag key={i} className="h-3 w-3" style={{ fill: meta.color }} />
        ))}
      </div>
      <span>{meta.label}</span>
    </Badge>
  );
}

const FIELDS: [string, string][] = [
  ["Aktivitäten der Woche", "completed_this_week"],
  ["Aktuell in Arbeit", "currently_working_on"],
  ["Nächste Schritte", "next_steps"],
  ["Benötigte Hilfe", "help_needed"],
  ["Risiken", "risks"],
  ["Kommentare", "other_comments"],
];

interface Props {
  reviews: any[];
  userName: (id: string) => string;
  /** Kompakte Darstellung für die Split-Ansicht. */
  compact?: boolean;
}

/**
 * Weekly-Review-Historie, gruppiert nach Kalenderwoche und
 * innerhalb einer KW chronologisch (neueste zuerst).
 */
export function WeeklyReviewHistory({ reviews, userName, compact = false }: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, { year: number; week: number; items: any[] }>();
    for (const r of reviews) {
      const key = weekKey(r.iso_year, r.iso_week);
      if (!map.has(key)) map.set(key, { year: r.iso_year, week: r.iso_week, items: [] });
      map.get(key)!.items.push(r);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, g]) => ({
        key,
        ...g,
        items: [...g.items].sort(
          (a, b) => b.review_date.localeCompare(a.review_date) || (b.created_at ?? "").localeCompare(a.created_at ?? "")
        ),
      }));
  }, [reviews]);

  // Neueste KW standardmäßig geöffnet, ältere eingeklappt
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) => {
    const next = new Set(toggled);
    next.has(key) ? next.delete(key) : next.add(key);
    setToggled(next);
  };
  const groupOpen = (key: string, index: number) => (index === 0 ? !toggled.has(key) : toggled.has(key));


  if (reviews.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">Keine Weekly Reviews vorhanden</p>;
  }

  return (
    <div className="space-y-3">
      {groups.map((g, gi) => {
        const open = groupOpen(g.key, gi);
        return (
          <div key={g.key} className="rounded-lg border bg-card">
            <button
              type="button"
              onClick={() => toggleGroup(g.key)}
              className="w-full flex items-center justify-between gap-2 p-2.5 text-left hover:bg-muted/30 transition-colors"
            >
              <span className="flex items-center gap-2 font-medium text-sm">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                KW {g.week}/{g.year}
              </span>
              <span className="text-xs text-muted-foreground">{g.items.length} Review(s)</span>
            </button>
            {open && (
              <div className="border-t divide-y">
                {g.items.map((r) => (
                  <div key={r.id} className="p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{formatDateDE(r.review_date)}</span>
                      <FlagBadge rating={r.overall_rating} />
                      <span className="text-xs text-muted-foreground">{userName(r.author_user_id)}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {ROLE_LABELS[r.author_role_snapshot] ?? r.author_role_snapshot}
                      </Badge>
                    </div>
                    {r.rating_reason?.trim() && (
                      <div className="text-xs">
                        <span className="font-semibold text-muted-foreground">Begründung: </span>
                        <span className="whitespace-pre-wrap">{r.rating_reason}</span>
                      </div>
                    )}
                    <div className={compact ? "space-y-1.5" : "space-y-2"}>
                      {FIELDS.filter(([, key]) => (r[key] ?? "").trim()).map(([label, key]) => (
                        <div key={key} className="text-xs">
                          <div className="font-semibold text-muted-foreground">{label}</div>
                          <div className="whitespace-pre-wrap">{r[key]}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
