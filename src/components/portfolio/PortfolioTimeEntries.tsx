import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useCanManagePortfolio } from "@/hooks/useCanManagePortfolio";
import { useUsers } from "@/hooks/useUsers";
import {
  usePortfolioTimeEntries,
  useAddProjectTimeEntry,
  useAddProjectMeetingEntry,
  useUpdateProjectTimeEntry,
  useDeleteProjectTimeEntry,
} from "@/hooks/useProjectTimeEntries";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Clock, Users, Search, X, AlertTriangle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PersonSelect } from "@/components/PersonSelect";
import { sortAndFilterPersons, getPersonDisplayName } from "@/lib/personSearch";

interface Props {
  portfolioId: string;
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

export default function PortfolioTimeEntries({ portfolioId }: Props) {
  const { user } = useAuth();
  const canManage = useCanManagePortfolio();

  const { data: entries = [] } = usePortfolioTimeEntries(portfolioId);
  const { data: users = [] } = useUsers();
  const { data: workPackages = [] } = useQuery({
    queryKey: ["portfolio-wps-for-time", portfolioId],
    queryFn: () => api.portfolioWorkPackages.listByPortfolio(portfolioId),
    enabled: !!portfolioId,
  });
  const { data: allTasks = [] } = useQuery({
    queryKey: ["portfolio-tasks-for-time", portfolioId],
    queryFn: () => api.portfolioTasks.listByPortfolio(portfolioId),
    enabled: !!portfolioId,
  });

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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkWpId, setBulkWpId] = useState<string>("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const activeWps = useMemo(
    () => (workPackages as any[]).filter((w) => w.is_active !== false && w.status !== "abgeschlossen" && w.status !== "abgebrochen"),
    [workPackages]
  );
  const defaultWpId = activeWps.length === 1 ? activeWps[0].id : "";

  const [form, setForm] = useState({
    person_id: user?.id || "",
    entry_date: new Date().toISOString().slice(0, 10),
    duration_minutes: "60",
    note: "",
    portfolio_work_package_id: "",
    portfolio_task_id: "",
  });

  const tasksForWp = useMemo(
    () => (allTasks as any[]).filter((t) => t.portfolio_work_package_id === form.portfolio_work_package_id),
    [allTasks, form.portfolio_work_package_id]
  );

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
  const taskById = useMemo(() => {
    const m: Record<string, any> = {};
    for (const t of allTasks as any[]) m[t.id] = t;
    return m;
  }, [allTasks]);

  const resetForm = () => {
    setForm({
      person_id: user?.id || "",
      entry_date: new Date().toISOString().slice(0, 10),
      duration_minutes: "60",
      note: "",
      portfolio_work_package_id: defaultWpId,
      portfolio_task_id: "",
    });
  };

  const requireWp = () => {
    if (!form.portfolio_work_package_id) {
      toast.error("Bitte ein Portfolio-Arbeitspaket auswählen.");
      return false;
    }
    return true;
  };

