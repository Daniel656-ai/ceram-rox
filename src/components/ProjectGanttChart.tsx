import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Flag, Target, CheckCircle2 } from "lucide-react";
import type { WorkPackage } from "@/hooks/useWorkPackages";

interface Milestone {
  id: string;
  title: string;
  description?: string | null;
  milestone_date?: string | null;
  status: "planned" | "in_progress" | "completed";
}

interface Dependency {
  id: string;
  predecessor_id: string;
  successor_id: string;
  dependency_type: "FS" | "FF" | "SS" | "SF";
  lag_days: number;
}

interface Props {
  workPackages: WorkPackage[];
  milestones: Milestone[];
  dependencies?: Dependency[];
  projectStart?: string | null;
  projectEnd?: string | null;
  users: any[];
}

const STATUS_BAR: Record<string, string> = {
  planned: "bg-primary/60 border-primary",
  in_progress: "bg-warning/70 border-warning",
  completed: "bg-success/70 border-success",
};

const STATUS_MARKER: Record<string, string> = {
  planned: "text-primary fill-primary",
  in_progress: "text-warning fill-warning",
  completed: "text-success fill-success",
};

const STATUS_ICONS: Record<string, any> = {
  planned: Flag,
  in_progress: Target,
  completed: CheckCircle2,
};

function getUserName(users: any[], userId: string) {
  const u = users.find((u: any) => u.user_id === userId);
  return u ? `${u.first_name} ${u.last_name}`.trim() : "";
}

