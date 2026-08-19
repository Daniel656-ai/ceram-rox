import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useWeeklyReviews } from "@/hooks/useWeeklyReviews";
import { useUsers } from "@/hooks/useUsers";
import { FlagBadge } from "@/components/WeeklyReviewHistory";
import { formatDateWithWeek, getISOWeek } from "@/lib/isoWeek";
import { CalendarClock, ClipboardCheck, Flag, Pencil } from "lucide-react";

export type HistoryEntryType = "weekly_review" | "status" | "date" | "milestone" | "other";

export interface ProjectHistoryEntry {
  id: string;
  at: string; // ISO timestamp
  type: HistoryEntryType;
  title: string;
  detail?: string;
  reason?: string;
  actor?: string;
  rating?: number;
  isoWeek?: number;
  isoYear?: number;
}

const FIELD_LABELS: Record<string, string> = {
  project_number: "Projektnummer geändert",
  project_name: "Projektname geändert",
  start_date: "Projektstart geändert",
  end_date: "Projektende geändert",
  milestone_date: "Meilensteintermin geändert",
  wp_start_date: "Arbeitspaket-Start geändert",
  wp_end_date: "Arbeitspaket-Ende geändert",
};

const TYPE_META: Record<HistoryEntryType, { label: string; icon: typeof Flag }> = {
  weekly_review: { label: "Weekly Review", icon: ClipboardCheck },
  status: { label: "Statusänderung", icon: Flag },
  date: { label: "Terminänderung", icon: CalendarClock },
  milestone: { label: "Meilensteinänderung", icon: CalendarClock },
  other: { label: "Änderung", icon: Pencil },
};

const DATE_FIELDS = new Set(["start_date", "end_date", "milestone_date", "wp_start_date", "wp_end_date"]);

function isDateLike(v?: string | null) {
  return !!v && /^\d{4}-\d{2}-\d{2}/.test(v);
}

function valueWithWeek(v?: string | null) {
  if (!v) return "–";
  return isDateLike(v) ? formatDateWithWeek(v) : v;
}

/** Baut die vereinheitlichte Projektchronologie (auch im Bericht verwendbar). */
export function buildProjectHistory(
  reviews: any[],
  changeLog: any[],
  userName: (id: string) => string
): ProjectHistoryEntry[] {
  const entries: ProjectHistoryEntry[] = [];

  for (const r of reviews) {
    entries.push({
      id: `wr-${r.id}`,
      at: r.created_at || `${r.review_date}T00:00:00Z`,
      type: "weekly_review",
      title: `Weekly Review – ${formatDateWithWeek(r.review_date)}`,
      detail: [r.completed_this_week, r.currently_working_on].filter((x: string) => x?.trim()).join("\n"),
      reason: r.rating_reason?.trim() || undefined,
      actor: userName(r.author_user_id),
      rating: r.overall_rating,
      isoWeek: r.iso_week,
      isoYear: r.iso_year,
    });
  }

  for (const c of changeLog) {
    const isDate = DATE_FIELDS.has(c.field_name);
    const type: HistoryEntryType =
      c.entity_type === "milestone" ? "milestone" : isDate ? "date" : "other";
    const label = FIELD_LABELS[c.field_name] ?? `${c.field_name} geändert`;
    const iso = isDateLike(c.new_value) ? getISOWeek(c.new_value) : null;
    entries.push({
      id: `cl-${c.id}`,
      at: c.created_at,
      type,
      title: c.entity_label ? `${label} – ${c.entity_label}` : label,
      detail: `${valueWithWeek(c.old_value)} → ${valueWithWeek(c.new_value)}`,
      reason: c.reason || undefined,
      actor: c.changed_by ? userName(c.changed_by) : undefined,
      isoWeek: iso?.week,
      isoYear: iso?.year,
    });
  }

  return entries.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
}

export function useProjectHistory(projectId?: string) {
  const { data: reviews = [] } = useWeeklyReviews(projectId);
  const { data: users = [] } = useUsers();
  const { data: changeLog = [] } = useQuery({
    queryKey: ["project-change-log", projectId],
    queryFn: () => api.projects.listChangeLog(projectId!),
    enabled: !!projectId,
  });

  const userName = (uid: string) => {
    const u = (users as any[]).find((u: any) => u.user_id === uid);
    return u ? `${u.first_name} ${u.last_name}`.trim() : "–";
  };

  return useMemo(
    () => buildProjectHistory(reviews as any[], changeLog as any[], userName),
    [reviews, changeLog, users] // eslint-disable-line react-hooks/exhaustive-deps
  );
}

const FILTERS: { value: "all" | HistoryEntryType; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "weekly_review", label: "Weekly Review" },
  { value: "date", label: "Terminänderung" },
  { value: "milestone", label: "Meilensteinänderung" },
  { value: "other", label: "Sonstige" },
];

/** Projektstatus & Änderungen – chronologische Projektentwicklung. */
export function ProjectHistoryTab({ projectId }: { projectId: string }) {
  const entries = useProjectHistory(projectId);
  const [filter, setFilter] = useState<"all" | HistoryEntryType>("all");

  const visible = filter === "all" ? entries : entries.filter((e) => e.type === filter);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="text-base">Projektstatus &amp; Änderungen</CardTitle>
        <div className="flex flex-wrap gap-1 print:hidden">
          {FILTERS.map((f) => (
            <Button key={f.value} size="sm" variant={filter === f.value ? "default" : "outline"} onClick={() => setFilter(f.value)}>
              {f.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Keine Einträge im Projektverlauf</p>
        ) : (
          visible.map((e) => {
            const meta = TYPE_META[e.type];
            const Icon = meta.icon;
            return (
              <div key={e.id} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </Badge>
                  {e.isoWeek != null && (
                    <span className="text-xs text-muted-foreground">KW {e.isoWeek}/{e.isoYear}</span>
                  )}
                  <span className="text-sm font-medium">{e.title}</span>
                  {e.rating != null && <FlagBadge rating={e.rating} />}
                </div>
                {e.detail?.trim() && <div className="text-sm whitespace-pre-wrap">{e.detail}</div>}
                {e.reason && (
                  <div className="text-xs">
                    <span className="font-semibold text-muted-foreground">Begründung: </span>
                    <span className="whitespace-pre-wrap">{e.reason}</span>
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground">
                  {e.actor ? `${e.actor} · ` : ""}
                  {e.at ? new Date(e.at).toLocaleString("de-DE") : ""}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

/** Kompakte Darstellung des Projektverlaufs für den Projektbericht (Druck). */
export function ProjectHistoryReportSection({ projectId }: { projectId: string }) {
  const entries = useProjectHistory(projectId);
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Änderungen protokolliert</p>;
  }
  return (
    <div className="space-y-1 text-sm">
      {entries.map((e) => (
        <div key={e.id} className="flex flex-wrap gap-x-2 border-b py-1 break-inside-avoid">
          <span className="text-muted-foreground w-32 shrink-0">
            {e.at ? new Date(e.at).toLocaleDateString("de-DE") : ""}
            {e.isoWeek != null ? ` · KW ${e.isoWeek}` : ""}
          </span>
          <span className="font-medium">{TYPE_META[e.type].label}:</span>
          <span>{e.title}</span>
          {e.detail?.trim() && <span className="text-muted-foreground">— {e.detail.replace(/\n/g, " / ")}</span>}
          {e.reason && <span className="italic">(Begründung: {e.reason})</span>}
          {e.actor && <span className="text-muted-foreground">· {e.actor}</span>}
        </div>
      ))}
    </div>
  );
}
