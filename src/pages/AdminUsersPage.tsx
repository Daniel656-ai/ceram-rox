import { useMemo, useState } from "react";
import { useUsers, useUpdateUserRole, useUpdateUserStatus, useCreateUser, useDeleteUser, useUpdateProfile, useResetUserPassword, useUserEmails } from "@/hooks/useUsers";
import { Checkbox } from "@/components/ui/checkbox";

import { useCustomRoles } from "@/hooks/useCustomRoles";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, CalendarClock, KeyRound, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { UserWorkScheduleDialog } from "@/components/UserWorkScheduleDialog";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import { validatePassword, generateStrongPassword } from "@/lib/passwordPolicy";


export default function AdminUsersPage() {
  const { t, i18n } = useTranslation(["admin", "common", "auth"]);
  const { data: users = [], isLoading } = useUsers();
  const { data: customRoles = [] } = useCustomRoles();
  const { user: currentUser } = useAuth();
  const updateRole = useUpdateUserRole();
  const updateStatus = useUpdateUserStatus();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();
  const updateProfile = useUpdateProfile();
  const resetPassword = useResetUserPassword();

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [scheduleUser, setScheduleUser] = useState<any>(null);
  const [resetUser, setResetUser] = useState<any>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetDoneValue, setResetDoneValue] = useState<string | null>(null);


  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newCustomRoleId, setNewCustomRoleId] = useState("");
  const [newShortCode, setNewShortCode] = useState("");

  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editShortCode, setEditShortCode] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [resetMustChange, setResetMustChange] = useState(true);


  const dateFmt = i18n.language === "en" ? "en-GB" : "de-DE";

  const resetCreateForm = () => {
    setNewEmail(""); setNewPassword(""); setNewFirstName(""); setNewLastName(""); setNewCustomRoleId(""); setNewShortCode("");
  };

  const handleCreate = async () => {
    if (!newEmail || !newPassword) { toast.error(t("admin:email_password_required")); return; }
    if (!validatePassword(newPassword).valid) { toast.error(t("auth:policy_invalid")); return; }
    if (!newShortCode || newShortCode.length !== 3) { toast.error(t("admin:short_code_error")); return; }
    const selectedRole = customRoles.find((r) => r.id === newCustomRoleId);
    try {
      await createUser.mutateAsync({ email: newEmail, password: newPassword, firstName: newFirstName, lastName: newLastName, role: selectedRole?.base_role || "auftraggeber", shortCode: newShortCode.toUpperCase(), customRoleId: newCustomRoleId || undefined });
      toast.success(t("admin:user_created"));
      setCreateOpen(false); resetCreateForm();
    } catch (err: any) { toast.error(t("common:error"), { description: err.message }); }
  };

  const openReset = (u: any) => { setResetUser(u); setResetPasswordValue(""); setResetDoneValue(null); };
  const handleReset = async () => {
    if (!resetUser) return;
    if (!validatePassword(resetPasswordValue).valid) { toast.error(t("auth:policy_invalid")); return; }
    try {
      await resetPassword.mutateAsync({ userId: resetUser.user_id, password: resetPasswordValue });
      setResetDoneValue(resetPasswordValue);
    } catch (err: any) { toast.error(t("common:error"), { description: err.message }); }
  };


  const handleEdit = async () => {
    if (!editUser) return;
    if (!editShortCode || editShortCode.length !== 3) { toast.error(t("admin:short_code_error")); return; }
    try {
      await updateProfile.mutateAsync({ userId: editUser.user_id, firstName: editFirstName, lastName: editLastName, shortCode: editShortCode.toUpperCase() });
      toast.success(t("admin:user_updated")); setEditUser(null);
    } catch (err: any) { toast.error(t("common:error"), { description: err.message }); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteUser.mutateAsync(deleteTarget.user_id); toast.success(t("admin:user_deleted")); setDeleteTarget(null); }
    catch (err: any) { toast.error(t("common:error"), { description: err.message }); }
  };

  const handleRoleChange = async (userId: string, customRoleId: string) => {
    const selectedRole = customRoles.find((r) => r.id === customRoleId);
    if (!selectedRole) return;
    try { await updateRole.mutateAsync({ userId, role: selectedRole.base_role, customRoleId }); toast.success(t("admin:role_changed")); }
    catch (err: any) { toast.error(t("common:error"), { description: err.message }); }
  };

  const handleStatusChange = async (userId: string, isActive: boolean) => {
    try { await updateStatus.mutateAsync({ userId, isActive }); toast.success(isActive ? t("admin:user_activated") : t("admin:user_deactivated")); }
    catch (err: any) { toast.error(t("common:error"), { description: err.message }); }
  };

  const openEdit = (u: any) => { setEditFirstName(u.first_name || ""); setEditLastName(u.last_name || ""); setEditShortCode(u.short_code || ""); setEditUser(u); };

  const userColumns = useMemo<DataTableColumn<any>[]>(() => [
    {
      key: "name",
      header: t("admin:table_name"),
      accessor: (u) => `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim(),
      cell: (u) => <p className="font-medium">{u.first_name} {u.last_name}</p>,
    },
    {
      key: "short_code",
      header: t("admin:short_code"),
      accessor: (u) => u.short_code || "",
      cell: (u) => <span className="font-mono text-sm">{u.short_code || "–"}</span>,
    },
    {
      key: "role",
      type: "status",
      header: t("admin:role"),
      accessor: (u) => u.custom_role_name || "",
      cell: (u) => (
        <Select value={u.custom_role_id || ""} onValueChange={(v) => handleRoleChange(u.user_id, v)}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder={u.custom_role_name || "–"} /></SelectTrigger>
          <SelectContent>
            {customRoles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                <div className="flex items-center gap-2">{r.name}{r.is_system && <Badge variant="outline" className="text-xs ml-1">{t("admin:role_type_system")}</Badge>}</div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      key: "is_active",
      type: "boolean",
      header: t("admin:status"),
      accessor: (u) => !!u.is_active,
      cell: (u) => (
        <div className="flex items-center gap-2">
          <Switch checked={u.is_active} onCheckedChange={(v) => handleStatusChange(u.user_id, v)} />
          <span className="text-sm">{u.is_active ? t("admin:active") : t("admin:inactive")}</span>
        </div>
      ),
    },
    {
      key: "created_at",
      type: "date",
      header: t("admin:table_created"),
      accessor: (u) => u.created_at ?? null,
      cell: (u) => new Date(u.created_at).toLocaleDateString(dateFmt),
    },
    {
      key: "actions",
      type: "custom",
      header: t("admin:table_actions"),
      sortable: false,
      filterable: false,
      searchable: false,
      headClassName: "w-[160px]",
      cell: (u) => {
        const isSelf = u.user_id === currentUser?.id;
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" title={t("admin:schedule_button")} onClick={() => setScheduleUser(u)}><CalendarClock className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" title={t("auth:admin_reset_button")} onClick={() => openReset(u)}><KeyRound className="h-4 w-4" /></Button>
            {!isSelf && (<Button variant="ghost" size="icon" onClick={() => setDeleteTarget(u)}><Trash2 className="h-4 w-4 text-destructive" /></Button>)}
          </div>
        );
      },
    },
  ], [t, customRoles, dateFmt, currentUser?.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("admin:users_title")}</h1>
          <p className="text-muted-foreground">{t("admin:users_subtitle")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />{t("admin:new_user")}</Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <DataTable
            tableId="admin-users"
            columns={userColumns}
            rows={users as any[]}
            rowKey={(u) => u.id}
            isLoading={isLoading}
            emptyMessage={t("admin:no_users")}
            searchPlaceholder={t("common:search", { defaultValue: "Suchen …" })}
            defaultSort={{ key: "name", dir: "asc" }}
          />
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) resetCreateForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin:create_user_title")}</DialogTitle>
            <DialogDescription>{t("admin:create_user_description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t("admin:first_name")}</Label><Input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} /></div>
              <div className="space-y-2"><Label>{t("admin:last_name")}</Label><Input value={newLastName} onChange={(e) => setNewLastName(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>{t("admin:email_required")}</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("admin:password_required")}</Label>
                <Button type="button" size="sm" variant="ghost" onClick={() => setNewPassword(generateStrongPassword())}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />{t("auth:admin_generate")}
                </Button>
              </div>
              <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <PasswordStrengthMeter password={newPassword} />
            </div>

            <div className="space-y-2"><Label>{t("admin:short_code_required")}</Label><Input value={newShortCode} onChange={(e) => setNewShortCode(e.target.value.toUpperCase())} maxLength={3} placeholder={t("admin:short_code_placeholder")} /></div>
            <div className="space-y-2">
              <Label>{t("admin:role")}</Label>
              <Select value={newCustomRoleId} onValueChange={setNewCustomRoleId}>
                <SelectTrigger><SelectValue placeholder={t("admin:select_role")} /></SelectTrigger>
                <SelectContent>{customRoles.map((r) => (<SelectItem key={r.id} value={r.id}>{r.name}{r.is_system ? ` (${t("admin:role_type_system")})` : ""}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetCreateForm(); }}>{t("common:cancel")}</Button>
            <Button onClick={handleCreate} disabled={createUser.isPending}>{createUser.isPending ? t("common:creating") : t("common:create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={(v) => { if (!v) setEditUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin:edit_user_title")}</DialogTitle>
            <DialogDescription>{t("admin:edit_user_description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>{t("admin:first_name")}</Label><Input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} /></div>
              <div className="space-y-2"><Label>{t("admin:last_name")}</Label><Input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>{t("admin:short_code_required")}</Label><Input value={editShortCode} onChange={(e) => setEditShortCode(e.target.value.toUpperCase())} maxLength={3} placeholder={t("admin:short_code_placeholder")} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>{t("common:cancel")}</Button>
            <Button onClick={handleEdit} disabled={updateProfile.isPending}>{updateProfile.isPending ? t("common:saving") : t("common:save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin:delete_user_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin:delete_user_description", { name: `${deleteTarget?.first_name} ${deleteTarget?.last_name}` })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("common:delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {scheduleUser && (
        <UserWorkScheduleDialog
          open={!!scheduleUser}
          onOpenChange={(v) => { if (!v) setScheduleUser(null); }}
          userId={scheduleUser.user_id}
          userName={`${scheduleUser.first_name} ${scheduleUser.last_name}`}
        />
      )}

      <Dialog open={!!resetUser} onOpenChange={(v) => { if (!v) { setResetUser(null); setResetPasswordValue(""); setResetDoneValue(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("auth:admin_reset_title")} – {resetUser?.first_name} {resetUser?.last_name}</DialogTitle>
            <DialogDescription>{t("auth:admin_reset_description")}</DialogDescription>
          </DialogHeader>
          {resetDoneValue ? (
            <div className="space-y-3">
              <p className="text-sm">{t("auth:admin_reset_done")}</p>
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted font-mono text-sm break-all">
                <span className="flex-1">{resetDoneValue}</span>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(resetDoneValue); toast.success(t("auth:copied")); }}>
                  <Copy className="h-3.5 w-3.5 mr-1" />{t("auth:copy")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t("auth:new_password")}</Label>
                <Button type="button" size="sm" variant="ghost" onClick={() => setResetPasswordValue(generateStrongPassword())}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />{t("auth:admin_generate")}
                </Button>
              </div>
              <PasswordInput value={resetPasswordValue} onChange={(e) => setResetPasswordValue(e.target.value)} />
              <PasswordStrengthMeter password={resetPasswordValue} />
            </div>
          )}
          <DialogFooter>
            {resetDoneValue ? (
              <Button onClick={() => { setResetUser(null); setResetPasswordValue(""); setResetDoneValue(null); }}>{t("common:close", "Schließen")}</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setResetUser(null)}>{t("common:cancel")}</Button>
                <Button onClick={handleReset} disabled={resetPassword.isPending || !validatePassword(resetPasswordValue).valid}>
                  {resetPassword.isPending ? t("common:saving") : t("auth:admin_reset_button")}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}