  if (!canManage) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <ShieldAlert className="h-5 w-5 text-amber-600" />
          Nur Administratoren und PMO dürfen Portfolio-Zeitbuchungen sehen und verwalten.
        </CardContent>
      </Card>
    );
  }

  const handleAdd = async () => {
    if (!form.person_id) return toast.error("Person erforderlich");
    if (!form.note.trim()) return toast.error("Notiz erforderlich");
    if (!requireWp()) return;
    try {
      await addEntry.mutateAsync({
        portfolio_id: portfolioId,
        person_id: form.person_id,
        entry_date: form.entry_date,
        duration_minutes: Number(form.duration_minutes),
        note: form.note.trim(),
        portfolio_work_package_id: form.portfolio_work_package_id,
        portfolio_task_id: form.portfolio_task_id || null,
      });
      toast.success("Buchung gespeichert");
      resetForm();
      setAddOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleAddMeeting = async () => {
    if (meetingPersonIds.length === 0) return toast.error("Bitte Teilnehmer auswählen");
    if (!form.note.trim()) return toast.error("Notiz erforderlich");
    if (!requireWp()) return;
    try {
      await addMeeting.mutateAsync({
        portfolio_id: portfolioId,
        person_ids: meetingPersonIds,
        entry_date: form.entry_date,
        duration_minutes: Number(form.duration_minutes),
        note: form.note.trim(),
        portfolio_work_package_id: form.portfolio_work_package_id,
        portfolio_task_id: form.portfolio_task_id || null,
      });
      toast.success(`Meeting für ${meetingPersonIds.length} Person(en) gespeichert`);
      resetForm();
      setMeetingPersonIds([]);
      setAddOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const openEdit = (entry: any) => {
    setEditId(entry.id);
    setForm({
      person_id: entry.person_id,
      entry_date: entry.entry_date,
      duration_minutes: String(entry.duration_minutes),
      note: entry.note || "",
      portfolio_work_package_id: entry.portfolio_work_package_id || "",
      portfolio_task_id: entry.portfolio_task_id || "",
    });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editId || !form.person_id || !form.note.trim()) return;
    if (!requireWp()) return;
    try {
      await updateEntry.mutateAsync({
        id: editId,
        portfolio_id: portfolioId,
        person_id: form.person_id,
        entry_date: form.entry_date,
        duration_minutes: Number(form.duration_minutes),
        note: form.note.trim(),
        portfolio_work_package_id: form.portfolio_work_package_id,
        portfolio_task_id: form.portfolio_task_id || null,
      });
      toast.success("Aktualisiert");
      setEditOpen(false);
      resetForm();
      setEditId(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEntry.mutateAsync({ id, portfolio_id: portfolioId });
      toast.success("Gelöscht");
    } catch (e: any) { toast.error(e.message); }
  };

  const togglePerson = (id: string) =>
    setMeetingPersonIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const filteredMeetingUsers = useMemo(
    () => sortAndFilterPersons(activeUsers as any[], meetingQuery, { activeOnly: true }),
    [activeUsers, meetingQuery],
  );
  const selectedMeetingUsers = useMemo(
    () => (activeUsers as any[]).filter((u: any) => meetingPersonIds.includes(u.user_id)),
    [activeUsers, meetingPersonIds],
  );

  const incompleteEntries = useMemo(
    () => (entries as any[]).filter((e: any) => !e.portfolio_work_package_id),
    [entries]
  );
  const incompleteIds = useMemo(() => incompleteEntries.map((e: any) => e.id), [incompleteEntries]);
  const allIncompleteSelected = incompleteIds.length > 0 && incompleteIds.every((id) => selectedIds.includes(id));
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleSelectAllIncomplete = () =>
    setSelectedIds(allIncompleteSelected ? [] : incompleteIds);

  const handleBulkAssign = async () => {
    if (!bulkWpId) return toast.error("Bitte ein Portfolio-Arbeitspaket auswählen.");
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      const targets = (entries as any[]).filter((e: any) => selectedIds.includes(e.id));
      for (const e of targets) {
        await updateEntry.mutateAsync({
          id: e.id,
          portfolio_id: portfolioId,
          portfolio_work_package_id: bulkWpId,
        });
      }
      toast.success(`${targets.length} Buchung(en) zugeordnet.`);
      setSelectedIds([]);
      setBulkOpen(false);
      setBulkWpId("");
    } catch (e: any) { toast.error(e.message); }
    finally { setBulkBusy(false); }
  };

  const workPackageField = (
    <div className="space-y-2">
      <Label>Portfolio-Arbeitspaket *</Label>
      {(workPackages as any[]).length === 0 ? (
        <p className="text-xs text-destructive">
          Für dieses Portfolio sind noch keine Arbeitspakete angelegt. Bitte zuerst im Tab „Struktur (APs &amp; Tasks)" erstellen.
        </p>
      ) : (
        <Select
          value={form.portfolio_work_package_id}
          onValueChange={(v) => setForm((f) => ({ ...f, portfolio_work_package_id: v, portfolio_task_id: "" }))}
        >
          <SelectTrigger><SelectValue placeholder="Arbeitspaket auswählen …" /></SelectTrigger>
          <SelectContent>
            {(workPackages as any[]).map((wp) => (
              <SelectItem key={wp.id} value={wp.id}>
                {wp.code ? `${wp.code} · ` : ""}{wp.name}
                {wp.status === "abgeschlossen" ? " · abgeschlossen" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );

  const taskField = tasksForWp.length > 0 && (
    <div className="space-y-2">
      <Label>Task (optional)</Label>
      <Select
        value={form.portfolio_task_id || "__none__"}
        onValueChange={(v) => setForm((f) => ({ ...f, portfolio_task_id: v === "__none__" ? "" : v }))}
      >
        <SelectTrigger><SelectValue placeholder="Kein Task" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— kein Task —</SelectItem>
          {tasksForWp.map((tk: any) => (
            <SelectItem key={tk.id} value={tk.id}>
              {tk.code ? `${tk.code} · ` : ""}{tk.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const dateField = (
    <div className="space-y-2">
      <Label>Datum *</Label>
      <Input type="date" value={form.entry_date}
        onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))} />
    </div>
  );

  const durationField = (
    <div className="space-y-2">
      <Label>Dauer *</Label>
      <Select value={form.duration_minutes} onValueChange={(v) => setForm((f) => ({ ...f, duration_minutes: v }))}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {DURATION_OPTIONS.map((mins) => (
            <SelectItem key={mins} value={String(mins)}>{formatDuration(mins)} ({mins} min)</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const noteField = (
    <div className="space-y-2">
      <Label>Notiz *</Label>
      <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={3} />
    </div>
  );

  const individualFields = (
    <div className="space-y-4">
      {dateField}
      <div className="space-y-2">
        <Label>Person *</Label>
        <PersonSelect value={form.person_id}
          onValueChange={(v) => setForm((f) => ({ ...f, person_id: v }))}
          users={activeUsers as any[]} placeholder="Person wählen" />
      </div>
      {workPackageField}
      {taskField}
      {durationField}
      {noteField}
    </div>
  );

  const meetingFields = (
    <div className="space-y-4">
      {dateField}
      <div className="space-y-2">
        <Label>Meeting-Teilnehmer * ({meetingPersonIds.length})</Label>
        {selectedMeetingUsers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedMeetingUsers.map((u: any) => (
              <Badge key={u.user_id} variant="secondary" className="gap-1 pr-1">
                {getPersonDisplayName(u)}
                <button type="button" onClick={() => togglePerson(u.user_id)}
                  className="hover:bg-muted-foreground/20 rounded p-0.5" aria-label="remove">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input value={meetingQuery} onChange={(e) => setMeetingQuery(e.target.value)}
            placeholder="Person suchen…" className="pl-9 h-9" />
        </div>
        <div className="border rounded-md max-h-56 overflow-y-auto divide-y">
          {filteredMeetingUsers.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">Keine Personen gefunden</div>
          ) : (
            filteredMeetingUsers.map((u: any) => (
              <label key={u.user_id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/50">
                <Checkbox checked={meetingPersonIds.includes(u.user_id)} onCheckedChange={() => togglePerson(u.user_id)} />
                <span className="text-sm">{getPersonDisplayName(u)}</span>
                {u.short_code ? <span className="ml-auto text-xs text-muted-foreground">{u.short_code}</span> : null}
              </label>
            ))
          )}
        </div>
      </div>
      {workPackageField}
      {taskField}
      {durationField}
      {noteField}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Card className="flex-1 max-w-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{formatDuration(totalMinutes)}</p>
              <p className="text-xs text-muted-foreground">Gesamt Portfolio-Stunden</p>
            </div>
          </CardContent>
        </Card>

        {incompleteEntries.length > 0 && (
          <div className="flex items-center gap-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{incompleteEntries.length} Buchung(en) ohne AP – Zuordnung erforderlich.</span>
            {selectedIds.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
                {selectedIds.length} zuordnen…
              </Button>
            )}
          </div>
        )}

        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (o) resetForm(); else { resetForm(); setMeetingPersonIds([]); setAddMode("individual"); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Zeit buchen</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Portfolio-Zeitbuchung</DialogTitle></DialogHeader>
            <Tabs value={addMode} onValueChange={(v) => setAddMode(v as any)}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="individual"><Clock className="h-4 w-4 mr-2" />Einzelbuchung</TabsTrigger>
                <TabsTrigger value="meeting"><Users className="h-4 w-4 mr-2" />Meeting</TabsTrigger>
              </TabsList>
              <TabsContent value="individual" className="mt-4">
                {individualFields}
                <Button className="w-full mt-4" onClick={handleAdd} disabled={addEntry.isPending}>
                  {addEntry.isPending ? "..." : "Speichern"}
                </Button>
              </TabsContent>
              <TabsContent value="meeting" className="mt-4">
                {meetingFields}
                <Button className="w-full mt-4" onClick={handleAddMeeting} disabled={addMeeting.isPending}>
                  {addMeeting.isPending ? "..." : "Speichern"}
                </Button>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  {incompleteIds.length > 0 && (
                    <Checkbox checked={allIncompleteSelected} onCheckedChange={toggleSelectAllIncomplete} />
                  )}
                </TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Arbeitspaket / Task</TableHead>
                <TableHead>Dauer</TableHead>
                <TableHead className="w-[25%]">Notiz</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(entries as any[]).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Noch keine Zeitbuchungen erfasst.
                  </TableCell>
                </TableRow>
              ) : (
                (entries as any[]).map((e: any) => {
                  const isMeeting = e.entry_type === "meeting";
                  const meetingCount = isMeeting && e.meeting_group_id
                    ? (entries as any[]).filter((x: any) => x.meeting_group_id === e.meeting_group_id).length : 0;
                  const wp = e.portfolio_work_package_id ? wpById[e.portfolio_work_package_id] : null;
                  const tk = e.portfolio_task_id ? taskById[e.portfolio_task_id] : null;
                  return (
                    <TableRow key={e.id} className={!e.portfolio_work_package_id ? "bg-amber-50/40" : undefined}>
                      <TableCell>
                        {!e.portfolio_work_package_id && (
                          <Checkbox checked={selectedIds.includes(e.id)} onCheckedChange={() => toggleSelect(e.id)} />
                        )}
                      </TableCell>
                      <TableCell>{format(new Date(e.entry_date), "dd.MM.yyyy", { locale: de })}</TableCell>
                      <TableCell>
                        {isMeeting ? (
                          <Badge variant="secondary" className="gap-1">
                            <Users className="h-3 w-3" />Meeting ({meetingCount})
                          </Badge>
                        ) : (<Badge variant="outline">Einzeln</Badge>)}
                      </TableCell>
                      <TableCell>{getUserName(users as any[], e.person_id)}</TableCell>
                      <TableCell className="text-sm">
                        {wp ? (
                          <div>
                            <div>{wp.code ? `${wp.code} · ` : ""}{wp.name}</div>
                            {tk && <div className="text-xs text-muted-foreground">↳ {tk.code ? `${tk.code} · ` : ""}{tk.name}</div>}
                          </div>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300">
                            <AlertTriangle className="h-3 w-3" /> Zuordnung erforderlich
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
                                <AlertDialogTitle>Zeitbuchung löschen?</AlertDialogTitle>
                                <AlertDialogDescription>Diese Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDelete(e.id)}>Löschen</AlertDialogAction>
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

      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) { resetForm(); setEditId(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Zeitbuchung bearbeiten</DialogTitle></DialogHeader>
          {individualFields}
          <Button className="w-full" onClick={handleUpdate} disabled={updateEntry.isPending}>
            {updateEntry.isPending ? "..." : "Speichern"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={(o) => { setBulkOpen(o); if (!o) setBulkWpId(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Arbeitspaket für {selectedIds.length} Buchung(en) setzen</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Portfolio-Arbeitspaket *</Label>
            <Select value={bulkWpId} onValueChange={setBulkWpId}>
              <SelectTrigger><SelectValue placeholder="Arbeitspaket auswählen …" /></SelectTrigger>
              <SelectContent>
                {(workPackages as any[]).map((wp) => (
                  <SelectItem key={wp.id} value={wp.id}>
                    {wp.code ? `${wp.code} · ` : ""}{wp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={handleBulkAssign} disabled={bulkBusy || !bulkWpId}>
            {bulkBusy ? "..." : "Zuordnen"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
