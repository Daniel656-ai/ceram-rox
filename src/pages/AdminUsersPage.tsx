import { useState } from "react";
import { useUsers, useUpdateUserRole, useUpdateUserStatus, useCreateUser, useDeleteUser, useUpdateProfile } from "@/hooks/useUsers";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const ROLE_LABELS: Record<string, string> = {
  master: "Administrator",
  auftraggeber: "Auftraggeber",
  durchfuehrer: "Messdienstleister",
};

export default function AdminUsersPage() {
  const { data: users = [], isLoading } = useUsers();
  const { user: currentUser } = useAuth();
  const updateRole = useUpdateUserRole();
  const updateStatus = useUpdateUserStatus();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();
  const updateProfile = useUpdateProfile();

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // Create form state
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newRole, setNewRole] = useState("auftraggeber");

  // Edit form state
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");

  const resetCreateForm = () => {
    setNewEmail("");
    setNewPassword("");
    setNewFirstName("");
    setNewLastName("");
    setNewRole("auftraggeber");
  };

  const handleCreate = async () => {
    if (!newEmail || !newPassword) {
      toast.error("E-Mail und Passwort sind Pflichtfelder");
      return;
    }
    try {
      await createUser.mutateAsync({
        email: newEmail,
        password: newPassword,
        firstName: newFirstName,
        lastName: newLastName,
        role: newRole,
      });
      toast.success("Benutzer erstellt");
      setCreateOpen(false);
      resetCreateForm();
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    }
  };

  const handleEdit = async () => {
    if (!editUser) return;
    try {
      await updateProfile.mutateAsync({
        userId: editUser.user_id,
        firstName: editFirstName,
        lastName: editLastName,
      });
      toast.success("Benutzer aktualisiert");
      setEditUser(null);
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser.mutateAsync(deleteTarget.user_id);
      toast.success("Benutzer gelöscht");
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await updateRole.mutateAsync({ userId, role });
      toast.success("Rolle geändert");
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    }
  };

  const handleStatusChange = async (userId: string, isActive: boolean) => {
    try {
      await updateStatus.mutateAsync({ userId, isActive });
      toast.success(isActive ? "Benutzer aktiviert" : "Benutzer deaktiviert");
    } catch (err: any) {
      toast.error("Fehler", { description: err.message });
    }
  };

  const openEdit = (u: any) => {
    setEditFirstName(u.first_name || "");
    setEditLastName(u.last_name || "");
    setEditUser(u);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Benutzerverwaltung</h1>
          <p className="text-muted-foreground">Verwaltung aller registrierten Benutzer</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Neuer Benutzer
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead className="w-[100px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Laden...</TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Keine Benutzer gefunden</TableCell></TableRow>
              ) : (
                users.map((u: any) => {
                  const role = u.user_roles?.[0]?.role || "auftraggeber";
                  const isSelf = u.user_id === currentUser?.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <p className="font-medium">{u.first_name} {u.last_name}</p>
                      </TableCell>
                      <TableCell>
                        <Select value={role} onValueChange={v => handleRoleChange(u.user_id, v)}>
                          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="master">Administrator</SelectItem>
                            <SelectItem value="auftraggeber">Auftraggeber</SelectItem>
                            <SelectItem value="durchfuehrer">Messdienstleister</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={u.is_active} onCheckedChange={v => handleStatusChange(u.user_id, v)} />
                          <span className="text-sm">{u.is_active ? "Aktiv" : "Inaktiv"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(u.created_at).toLocaleDateString("de-DE")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!isSelf && (
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(u)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
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

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={v => { setCreateOpen(v); if (!v) resetCreateForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuen Benutzer anlegen</DialogTitle>
            <DialogDescription>Erstellen Sie einen neuen Benutzer mit E-Mail und Passwort.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Vorname</Label>
                <Input id="firstName" value={newFirstName} onChange={e => setNewFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nachname</Label>
                <Input id="lastName" value={newLastName} onChange={e => setNewLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail *</Label>
              <Input id="email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort *</Label>
              <Input id="password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Rolle</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="master">Administrator</SelectItem>
                  <SelectItem value="auftraggeber">Auftraggeber</SelectItem>
                  <SelectItem value="durchfuehrer">Messdienstleister</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetCreateForm(); }}>Abbrechen</Button>
            <Button onClick={handleCreate} disabled={createUser.isPending}>
              {createUser.isPending ? "Erstelle..." : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={v => { if (!v) setEditUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Benutzer bearbeiten</DialogTitle>
            <DialogDescription>Ändern Sie den Namen des Benutzers.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vorname</Label>
                <Input value={editFirstName} onChange={e => setEditFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nachname</Label>
                <Input value={editLastName} onChange={e => setEditLastName(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Abbrechen</Button>
            <Button onClick={handleEdit} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Speichere..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Benutzer löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie {deleteTarget?.first_name} {deleteTarget?.last_name} wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
