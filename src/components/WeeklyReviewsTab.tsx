import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, PanelsTopLeft } from "lucide-react";
import { useWeeklyReviews } from "@/hooks/useWeeklyReviews";
import { useUsers } from "@/hooks/useUsers";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { WeeklyReviewForm } from "./WeeklyReviewForm";
import { WeeklyReviewHistory, FlagBadge, RATING_META } from "./WeeklyReviewHistory";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Dot } from "recharts";
import { formatDateDE, formatDateWithWeek } from "@/lib/isoWeek";

interface Props {
  projectId: string;
}

export function WeeklyReviewsTab({ projectId }: Props) {
  const { user, customRoleName } = useAuth();
  const { hasPermission } = usePermissions();
  const isPMO = (customRoleName ?? "").trim().toLowerCase() === "pmo" || hasPermission("weekly_reviews.manage_all");
  const { data: reviews = [], isLoading } = useWeeklyReviews(projectId);
  const { data: users = [] } = useUsers();
  const { data: members = [] } = useProjectMembers(projectId);

  const [creating, setCreating] = useState(false);
  const [mobileView, setMobileView] = useState<"history" | "form">("form");
  const [authorFilter, setAuthorFilter] = useState<string>("__all__");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

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
        week: r.iso_week,
        year: r.iso_year,
        rating: r.overall_rating,
        author: userName(r.author_user_id),
        reason: r.rating_reason || "",
        comment: r.other_comments || r.currently_working_on || "",
      }));
  }, [reviews, users]);

  const currentRating = (reviews as any[])[0]?.overall_rating;

  const authorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    (reviews as any[]).forEach((r) => {
      if (!seen.has(r.author_user_id)) seen.set(r.author_user_id, userName(r.author_user_id));
    });
    return Array.from(seen.entries());
  }, [reviews, users]);

  const historyPanel = (
    <Card className="flex flex-col min-h-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Weekly-Review-Historie ({filtered.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 min-h-0">
        <div className="flex flex-wrap items-end gap-2">
          <Select value={authorFilter} onValueChange={setAuthorFilter}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Mitarbeiter</SelectItem>
              {authorOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-36 h-9" />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-36 h-9" />
          {(authorFilter !== "__all__" || fromDate || toDate) && (
            <Button variant="ghost" size="sm" onClick={() => { setAuthorFilter("__all__"); setFromDate(""); setToDate(""); }}>
              Zurücksetzen
            </Button>
          )}
        </div>
        <div className={creating ? "max-h-[70vh] overflow-y-auto pr-1" : ""}>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Lädt…</p>
          ) : (
            <WeeklyReviewHistory reviews={filtered} userName={userName} compact={creating} />
          )}
        </div>
      </CardContent>
    </Card>
  );

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
            creating ? (
              <div className="flex items-center gap-2">
                <div className="lg:hidden flex items-center gap-1">
                  <Button size="sm" variant={mobileView === "history" ? "default" : "outline"} onClick={() => setMobileView("history")}>
                    <PanelsTopLeft className="h-4 w-4 mr-1" />Historie
                  </Button>
                  <Button size="sm" variant={mobileView === "form" ? "default" : "outline"} onClick={() => setMobileView("form")}>
                    Neuer Review
                  </Button>
                </div>
                <Button variant="outline" onClick={() => setCreating(false)}>
                  <X className="h-4 w-4 mr-2" />Erstellung schließen
                </Button>
              </div>
            ) : (
              <Button onClick={() => { setCreating(true); setMobileView("form"); }}>
                <Plus className="h-4 w-4 mr-2" />
                Weekly Review erstellen
              </Button>
            )
          )}
        </CardContent>
      </Card>

      {/* Split-Ansicht: Historie links, neues Review rechts */}
      {creating ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className={mobileView === "history" ? "" : "hidden lg:block"}>{historyPanel}</div>
          <div className={mobileView === "form" ? "" : "hidden lg:block"}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Neues Weekly Review</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[70vh] overflow-y-auto">
                <WeeklyReviewForm
                  projectId={projectId}
                  existingReviews={reviews as any[]}
                  onSaved={() => setCreating(false)}
                  onCancel={() => setCreating(false)}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        historyPanel
      )}

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
                    tickFormatter={(d) => `${new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`}
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
                          <div className="font-medium">{formatDateWithWeek(p.date)}</div>
                          <div>{p.author}</div>
                          <div style={{ color: meta?.color }}>● {meta?.label}</div>
                          {p.reason && <div className="max-w-[220px]">Begründung: {p.reason}</div>}
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

      {/* Statusverlauf als Liste (KW, Bewertung, Begründung, Autor) */}
      <Card>
        <CardHeader><CardTitle className="text-base">Projektstatus – Chronologie</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(reviews as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Keine Einträge</p>
          ) : (
            (reviews as any[]).map((r) => (
              <div key={r.id} className="rounded-md border p-3 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">KW {r.iso_week}/{r.iso_year}</span>
                  <span className="text-muted-foreground">{formatDateDE(r.review_date)}</span>
                  <FlagBadge rating={r.overall_rating} />
                  <span className="text-xs text-muted-foreground">{userName(r.author_user_id)}</span>
                </div>
                {r.rating_reason?.trim() && (
                  <div className="text-xs whitespace-pre-wrap">
                    <span className="font-semibold text-muted-foreground">Begründung: </span>{r.rating_reason}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
