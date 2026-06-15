import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useUsers } from "@/hooks/useUsers";
import {
  useHazardRecipients,
  useAddHazardRecipient,
  useUpdateHazardRecipient,
  useRemoveHazardRecipient,
  useHazardLog,
} from "@/hooks/useHazardNotifications";

const ROLE_LABELS = ["Giftbeauftragter", "Sicherheitsfachkraft", "Sonstige"];

export default function AdminHazardNotificationsPage() {
  const { data: users = [] } = useUsers();
  const { data: recipients = [], isLoading: loadingRecipients } = useHazardRecipients();
  const { data: log = [], isLoading: loadingLog } = useHazardLog(200);
  const addRecipient = useAddHazardRecipient();
  const updateRecipient = useUpdateHazardRecipient();
  const removeRecipient = useRemoveHazardRecipient();

  const [selectedUserId, setSelectedUserId] = useState<string>("__none__");
  const [roleLabel, setRoleLabel] = useState<string>(ROLE_LABELS[0]);

  const userMap = useMemo(
    () => new Map(users.map((u: any) => [u.user_id, u])),
    [users]
  );

  const availableUsers = useMemo(() => {
    const used = new Set(recipients.map((r) => r.user_id));
    return users.filter((u: any) => u.is_active && !used.has(u.user_id));
  }, [users, recipients]);

  const handleAdd = async () => {
    if (selectedUserId === "__none__") {
      toast.error("Bitte einen Benutzer auswählen");
      return;
    }
    try {
      await addRecipient.mutateAsync({ user_id: selectedUserId, role_label: roleLabel });
      toast.success("Empfänger hinzugefügt");
      setSelectedUserId("__none__");
    } catch (e: any) {
      toast.error(e.message || "Fehler beim Hinzufügen");
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeRecipient.mutateAsync(id);
      toast.success("Empfänger entfernt");
    } catch (e: any) {
      toast.error(e.message || "Fehler beim Entfernen");
    }
  };

  const handleRoleChange = async (id: string, newLabel: string) => {
    try {
      await updateRecipient.mutateAsync({ id, role_label: newLabel });
    } catch (e: any) {
      toast.error(e.message || "Fehler");
    }
  };

  const renderUserName = (userId: string) => {
    const u: any = userMap.get(userId);
    if (!u) return userId.slice(0, 8) + "…";
    return `${u.first_name} ${u.last_name}`.trim() || u.short_code || u.user_id;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-warning" />
          Gefahrstoff-Benachrichtigungen
        </h1>
        <p className="text-muted-foreground">
          Verteiler für automatische Benachrichtigungen, wenn ein Gefahrstoff angelegt oder bearbeitet wird.
        </p>
      </div>

      <Tabs defaultValue="recipients">
        <TabsList>
          <TabsTrigger value="recipients">Verteiler</TabsTrigger>
          <TabsTrigger value="log">Protokoll</TabsTrigger>
        </TabsList>

        <TabsContent value="recipients" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Empfänger hinzufügen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                <div>
                  <Label>Benutzer</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Benutzer wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— wählen —</SelectItem>
                      {availableUsers.map((u: any) => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          {u.first_name} {u.last_name}
                          {u.short_code ? ` (${u.short_code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Rolle</Label>
                  <Select value={roleLabel} onValueChange={setRoleLabel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_LABELS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAdd} disabled={addRecipient.isPending}>
                  <Plus className="h-4 w-4 mr-2" />
                  Hinzufügen
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Aktuelle Empfänger ({recipients.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Benutzer</TableHead>
                    <TableHead>Rolle</TableHead>
                    <TableHead>Hinzugefügt</TableHead>
                    <TableHead className="w-20">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingRecipients ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                        Lade…
                      </TableCell>
                    </TableRow>
                  ) : recipients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                        Noch keine Empfänger hinterlegt.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recipients.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{renderUserName(r.user_id)}</TableCell>
                        <TableCell>
                          <Select
                            value={ROLE_LABELS.includes(r.role_label) ? r.role_label : "Sonstige"}
                            onValueChange={(v) => handleRoleChange(r.id, v)}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_LABELS.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(r.created_at), "dd.MM.yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Empfänger entfernen?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  „{renderUserName(r.user_id)}" erhält dann keine Gefahrstoff-Benachrichtigungen mehr.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRemove(r.id)}>
                                  Entfernen
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="log">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Benachrichtigungs-Protokoll</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zeitpunkt</TableHead>
                    <TableHead>Ereignis</TableHead>
                    <TableHead>Rohstoff</TableHead>
                    <TableHead>Ausgelöst von</TableHead>
                    <TableHead>Empfänger</TableHead>
                    <TableHead>Kanal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingLog ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        Lade…
                      </TableCell>
                    </TableRow>
                  ) : log.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        Noch keine Benachrichtigungen protokolliert.
                      </TableCell>
                    </TableRow>
                  ) : (
                    log.map((entry) => {
                      const snap = entry.material_snapshot || {};
                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {format(new Date(entry.triggered_at), "dd.MM.yyyy HH:mm:ss")}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                entry.event_type === "hazard_material_created" ? "default" : "secondary"
                              }
                            >
                              {entry.event_type === "hazard_material_created" ? "Angelegt" : "Bearbeitet"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Link
                              to={`/rohstoffe/${entry.raw_material_id}`}
                              className="text-destructive underline underline-offset-2 hover:opacity-80"
                            >
                              {snap.material_number || ""} {snap.material_name || ""}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm">
                            {entry.triggered_by ? renderUserName(entry.triggered_by) : "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {entry.recipient_user_ids.length === 0 ? (
                              <span className="text-muted-foreground italic">Keine Empfänger</span>
                            ) : (
                              entry.recipient_user_ids.map((uid) => renderUserName(uid)).join(", ")
                            )}
                          </TableCell>
                          <TableCell className="text-sm capitalize">{entry.channel}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
