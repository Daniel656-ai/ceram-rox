import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { de, enGB } from "date-fns/locale";
import { useUsers } from "@/hooks/useUsers";
import {
  useProjectTimeEntries,
  useAddProjectTimeEntry,
  useAddProjectMeetingEntry,
  useUpdateProjectTimeEntry,
  useDeleteProjectTimeEntry,
} from "@/hooks/useProjectTimeEntries";
import { useWorkPackages } from "@/hooks/useWorkPackages";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Clock, Users, Search, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { PersonSelect } from "@/components/PersonSelect";
import { useAuth } from "@/contexts/AuthContext";
import { sortAndFilterPersons, getPersonDisplayName } from "@/lib/personSearch";

interface Props {
  projectId: string;
  orderId?: string;
}

const DURATION_OPTIONS = Array.from({ length: 32 }, (_, i) => (i + 1) * 15);

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function getUserName(users: any[], userId: string) {
  const u = users.find((u: any) => u.user_id === userId);
  return u ? `${u.first_name} ${u.last_name}`.trim() || "–" : "–";
}

export function ProjectTimeEntries({ projectId, orderId }: Props) {
  const { t, i18n } = useTranslation("projects");
  const { user } = useAuth();
  const { data: entries = [] } = useProjectTimeEntries(projectId, orderId);
  const { data: users = [] } = useUsers();
  const { data: workPackages = [] } = useWorkPackages(projectId);
  const addEntry = useAddProjectTimeEntry();
  const addMeeting = useAddProjectMeetingEntry();
  const updateEntry = useUpdateProjectTimeEntry();
  const deleteEntry = useDeleteProjectTimeEntry();

  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"individual" | "meeting">("individual");
  const [meetingPersonIds, setMeetingPersonIds] = useState<string[]>([]);
  const [meetingQuery, setMeetingQuery] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Vorbelegung: wenn nur genau ein aktives AP existiert, dieses auswählen.
  const defaultWpId = useMemo(() => {
    const active = (workPackages as any[]).filter((w) => w.status !== "completed");
    return active.length === 1 ? active[0].id : "";
  }, [workPackages]);

  const [form, setForm] = useState({
    person_id: user?.id || "",
    entry_date: new Date().toISOString().slice(0, 10),
    duration_minutes: "60",
    note: "",
    work_package_id: "",
  });

  const dateFnsLocale = i18n.language === "en" ? enGB : de;

  const totalMinutes = useMemo(
    () => (entries as any[]).reduce((s, e) => s + (e.duration_minutes || 0), 0),
    [entries]
  );

  const activeUsers = useMemo(
    () => (users as any[]).filter((u: any) => u.is_active !== false),
    [users]
  );

  const wpById = useMemo(() => {
    const m: Record<string, any> = {};
    for (const w of workPackages as any[]) m[w.id] = w;
    return m;
  }, [workPackages]);

  const resetForm = () => {
    setForm({
      person_id: user?.id || "",
      entry_date: new Date().toISOString().slice(0, 10),
      duration_minutes: "60",
      note: "",
      work_package_id: defaultWpId,
    });
  };

  const requireWp = () => {
    if (!form.work_package_id) {
      toast.error("Bitte ein Projektarbeitspaket auswählen.");
      return false;
    }
    return true;
  };

  const handleAdd = async () => {
    if (!form.person_id) return toast.error(t("time_person_required"));
    if (!form.note.trim()) return toast.error(t("time_note_required"));
    if (!requireWp()) return;
    try {
      await addEntry.mutateAsync({
        project_id: projectId,
        person_id: form.person_id,
        entry_date: form.entry_date,
        duration_minutes: Number(form.duration_minutes),
        note: form.note.trim(),
        order_id: orderId,
        work_package_id: form.work_package_id,
      });
      toast.success(t("time_entry_created"));
      resetForm();
      setAddOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openEdit = (entry: any) => {
    setEditId(entry.id);
    setForm({
      person_id: entry.person_id,
      entry_date: entry.entry_date,
      duration_minutes: String(entry.duration_minutes),
      note: entry.note || "",
      work_package_id: entry.work_package_id || "",
    });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editId || !form.person_id || !form.note.trim()) return;
    if (!requireWp()) return;
    try {
      await updateEntry.mutateAsync({
        id: editId,
        project_id: projectId,
        person_id: form.person_id,
        entry_date: form.entry_date,
        duration_minutes: Number(form.duration_minutes),
        note: form.note.trim(),
        work_package_id: form.work_package_id,
      });
      toast.success(t("time_entry_updated"));
      setEditOpen(false);
      resetForm();
      setEditId(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEntry.mutateAsync({ id, project_id: projectId });
      toast.success(t("time_entry_deleted"));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAddMeeting = async () => {
    if (meetingPersonIds.length === 0) return toast.error(t("time_person_required"));
    if (!form.note.trim()) return toast.error(t("time_note_required"));
    if (!requireWp()) return;
    try {
      await addMeeting.mutateAsync({
        project_id: projectId,
        person_ids: meetingPersonIds,
        entry_date: form.entry_date,
        duration_minutes: Number(form.duration_minutes),
        note: form.note.trim(),
        order_id: orderId,
        work_package_id: form.work_package_id,
      });
      toast.success(t("time_meeting_created", { count: meetingPersonIds.length }));
      resetForm();
      setMeetingPersonIds([]);
      setAddOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const togglePerson = (id: string) =>
    setMeetingPersonIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const workPackageField = (
    <div className="space-y-2">
      <Label>Projektarbeitspaket *</Label>
      {(workPackages as any[]).length === 0 ? (
        <p className="text-xs text-destructive">
          Für dieses Projekt sind noch keine Arbeitspakete angelegt. Bitte zuerst im Tab „Arbeitspakete" erstellen.
        </p>
      ) : (
        <Select
          value={form.work_package_id}
          onValueChange={(v) => setForm((f) => ({ ...f, work_package_id: v }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Arbeitspaket auswählen …" />
          </SelectTrigger>
          <SelectContent>
            {(workPackages as any[]).map((wp) => (
              <SelectItem key={wp.id} value={wp.id}>
                {wp.title}
                {wp.is_mandatory ? " (Pflicht-AP)" : ""}
                {wp.status === "completed" ? " · abgeschlossen" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <p className="text-xs text-muted-foreground">
        Pflichtangabe – ordnet die Stunden der FFG-Förderstruktur zu.
      </p>
    </div>
  );

  const dateField = (
    <div className="space-y-2">
      <Label>{t("time_date")} *</Label>
      <Input
        type="date"
        value={form.entry_date}
        onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))}
      />
    </div>
  );

  const durationField = (
    <div className="space-y-2">
      <Label>{t("time_duration")} *</Label>
      <Select value={form.duration_minutes} onValueChange={(v) => setForm((f) => ({ ...f, duration_minutes: v }))}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {DURATION_OPTIONS.map((mins) => (
            <SelectItem key={mins} value={String(mins)}>
              {formatDuration(mins)} ({mins} min)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const noteField = (
    <div className="space-y-2">
      <Label>{t("time_note")} *</Label>
      <Textarea
        value={form.note}
        onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
        placeholder={t("time_note_placeholder")}
        rows={3}
      />
    </div>
  );

  const individualFields = (
    <div className="space-y-4">
      {dateField}
      <div className="space-y-2">
        <Label>{t("time_person")} *</Label>
        <PersonSelect
          value={form.person_id}
          onValueChange={(v) => setForm((f) => ({ ...f, person_id: v }))}
          users={activeUsers as any[]}
          placeholder={t("time_select_person")}
        />
      </div>
      {workPackageField}
      {durationField}
      {noteField}
    </div>
  );

  const filteredMeetingUsers = useMemo(
    () => sortAndFilterPersons(activeUsers as any[], meetingQuery, { activeOnly: true }),
    [activeUsers, meetingQuery],
  );
  const selectedMeetingUsers = useMemo(
    () => (activeUsers as any[]).filter((u: any) => meetingPersonIds.includes(u.user_id)),
    [activeUsers, meetingPersonIds],
  );

  const meetingFields = (
    <div className="space-y-4">
      {dateField}
      <div className="space-y-2">
        <Label>{t("time_meeting_participants")} * ({meetingPersonIds.length})</Label>
        {selectedMeetingUsers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedMeetingUsers.map((u: any) => (
              <Badge key={u.user_id} variant="secondary" className="gap-1 pr-1">
                {getPersonDisplayName(u)}
                <button
                  type="button"
                  onClick={() => togglePerson(u.user_id)}
                  className="hover:bg-muted-foreground/20 rounded p-0.5"
                  aria-label="remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={meetingQuery}
            onChange={(e) => setMeetingQuery(e.target.value)}
            placeholder={t("team_search_person", { defaultValue: "Person suchen…" })}
            className="pl-9 h-9"
          />
        </div>
        <div className="border rounded-md max-h-56 overflow-y-auto divide-y">
          {filteredMeetingUsers.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("team_no_search_results", { defaultValue: "Keine Personen gefunden" })}
            </div>
          ) : (
            filteredMeetingUsers.map((u: any) => (
              <label key={u.user_id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/50">
                <Checkbox
                  checked={meetingPersonIds.includes(u.user_id)}
                  onCheckedChange={() => togglePerson(u.user_id)}
                />
                <span className="text-sm">{getPersonDisplayName(u)}</span>
                {u.short_code ? (
                  <span className="ml-auto text-xs text-muted-foreground">{u.short_code}</span>
                ) : null}
              </label>
            ))
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("time_meeting_hint")}</p>
      </div>
      {workPackageField}
      {durationField}
      {noteField}
    </div>
  );

  const incompleteCount = (entries as any[]).filter((e: any) => !e.work_package_id).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Card className="flex-1 max-w-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{formatDuration(totalMinutes)}</p>
              <p className="text-xs text-muted-foreground">{t("time_total_hours")}</p>
            </div>
          </CardContent>
        </Card>

        {incompleteCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <AlertTriangle className="h-4 w-4" />
            {incompleteCount} Buchung(en) ohne Arbeitspaket – bitte nachpflegen.
          </div>
        )}

        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (o) { resetForm(); } else { resetForm(); setMeetingPersonIds([]); setAddMode("individual"); } }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t("time_add_entry")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("time_add_entry")}</DialogTitle>
            </DialogHeader>
            <Tabs value={addMode} onValueChange={(v) => setAddMode(v as any)}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="individual"><Clock className="h-4 w-4 mr-2" />{t("time_mode_individual")}</TabsTrigger>
                <TabsTrigger value="meeting"><Users className="h-4 w-4 mr-2" />{t("time_mode_meeting")}</TabsTrigger>
              </TabsList>
              <TabsContent value="individual" className="mt-4">
                {individualFields}
                <Button className="w-full mt-4" onClick={handleAdd} disabled={addEntry.isPending}>
                  {addEntry.isPending ? "..." : t("time_save")}
                </Button>
              </TabsContent>
              <TabsContent value="meeting" className="mt-4">
                {meetingFields}
                <Button className="w-full mt-4" onClick={handleAddMeeting} disabled={addMeeting.isPending}>
                  {addMeeting.isPending ? "..." : t("time_save")}
                </Button>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("time_date")}</TableHead>
                <TableHead>{t("time_type")}</TableHead>
                <TableHead>{t("time_person")}</TableHead>
                <TableHead>Arbeitspaket</TableHead>
                <TableHead>{t("time_duration")}</TableHead>
                <TableHead className="w-[30%]">{t("time_note")}</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(entries as any[]).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {t("time_no_entries")}
                  </TableCell>
                </TableRow>
              ) : (
                (entries as any[]).map((e: any) => {
                  const isMeeting = e.entry_type === "meeting";
                  const meetingCount = isMeeting && e.meeting_group_id
                    ? (entries as any[]).filter((x: any) => x.meeting_group_id === e.meeting_group_id).length
                    : 0;
                  const wp = e.work_package_id ? wpById[e.work_package_id] : null;
                  return (
                    <TableRow key={e.id} className={!e.work_package_id ? "bg-amber-50/40" : undefined}>
                      <TableCell>
                        {format(new Date(e.entry_date), "dd.MM.yyyy", { locale: dateFnsLocale })}
                      </TableCell>
                      <TableCell>
                        {isMeeting ? (
                          <Badge variant="secondary" className="gap-1">
                            <Users className="h-3 w-3" />
                            {t("time_mode_meeting")} ({meetingCount})
                          </Badge>
                        ) : (
                          <Badge variant="outline">{t("time_mode_individual")}</Badge>
                        )}
                      </TableCell>
                      <TableCell>{getUserName(users as any[], e.person_id)}</TableCell>
                      <TableCell className="text-sm">
                        {wp ? (
                          <span>{wp.title}</span>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300">
                            <AlertTriangle className="h-3 w-3" /> Unvollständig
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono">{formatDuration(e.duration_minutes)}</TableCell>
                      <TableCell className="text-sm">{e.note || "–"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("time_delete_title")}</AlertDialogTitle>
                                <AlertDialogDescription>{t("time_delete_desc")}</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("cancel", { ns: "common" })}</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDelete(e.id)}
                                >
                                  {t("delete", { ns: "common" })}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) { resetForm(); setEditId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("time_edit_entry")}</DialogTitle>
          </DialogHeader>
          {individualFields}
          <Button className="w-full" onClick={handleUpdate} disabled={updateEntry.isPending}>
            {updateEntry.isPending ? "..." : t("time_save")}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
