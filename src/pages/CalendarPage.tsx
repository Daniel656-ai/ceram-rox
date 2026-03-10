import { useState, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isWithinInterval,
  parseISO,
} from "date-fns";
import { de } from "date-fns/locale";
import { isWorkingDay, getHolidaysInRange, getHolidaySet } from "@/lib/austrian-holidays";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAbsences, useCreateAbsence, useUpdateAbsence, useDeleteAbsence, type UserAbsence } from "@/hooks/useAbsences";
import { useDowntimes, useCreateDowntime, useUpdateDowntime, useDeleteDowntime, type WorkstationDowntime } from "@/hooks/useDowntimes";
import { useWorkstations } from "@/hooks/useWorkstations";
import { useUsers } from "@/hooks/useUsers";

type ViewMode = "month" | "week" | "day";
type EventFilter = "all" | "absences" | "downtimes";

const ABSENCE_LABELS: Record<UserAbsence["absence_type"], string> = {
  urlaub: "Urlaub",
  krankheit: "Krankheit",
  weiterbildung: "Weiterbildung",
  sonstiges: "Sonstiges",
};

const DOWNTIME_LABELS: Record<WorkstationDowntime["downtime_type"], string> = {
  wartung: "Geplante Wartung",
  reparatur: "Ungeplante Reparatur",
  sonstiges: "Sonstiger Stillstand",
};

const STATUS_LABELS: Record<WorkstationDowntime["status"], string> = {
  geplant: "Geplant",
  aktiv: "Aktiv",
  abgeschlossen: "Abgeschlossen",
};

interface CalendarEvent {
  id: string;
  type: "absence" | "downtime";
  label: string;
  subLabel: string;
  start: Date;
  end: Date;
  colorClass: string;
  raw: UserAbsence | WorkstationDowntime;
}

