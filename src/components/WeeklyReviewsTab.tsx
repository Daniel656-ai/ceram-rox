import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Flag, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { useWeeklyReviews } from "@/hooks/useWeeklyReviews";
import { useUsers } from "@/hooks/useUsers";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { useAuth } from "@/contexts/AuthContext";
import { WeeklyReviewDialog } from "./WeeklyReviewDialog";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Dot } from "recharts";
import { cn } from "@/lib/utils";

const RATING_META: Record<number, { label: string; color: string }> = {
  1: { label: "Schlecht", color: "#dc2626" },
  2: { label: "Mittel", color: "#eab308" },
  3: { label: "Gut", color: "#16a34a" },
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Projekteigner",
  leader: "Projektleiter",
  member: "Projektmitarbeiter",
};

function FlagBadge({ rating }: { rating: number }) {
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

interface Props {
  projectId: string;
}

export function WeeklyReviewsTab({ projectId }: Props) {
  const { user, customRoleName } = useAuth();
  const isPMO = (customRoleName ?? "").trim().toLowerCase() === "pmo";
  const { data: reviews = [], isLoading } = useWeeklyReviews(projectId);
  const { data: users = [] } = useUsers();
  const { data: members = [] } = useProjectMembers(projectId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [authorFilter, setAuthorFilter] = useState<string>("__all__");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const isMember = useMemo(
    () => (members as any[]).some((m: any) => m.user_id === user?.id),
    [members, user]
  );

  const userName = (uid: string) => {
    const u = (users as any[]).find((u: any) => u.user_id === uid);
    return u ? `${u.first_name} ${u.last_name}`.trim() : "–";
  };

  const filtered = useMemo(() => {
    return (reviews as any[]).filter((r) => {
      if (authorFilter !== "__all__" && r.author_user_id !== authorFilter) return false;
      if (fromDate && r.review_date < fromDate) return false;
      if (toDate && r.review_date > toDate) return false;
      return true;
    });
  }, [reviews, authorFilter, fromDate, toDate]);

  const chartData = useMemo(() => {
    return [...(reviews as any[])]
      .sort((a, b) => a.review_date.localeCompare(b.review_date))
      .map((r) => ({
        date: r.review_date,
        rating: r.overall_rating,
        author: userName(r.author_user_id),
        comment: r.other_comments || r.currently_working_on || "",
      }));
  }, [reviews, users]);

  const currentRating = (reviews as any[])[0]?.overall_rating;

  const toggle = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  const authorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    (reviews as any[]).forEach((r) => {
      if (!seen.has(r.author_user_id)) seen.set(r.author_user_id, userName(r.author_user_id));
    });
    return Array.from(seen.entries());
  }, [reviews, users]);

  return (
    <div className="space-y-4">
      {/* Header / Actions */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Weekly Reviews</h3>
            {currentRating != null && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Aktueller Status:</span>
                <FlagBadge rating={currentRating} />
              </div>
            )}
          </div>
          {(isMember || isPMO) && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Weekly Review erstellen
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Mitarbeiter</label>
            <Select value={authorFilter} onValueChange={setAuthorFilter}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Alle Mitarbeiter</SelectItem>
                {authorOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Von</label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Bis</label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
          </div>
          {(authorFilter !== "__all__" || fromDate || toDate) && (
            <Button variant="ghost" size="sm" onClick={() => { setAuthorFilter("__all__"); setFromDate(""); setToDate(""); }}>
              Filter zurücksetzen
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Reviews list */}
      <Card>
        <CardHeader><CardTitle className="text-base">Verlauf ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Lädt…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Keine Weekly Reviews vorhanden</p>
          ) : (
            filtered.map((r) => {
              const isOpen = expanded.has(r.id);
              return (
                <div key={r.id} className="rounded-lg border bg-card">
                  <button
                    type="button"
                    className="w-full flex flex-wrap items-center justify-between gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => toggle(r.id)}
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="font-medium">{new Date(r.review_date).toLocaleDateString("de-DE")}</span>
                      <span className="text-xs text-muted-foreground">KW {r.iso_week}/{r.iso_year}</span>
                      <span className="text-sm">{userName(r.author_user_id)}</span>
                      <Badge variant="secondary" className="text-xs">{ROLE_LABELS[r.author_role_snapshot] ?? r.author_role_snapshot}</Badge>
                    </div>
                    <FlagBadge rating={r.overall_rating} />
                  </button>
                  {isOpen && (
                    <div className="border-t p-4 space-y-3 text-sm bg-muted/10">
                      {[
                        ["Diese Woche abgeschlossen", r.completed_this_week],
                        ["Aktuell in Arbeit", r.currently_working_on],
                        ["Nächste Schritte", r.next_steps],
                        ["Benötigte Hilfe", r.help_needed],
                        ["Risiken", r.risks],
                        ["Kommentare", r.other_comments],
                      ].map(([label, val]) => (
                        <div key={label as string}>
                          <div className="text-xs font-semibold text-muted-foreground">{label}</div>
                          <div className="whitespace-pre-wrap">{(val as string)?.trim() || "–"}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Trend chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">Projektstatus Verlauf</CardTitle></CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Noch keine Datenpunkte</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                    fontSize={12}
                  />
                  <YAxis
                    domain={[0.5, 3.5]}
                    ticks={[1, 2, 3]}
                    tickFormatter={(v) => RATING_META[v]?.label ?? ""}
                    fontSize={12}
                    width={80}
                  />
                  <ReferenceLine y={1} stroke="#dc2626" strokeDasharray="2 4" />
                  <ReferenceLine y={2} stroke="#eab308" strokeDasharray="2 4" />
                  <ReferenceLine y={3} stroke="#16a34a" strokeDasharray="2 4" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p: any = payload[0].payload;
                      const meta = RATING_META[p.rating];
                      return (
                        <div className="rounded-lg border bg-popover p-2 shadow-md text-xs space-y-0.5">
                          <div className="font-medium">{new Date(p.date).toLocaleDateString("de-DE")}</div>
                          <div>{p.author}</div>
                          <div style={{ color: meta?.color }}>● {meta?.label}</div>
                          {p.comment && <div className="text-muted-foreground max-w-[200px] line-clamp-3">{p.comment}</div>}
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rating"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={(props: any) => {
                      const { cx, cy, payload, index } = props;
                      const color = RATING_META[payload.rating]?.color || "#888";
                      return <Dot key={index} cx={cx} cy={cy} r={5} fill={color} stroke={color} />;
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <WeeklyReviewDialog projectId={projectId} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
