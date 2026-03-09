import { useState } from "react";
import { useCustomRoles, useCreateCustomRole, useUpdateCustomRole, useDeleteCustomRole, CustomRole } from "@/hooks/useCustomRoles";
import { ALL_PERMISSIONS, PERMISSION_GROUPS, PERMISSION_LABELS, PermissionKey } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Shield, Lock } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const BASE_ROLE_LABELS: Record<string, string> = {
  master: "Administrator",
  auftraggeber: "Auftraggeber",
  durchfuehrer: "Messdienstleister",
};

export default function AdminRolesPage() {
  const { data: roles = [], isLoading } = useCustomRoles();
  const createRole = useCreateCustomRole();
  const updateRole = useUpdateCustomRole();
  const deleteRole = useDeleteCustomRole();
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith("de") ? "de" : "en";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomRole | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseRole, setBaseRole] = useState("auftraggeber");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());

  const resetForm = () => {
    setName("");
    setDescription("");
    setBaseRole("auftraggeber");
    setSelectedPerms(new Set());
    setEditingRole(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (role: CustomRole) => {
    setName(role.name);
    setDescription(role.description || "");
    setBaseRole(role.base_role);
    setSelectedPerms(new Set(role.permissions));
    setEditingRole(role);
    setDialogOpen(true);
  };

  const togglePerm = (perm: string) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  };

  const toggleGroup = (perms: string[]) => {
    const allSelected = perms.every((p) => selectedPerms.has(p));
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      perms.forEach((p) => (allSelected ? next.delete(p) : next.add(p)));
      return next;
    });
  };

  const selectAll = () => {
    setSelectedPerms(new Set(ALL_PERMISSIONS));
  };

  const selectNone = () => {
    setSelectedPerms(new Set());
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(lang === "de" ? "Name ist erforderlich" : "Name is required");
      return;
    }
    try {
      const perms = Array.from(selectedPerms);
      if (editingRole) {
        await updateRole.mutateAsync({ id: editingRole.id, name, description, base_role: baseRole, permissions: perms });
        toast.success(lang === "de" ? "Rolle aktualisiert" : "Role updated");
      } else {
        await createRole.mutateAsync({ name, description, base_role: baseRole, permissions: perms });
        toast.success(lang === "de" ? "Rolle erstellt" : "Role created");
      }
      setDialogOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRole.mutateAsync(deleteTarget.id);
      toast.success(lang === "de" ? "Rolle gelöscht" : "Role deleted");
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6" />
            {lang === "de" ? "Rollen & Berechtigungen" : "Roles & Permissions"}
          </h1>
          <p className="text-muted-foreground">
            {lang === "de" ? "Erstellen und verwalten Sie benutzerdefinierte Rollen mit spezifischen Berechtigungen" : "Create and manage custom roles with specific permissions"}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {lang === "de" ? "Neue Rolle" : "New Role"}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{lang === "de" ? "Rolle" : "Role"}</TableHead>
                <TableHead>{lang === "de" ? "Beschreibung" : "Description"}</TableHead>
                <TableHead>{lang === "de" ? "Basis-Rolle" : "Base Role"}</TableHead>
                <TableHead>{lang === "de" ? "Berechtigungen" : "Permissions"}</TableHead>
                <TableHead>{lang === "de" ? "Typ" : "Type"}</TableHead>
                <TableHead className="w-[100px]">{lang === "de" ? "Aktionen" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">{lang === "de" ? "Laden..." : "Loading..."}</TableCell></TableRow>
              ) : roles.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">{lang === "de" ? "Keine Rollen vorhanden" : "No roles found"}</TableCell></TableRow>
              ) : (
                roles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{r.description || "–"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{BASE_ROLE_LABELS[r.base_role] || r.base_role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.permissions.length} / {ALL_PERMISSIONS.length}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.is_system ? (
                        <Badge variant="default" className="gap-1"><Lock className="h-3 w-3" />{lang === "de" ? "System" : "System"}</Badge>
                      ) : (
                        <Badge variant="outline">{lang === "de" ? "Benutzerdefiniert" : "Custom"}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!r.is_system && (
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(r)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) { setDialogOpen(false); resetForm(); } else setDialogOpen(v); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRole
                ? (lang === "de" ? "Rolle bearbeiten" : "Edit Role")
                : (lang === "de" ? "Neue Rolle erstellen" : "Create New Role")}
            </DialogTitle>
            <DialogDescription>
              {lang === "de"
                ? "Definieren Sie Name, Beschreibung und Berechtigungen für diese Rolle."
                : "Define name, description and permissions for this role."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{lang === "de" ? "Name *" : "Name *"}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={lang === "de" ? "z.B. Laborant, QA, Projektleiter" : "e.g. Lab Tech, QA, Project Lead"}
                  disabled={editingRole?.is_system}
                />
              </div>
              <div className="space-y-2">
                <Label>{lang === "de" ? "Basis-Rolle (für Datenbankzugriff)" : "Base Role (for DB access)"}</Label>
                <Select value={baseRole} onValueChange={setBaseRole} disabled={editingRole?.is_system}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="master">Administrator</SelectItem>
                    <SelectItem value="auftraggeber">Auftraggeber</SelectItem>
                    <SelectItem value="durchfuehrer">Messdienstleister</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{lang === "de" ? "Beschreibung" : "Description"}</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{lang === "de" ? "Berechtigungen" : "Permissions"}</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>{lang === "de" ? "Alle" : "All"}</Button>
                  <Button variant="outline" size="sm" onClick={selectNone}>{lang === "de" ? "Keine" : "None"}</Button>
                </div>
              </div>

              {PERMISSION_GROUPS.map((group) => {
                const allInGroup = group.permissions.every((p) => selectedPerms.has(p));
                return (
                  <Card key={group.key}>
                    <CardHeader className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={allInGroup}
                          onCheckedChange={() => toggleGroup(group.permissions)}
                        />
                        <CardTitle className="text-sm font-medium">
                          {lang === "de" ? group.labelDe : group.labelEn}
                        </CardTitle>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {group.permissions.filter((p) => selectedPerms.has(p)).length}/{group.permissions.length}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="py-2 px-4">
                      <div className="grid grid-cols-2 gap-2">
                        {group.permissions.map((perm) => (
                          <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded p-1">
                            <Checkbox
                              checked={selectedPerms.has(perm)}
                              onCheckedChange={() => togglePerm(perm)}
                            />
                            <span>{PERMISSION_LABELS[perm as PermissionKey]?.[lang] || perm}</span>
                          </label>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              {lang === "de" ? "Abbrechen" : "Cancel"}
            </Button>
            <Button onClick={handleSave} disabled={createRole.isPending || updateRole.isPending}>
              {(createRole.isPending || updateRole.isPending)
                ? (lang === "de" ? "Speichere..." : "Saving...")
                : (lang === "de" ? "Speichern" : "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{lang === "de" ? "Rolle löschen?" : "Delete role?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "de"
                ? `Möchten Sie die Rolle "${deleteTarget?.name}" wirklich löschen? Benutzer mit dieser Rolle verlieren ihre Zuordnung.`
                : `Do you really want to delete the role "${deleteTarget?.name}"? Users with this role will lose their assignment.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{lang === "de" ? "Abbrechen" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {lang === "de" ? "Löschen" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