function dayDiff(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

export function ProjectGanttChart({ workPackages, milestones, dependencies = [], projectStart, projectEnd, users }: Props) {
  const { t, i18n } = useTranslation("projects");
  const locale = i18n.language === "en" ? "en-GB" : "de-DE";

  const { rangeStart, rangeEnd, totalDays, monthMarks } = useMemo(() => {
    const dates: Date[] = [];
    if (projectStart) dates.push(new Date(projectStart));
    if (projectEnd) dates.push(new Date(projectEnd));
    for (const wp of workPackages) {
      if (wp.start_date) dates.push(new Date(wp.start_date));
      if (wp.end_date) dates.push(new Date(wp.end_date));
    }
    for (const m of milestones) {
      if (m.milestone_date) dates.push(new Date(m.milestone_date));
    }

    if (dates.length === 0) {
      const now = new Date();
      const end = new Date(now);
      end.setMonth(end.getMonth() + 3);
      return { rangeStart: now, rangeEnd: end, totalDays: dayDiff(end, now) || 1, monthMarks: [] };
    }

    let min = new Date(Math.min(...dates.map((d) => d.getTime())));
    let max = new Date(Math.max(...dates.map((d) => d.getTime())));
    // Pad 3 days each side
    min = new Date(min); min.setDate(min.getDate() - 3);
    max = new Date(max); max.setDate(max.getDate() + 3);

    const total = Math.max(dayDiff(max, min), 1);

    // Monthly grid marks
    const marks: { label: string; pos: number }[] = [];
    const cursor = new Date(min.getFullYear(), min.getMonth(), 1);
    while (cursor <= max) {
      const pos = (dayDiff(cursor, min) / total) * 100;
      if (pos >= 0 && pos <= 100) {
        marks.push({
          label: cursor.toLocaleDateString(locale, { month: "short", year: "2-digit" }),
          pos,
        });
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return { rangeStart: min, rangeEnd: max, totalDays: total, monthMarks: marks };
  }, [workPackages, milestones, projectStart, projectEnd, locale]);

  const hasContent = workPackages.length > 0 || milestones.length > 0;
  if (!hasContent) return null;

  const todayPos = (() => {
    const today = new Date();
    if (today < rangeStart || today > rangeEnd) return null;
    return (dayDiff(today, rangeStart) / totalDays) * 100;
  })();

  // Datable work packages first (with start AND end), then partials
  const sortedWps = [...workPackages].sort((a, b) => {
    if (!a.start_date) return 1;
    if (!b.start_date) return -1;
    return a.start_date.localeCompare(b.start_date);
  });

  const milestonesWithDate = milestones.filter((m) => m.milestone_date);
  const ROW_HEIGHT = 36;
  const HEADER_HEIGHT = 40;
  const MILESTONE_ROW_HEIGHT = 40;
  const totalHeight = HEADER_HEIGHT + sortedWps.length * ROW_HEIGHT + (milestonesWithDate.length > 0 ? MILESTONE_ROW_HEIGHT : 0);

  const wpIndex = new Map(sortedWps.map((w, i) => [w.id, i]));
  const wpPos = (id: string): { left: number; right: number; centerY: number } | null => {
    const idx = wpIndex.get(id);
    if (idx === undefined) return null;
    const wp = sortedWps[idx];
    if (!wp.start_date || !wp.end_date) return null;
    const start = new Date(wp.start_date);
    const end = new Date(wp.end_date);
    const left = (dayDiff(start, rangeStart) / totalDays) * 100;
    const width = Math.max(((dayDiff(end, start) + 1) / totalDays) * 100, 0.8);
    return { left, right: left + width, centerY: HEADER_HEIGHT + idx * ROW_HEIGHT + ROW_HEIGHT / 2 };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{t("gantt_title")}</span>
          <div className="flex items-center gap-3 text-xs font-normal text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary/60 border border-primary" />{t("gantt_legend_wp")}</span>
            <span className="flex items-center gap-1.5"><Flag className="h-3 w-3 fill-primary text-primary" />{t("gantt_legend_milestone")}</span>
            {todayPos !== null && (
              <span className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-destructive" />{t("gantt_legend_today")}</span>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={150}>
          <div className="overflow-x-auto">
            <div className="flex min-w-[700px]">
              {/* Left labels column */}
              <div className="w-48 shrink-0 border-r border-border" style={{ height: totalHeight }}>
                <div className="h-10 border-b border-border bg-muted/40 px-3 flex items-center text-xs font-medium text-muted-foreground">
                  {t("gantt_task")}
                </div>
                {sortedWps.map((wp) => (
                  <div key={wp.id} className="h-9 px-3 flex items-center text-sm border-b border-border/50 truncate" title={wp.title}>
                    {wp.title}
                  </div>
                ))}
                {milestonesWithDate.length > 0 && (
                  <div className="h-10 px-3 flex items-center text-xs font-medium text-muted-foreground border-b border-border bg-muted/40">
                    {t("tab_milestones")}
                  </div>
                )}
              </div>

              {/* Timeline area */}
              <div className="relative flex-1" style={{ height: totalHeight }}>
                {/* Month grid header */}
                <div className="relative h-10 border-b border-border bg-muted/40">
                  {monthMarks.map((m, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-l border-border/60 px-1 text-[10px] text-muted-foreground"
                      style={{ left: `${m.pos}%` }}
                    >
                      <span className="block mt-1">{m.label}</span>
                    </div>
                  ))}
                </div>

                {/* Vertical month gridlines through body */}
                <div className="absolute left-0 right-0 pointer-events-none" style={{ top: 40, bottom: 0 }}>
                  {monthMarks.map((m, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-l border-border/30"
                      style={{ left: `${m.pos}%` }}
                    />
                  ))}
                </div>

                {/* Today line */}
                {todayPos !== null && (
                  <div
                    className="absolute top-10 bottom-0 w-0.5 bg-destructive z-20 pointer-events-none"
                    style={{ left: `${todayPos}%` }}
                  />
                )}

                {/* Work package rows */}
                {sortedWps.map((wp, idx) => {
                  const top = HEADER_HEIGHT + idx * ROW_HEIGHT;
                  if (!wp.start_date || !wp.end_date) {
                    return (
                      <div
                        key={wp.id}
                        className="absolute left-0 right-0 border-b border-border/50 flex items-center px-2 text-xs text-muted-foreground italic"
                        style={{ top, height: ROW_HEIGHT }}
                      >
                        {t("gantt_no_dates")}
                      </div>
                    );
                  }
                  const start = new Date(wp.start_date);
                  const end = new Date(wp.end_date);
                  const left = (dayDiff(start, rangeStart) / totalDays) * 100;
                  const width = Math.max(((dayDiff(end, start) + 1) / totalDays) * 100, 0.8);
                  const linkedMs = wp.milestone_id
                    ? milestonesWithDate.find((m) => m.id === wp.milestone_id)
                    : null;
                  const linkedPos = linkedMs?.milestone_date
                    ? (dayDiff(new Date(linkedMs.milestone_date), rangeStart) / totalDays) * 100
                    : null;

                  return (
                    <div
                      key={wp.id}
                      className="absolute left-0 right-0 border-b border-border/50"
                      style={{ top, height: ROW_HEIGHT }}
                    >
                      {/* Dependency line: from end of bar to milestone */}
                      {linkedPos !== null && (
                        <div
                          className="absolute top-1/2 h-px border-t border-dashed border-muted-foreground/60"
                          style={{
                            left: `${Math.min(left + width, linkedPos)}%`,
                            width: `${Math.abs(linkedPos - (left + width))}%`,
                          }}
                        />
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`absolute top-1.5 bottom-1.5 rounded border ${STATUS_BAR[wp.status] || STATUS_BAR.planned} cursor-pointer hover:brightness-110 transition`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p className="font-semibold">{wp.title}</p>
                          {wp.description && <p className="text-xs mt-1 opacity-80">{wp.description}</p>}
                          <p className="text-xs mt-1">
                            {start.toLocaleDateString(locale)} – {end.toLocaleDateString(locale)}
                          </p>
                          {wp.assignees.length > 0 && (
                            <p className="text-xs mt-1">
                              {t("gantt_assignees")}: {wp.assignees.map((id) => getUserName(users, id)).filter(Boolean).join(", ")}
                            </p>
                          )}
                          {linkedMs && (
                            <p className="text-xs mt-1 opacity-80">→ {linkedMs.title}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  );
                })}

                {/* Milestone row */}
                {milestonesWithDate.length > 0 && (
                  <div
                    className="absolute left-0 right-0 border-b border-border bg-muted/20"
                    style={{ top: HEADER_HEIGHT + sortedWps.length * ROW_HEIGHT, height: MILESTONE_ROW_HEIGHT }}
                  >
                    {milestonesWithDate.map((m) => {
                      const date = new Date(m.milestone_date!);
                      const pos = (dayDiff(date, rangeStart) / totalDays) * 100;
                      const Icon = STATUS_ICONS[m.status] || Flag;
                      return (
                        <Tooltip key={m.id}>
                          <TooltipTrigger asChild>
                            <div
                              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                              style={{ left: `${pos}%` }}
                            >
                              <div className={`p-1 rounded-full bg-background border-2 ${m.status === "completed" ? "border-success" : m.status === "in_progress" ? "border-warning" : "border-primary"}`}>
                                <Icon className={`h-4 w-4 ${STATUS_MARKER[m.status] || STATUS_MARKER.planned}`} />
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="font-semibold">{m.title}</p>
                            <p className="text-xs mt-1">{date.toLocaleDateString(locale)}</p>
                            {m.description && <p className="text-xs mt-1 opacity-80">{m.description}</p>}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