export default function CalendarPage() {
  const { user, role } = useAuth();
  const isMaster = role === "master";

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [wsFilter, setWsFilter] = useState<string>("all");

  // Dialogs
  const [absenceDialogOpen, setAbsenceDialogOpen] = useState(false);
  const [downtimeDialogOpen, setDowntimeDialogOpen] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<UserAbsence | null>(null);
  const [editingDowntime, setEditingDowntime] = useState<WorkstationDowntime | null>(null);

  // Data
  const { data: absences = [] } = useAbsences();
  const { data: downtimes = [] } = useDowntimes();
  const { data: workstations = [] } = useWorkstations();
  const { data: users = [] } = useUsers();
  const createAbsence = useCreateAbsence();
  const updateAbsence = useUpdateAbsence();
  const deleteAbsence = useDeleteAbsence();
  const createDowntime = useCreateDowntime();
  const updateDowntime = useUpdateDowntime();
  const deleteDowntime = useDeleteDowntime();

  // Form state - absence
  const [absForm, setAbsForm] = useState({
    user_id: "",
    absence_type: "urlaub" as UserAbsence["absence_type"],
    start_at: "",
    end_at: "",
    comment: "",
  });

  // Form state - downtime
  const [dtForm, setDtForm] = useState({
    workstation_id: "",
    downtime_type: "wartung" as WorkstationDowntime["downtime_type"],
    status: "geplant" as WorkstationDowntime["status"],
    start_at: "",
    end_at: "",
    description: "",
  });

  const getUserName = (userId: string) => {
    const u = users.find((u: any) => u.user_id === userId);
    return u ? `${u.first_name} ${u.last_name}` : "Unbekannt";
  };

  const getWsName = (wsId: string) => {
    const ws = workstations.find((w) => w.id === wsId);
    return ws?.name ?? "Unbekannt";
  };

  // Build events
  const events: CalendarEvent[] = useMemo(() => {
    const result: CalendarEvent[] = [];

    if (eventFilter !== "downtimes") {
      absences
        .filter((a) => userFilter === "all" || a.user_id === userFilter)
        .forEach((a) => {
          result.push({
            id: a.id,
            type: "absence",
            label: getUserName(a.user_id),
            subLabel: ABSENCE_LABELS[a.absence_type],
            start: parseISO(a.start_at),
            end: parseISO(a.end_at),
            colorClass:
              a.absence_type === "krankheit"
                ? "bg-destructive/80 text-destructive-foreground"
                : a.absence_type === "urlaub"
                ? "bg-destructive/60 text-destructive-foreground"
                : "bg-warning/70 text-warning-foreground",
            raw: a,
          });
        });
    }

    if (eventFilter !== "absences") {
      downtimes
        .filter((d) => wsFilter === "all" || d.workstation_id === wsFilter)
        .forEach((d) => {
          result.push({
            id: d.id,
            type: "downtime",
            label: getWsName(d.workstation_id),
            subLabel: DOWNTIME_LABELS[d.downtime_type],
            start: parseISO(d.start_at),
            end: parseISO(d.end_at),
            colorClass:
              d.downtime_type === "reparatur"
                ? "bg-destructive text-destructive-foreground"
                : d.downtime_type === "wartung"
                ? "bg-warning text-warning-foreground"
                : "bg-muted text-muted-foreground",
            raw: d,
          });
        });
    }

    return result;
  }, [absences, downtimes, eventFilter, userFilter, wsFilter, users, workstations]);

  // Calendar days
  const days = useMemo(() => {
    if (viewMode === "month") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      return eachDayOfInterval({
        start: startOfWeek(monthStart, { locale: de }),
        end: endOfWeek(monthEnd, { locale: de }),
      });
    }
    if (viewMode === "week") {
      return eachDayOfInterval({
        start: startOfWeek(currentDate, { locale: de }),
        end: endOfWeek(currentDate, { locale: de }),
      });
    }
    return [currentDate];
  }, [currentDate, viewMode]);

  const navigate = (dir: 1 | -1) => {
    if (viewMode === "month") setCurrentDate(dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(dir === 1 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else setCurrentDate(dir === 1 ? addDays(currentDate, 1) : subDays(currentDate, 1));
  };

  const eventsForDay = (day: Date) =>
    events.filter(
      (e) =>
        isWithinInterval(day, { start: e.start, end: e.end }) ||
        isSameDay(day, e.start) ||
        isSameDay(day, e.end)
    );

  // Absence dialog
  const openAbsenceDialog = (absence?: UserAbsence) => {
    if (absence) {
      setEditingAbsence(absence);
      setAbsForm({
        user_id: absence.user_id,
        absence_type: absence.absence_type,
        start_at: absence.start_at.slice(0, 16),
        end_at: absence.end_at.slice(0, 16),
        comment: absence.comment ?? "",
      });
    } else {
      setEditingAbsence(null);
      setAbsForm({
        user_id: user?.id ?? "",
        absence_type: "urlaub",
        start_at: "",
        end_at: "",
        comment: "",
      });
    }
    setAbsenceDialogOpen(true);
  };

  const saveAbsence = async () => {
    if (!absForm.start_at || !absForm.end_at) {
      toast({ title: "Bitte Start und Ende angeben", variant: "destructive" });
      return;
    }
    try {
      if (editingAbsence) {
        await updateAbsence.mutateAsync({ id: editingAbsence.id, ...absForm });
        toast({ title: "Abwesenheit aktualisiert" });
      } else {
        await createAbsence.mutateAsync({
          user_id: absForm.user_id || user!.id,
          absence_type: absForm.absence_type,
          start_at: new Date(absForm.start_at).toISOString(),
          end_at: new Date(absForm.end_at).toISOString(),
          comment: absForm.comment || undefined,
        });
        toast({ title: "Abwesenheit eingetragen" });
      }
      setAbsenceDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
  };

  // Downtime dialog
  const openDowntimeDialog = (dt?: WorkstationDowntime) => {
    if (dt) {
      setEditingDowntime(dt);
      setDtForm({
        workstation_id: dt.workstation_id,
        downtime_type: dt.downtime_type,
        status: dt.status,
        start_at: dt.start_at.slice(0, 16),
        end_at: dt.end_at.slice(0, 16),
        description: dt.description ?? "",
      });
    } else {
      setEditingDowntime(null);
      setDtForm({
        workstation_id: workstations[0]?.id ?? "",
        downtime_type: "wartung",
        status: "geplant",
        start_at: "",
        end_at: "",
        description: "",
      });
    }
    setDowntimeDialogOpen(true);
  };

  const saveDowntime = async () => {
    if (!dtForm.start_at || !dtForm.end_at || !dtForm.workstation_id) {
      toast({ title: "Bitte alle Pflichtfelder ausfüllen", variant: "destructive" });
      return;
    }
    try {
      if (editingDowntime) {
        await updateDowntime.mutateAsync({ id: editingDowntime.id, ...dtForm });
        toast({ title: "Stillstand aktualisiert" });
      } else {
        await createDowntime.mutateAsync({
          ...dtForm,
          start_at: new Date(dtForm.start_at).toISOString(),
          end_at: new Date(dtForm.end_at).toISOString(),
          created_by: user!.id,
        });
        toast({ title: "Stillstand eingetragen" });
      }
      setDowntimeDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
  };

  const headerLabel = () => {
    if (viewMode === "month") return format(currentDate, "MMMM yyyy", { locale: de });
    if (viewMode === "week") {
      const ws = startOfWeek(currentDate, { locale: de });
      const we = endOfWeek(currentDate, { locale: de });
      return `${format(ws, "d. MMM", { locale: de })} – ${format(we, "d. MMM yyyy", { locale: de })}`;
    }
    return format(currentDate, "EEEE, d. MMMM yyyy", { locale: de });
  };

  const durchfuehrerUsers = users.filter((u: any) => {
    const r = u.user_roles?.[0]?.role;
    return r === "durchfuehrer" || r === "master";
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">Kalender & Verfügbarkeit</h1>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => openAbsenceDialog()}>
            <Plus className="h-4 w-4 mr-1" /> Abwesenheit
          </Button>
          {isMaster && (
            <Button size="sm" variant="outline" onClick={() => openDowntimeDialog()}>
              <Plus className="h-4 w-4 mr-1" /> Stillstand
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-4 items-end">
          <div>
            <Label className="text-xs text-muted-foreground">Ansicht</Label>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="month">Monat</TabsTrigger>
                <TabsTrigger value="week">Woche</TabsTrigger>
                <TabsTrigger value="day">Tag</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="w-40">
            <Label className="text-xs text-muted-foreground">Ereignistyp</Label>
            <Select value={eventFilter} onValueChange={(v) => setEventFilter(v as EventFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="absences">Abwesenheiten</SelectItem>
                <SelectItem value="downtimes">Stillstände</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Label className="text-xs text-muted-foreground">Messtechniker</Label>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {durchfuehrerUsers.map((u: any) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.first_name} {u.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Label className="text-xs text-muted-foreground">Messplatz</Label>
            <Select value={wsFilter} onValueChange={setWsFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {workstations.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Calendar header nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold capitalize">{headerLabel()}</h2>
        <Button variant="ghost" size="icon" onClick={() => navigate(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-destructive/60" /> Urlaub</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-destructive/80" /> Krankheit</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-warning/70" /> Weiterbildung/Sonstiges</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-warning" /> Wartung</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-destructive" /> Reparatur</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary/20 border border-primary/30" /> Feiertag (AT)</span>
      </div>

      {/* Calendar grid */}
      <Card>
        <CardContent className="p-0">
          {viewMode === "month" && (() => {
            const monthStart = startOfMonth(currentDate);
            const monthEnd = endOfMonth(currentDate);
            const rangeStart = startOfWeek(monthStart, { locale: de });
            const rangeEnd = endOfWeek(monthEnd, { locale: de });
            const holidaysInView = getHolidaysInRange(rangeStart, rangeEnd);
            const holidayMap = new Map(holidaysInView.map(h => [format(h.date, "yyyy-MM-dd"), h.name]));
            const holidaySet = getHolidaySet(currentDate.getFullYear(), [currentDate.getFullYear() - 1, currentDate.getFullYear() + 1]);

            return (
            <div className="grid grid-cols-7">
              {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
                <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground border-b border-border">
                  {d}
                </div>
              ))}
              {days.map((day) => {
                const dayEvents = eventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, new Date());
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const holidayName = holidayMap.get(format(day, "yyyy-MM-dd"));
                const isHoliday = !!holidayName;
                const isNonWorking = isWeekend || isHoliday;
                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[100px] border-b border-r border-border p-1 ${
                      !isCurrentMonth ? "bg-muted/30" : ""
                    } ${isToday ? "bg-accent/10" : ""} ${isNonWorking && isCurrentMonth ? "bg-primary/5" : ""} ${isWeekend && isCurrentMonth ? "bg-muted/40" : ""}`}
                  >
                    <div className={`text-xs font-medium mb-1 flex items-center gap-1 ${isToday ? "text-accent" : isCurrentMonth ? "text-foreground" : "text-muted-foreground"}`}>
                      {format(day, "d")}
                      {isHoliday && (
                        <span className="text-[9px] bg-primary/20 text-primary px-1 rounded truncate max-w-[80px]" title={holidayName}>
                          {holidayName}
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <Tooltip key={ev.id}>
                          <TooltipTrigger asChild>
                            <button
                              className={`w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded truncate ${ev.colorClass}`}
                              onClick={() => {
                                if (ev.type === "absence") openAbsenceDialog(ev.raw as UserAbsence);
                                else openDowntimeDialog(ev.raw as WorkstationDowntime);
                              }}
                            >
                              {ev.label}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="font-medium">{ev.label}</p>
                            <p className="text-xs">{ev.subLabel}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(ev.start, "dd.MM.yy HH:mm")} – {format(ev.end, "dd.MM.yy HH:mm")}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] text-muted-foreground px-1">
                          +{dayEvents.length - 3} mehr
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            );
          })()}

          {(viewMode === "week" || viewMode === "day") && (
            <div className={`grid ${viewMode === "week" ? "grid-cols-7" : "grid-cols-1"} divide-x divide-border`}>
              {days.map((day) => {
                const dayEvents = eventsForDay(day);
                const isToday = isSameDay(day, new Date());
                return (
                  <div key={day.toISOString()} className={`min-h-[300px] p-2 ${isToday ? "bg-accent/10" : ""}`}>
                    <div className={`text-sm font-medium mb-2 ${isToday ? "text-accent" : "text-foreground"}`}>
                      {format(day, "EEE d. MMM", { locale: de })}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.map((ev) => (
                        <Tooltip key={ev.id}>
                          <TooltipTrigger asChild>
                            <button
                              className={`w-full text-left text-xs px-2 py-1 rounded ${ev.colorClass}`}
                              onClick={() => {
                                if (ev.type === "absence") openAbsenceDialog(ev.raw as UserAbsence);
                                else openDowntimeDialog(ev.raw as WorkstationDowntime);
                              }}
                            >
                              <div className="font-medium truncate">{ev.label}</div>
                              <div className="opacity-80 truncate">{ev.subLabel}</div>
                              <div className="opacity-70">
                                {format(ev.start, "HH:mm")} – {format(ev.end, "HH:mm")}
                              </div>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p className="font-medium">{ev.label}</p>
                            <p className="text-xs">{ev.subLabel}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(ev.start, "dd.MM.yy HH:mm")} – {format(ev.end, "dd.MM.yy HH:mm")}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {dayEvents.length === 0 && (
                        <div className="text-xs text-muted-foreground italic">Keine Ereignisse</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Absence Dialog */}
      <Dialog open={absenceDialogOpen} onOpenChange={setAbsenceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAbsence ? "Abwesenheit bearbeiten" : "Neue Abwesenheit"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isMaster && (
              <div>
                <Label>Messtechniker</Label>
                <Select value={absForm.user_id || user?.id} onValueChange={(v) => setAbsForm((p) => ({ ...p, user_id: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {durchfuehrerUsers.map((u: any) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.first_name} {u.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Typ</Label>
              <Select value={absForm.absence_type} onValueChange={(v) => setAbsForm((p) => ({ ...p, absence_type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="urlaub">Urlaub</SelectItem>
                  <SelectItem value="krankheit">Krankheit</SelectItem>
                  <SelectItem value="weiterbildung">Weiterbildung</SelectItem>
                  <SelectItem value="sonstiges">Sonstiges</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start</Label>
                <Input type="datetime-local" value={absForm.start_at} onChange={(e) => setAbsForm((p) => ({ ...p, start_at: e.target.value }))} />
              </div>
              <div>
                <Label>Ende</Label>
                <Input type="datetime-local" value={absForm.end_at} onChange={(e) => setAbsForm((p) => ({ ...p, end_at: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Kommentar (optional)</Label>
              <Textarea value={absForm.comment} onChange={(e) => setAbsForm((p) => ({ ...p, comment: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            {editingAbsence && (isMaster || editingAbsence.user_id === user?.id) && (
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await deleteAbsence.mutateAsync(editingAbsence.id);
                  setAbsenceDialogOpen(false);
                  toast({ title: "Abwesenheit gelöscht" });
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Löschen
              </Button>
            )}
            <Button onClick={saveAbsence} disabled={createAbsence.isPending || updateAbsence.isPending}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Downtime Dialog */}
      <Dialog open={downtimeDialogOpen} onOpenChange={setDowntimeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDowntime ? "Stillstand bearbeiten" : "Neuer Stillstand"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Messplatz</Label>
              <Select value={dtForm.workstation_id} onValueChange={(v) => setDtForm((p) => ({ ...p, workstation_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {workstations.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Typ</Label>
                <Select value={dtForm.downtime_type} onValueChange={(v) => setDtForm((p) => ({ ...p, downtime_type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wartung">Geplante Wartung</SelectItem>
                    <SelectItem value="reparatur">Ungeplante Reparatur</SelectItem>
                    <SelectItem value="sonstiges">Sonstiges</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={dtForm.status} onValueChange={(v) => setDtForm((p) => ({ ...p, status: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geplant">Geplant</SelectItem>
                    <SelectItem value="aktiv">Aktiv</SelectItem>
                    <SelectItem value="abgeschlossen">Abgeschlossen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start</Label>
                <Input type="datetime-local" value={dtForm.start_at} onChange={(e) => setDtForm((p) => ({ ...p, start_at: e.target.value }))} />
              </div>
              <div>
                <Label>Ende</Label>
                <Input type="datetime-local" value={dtForm.end_at} onChange={(e) => setDtForm((p) => ({ ...p, end_at: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Beschreibung (optional)</Label>
              <Textarea value={dtForm.description} onChange={(e) => setDtForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            {editingDowntime && isMaster && (
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await deleteDowntime.mutateAsync(editingDowntime.id);
                  setDowntimeDialogOpen(false);
                  toast({ title: "Stillstand gelöscht" });
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Löschen
              </Button>
            )}
            <Button onClick={saveDowntime} disabled={createDowntime.isPending || updateDowntime.isPending}>
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
