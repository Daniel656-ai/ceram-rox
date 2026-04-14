import { useState } from "react";
import { useCustomRoles, useCreateCustomRole, useUpdateCustomRole, useDeleteCustomRole, CustomRole } from "@/hooks/useCustomRoles";
import { ALL_PERMISSIONS, PERMISSION_GROUPS, PERMISSION_LABELS, PermissionKey, NAV_PERMISSIONS, NAV_TREE, NAV_PERMISSION_LABELS } from "@/hooks/usePermissions";
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
import { Plus, Pencil, Trash2, Shield, Lock, ChevronRight, ChevronDown, Eye } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function AdminRolesPage() {
  const { t, i18n } = useTranslation(["admin", "common"]);
  const lang = i18n.language?.startsWith("de") ? "de" : "en";
  const { data: roles = [], isLoading } = useCustomRoles();
  const createRole = useCreateCustomRole();
  const updateRole = useUpdateCustomRole();
  const deleteRole = useDeleteCustomRole();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomRole | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseRole, setBaseRole] = useState("auftraggeber");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [selectedNavPerms, setSelectedNavPerms] = useState<Set<string>>(new Set());
  const [adminOpen, setAdminOpen] = useState(true);

  const resetForm = () => { setName(""); setDescription(""); setBaseRole("auftraggeber"); setSelectedPerms(new Set()); setSelectedNavPerms(new Set()); setEditingRole(null); setAdminOpen(true); };
  const openCreate = () => { resetForm(); setDialogOpen(true); };
  const openEdit = (role: CustomRole) => {
    setName(role.name);
    setDescription(role.description || "");
    setBaseRole(role.base_role);
    const funcPerms = new Set(role.permissions.filter((p) => !p.startsWith("nav.")));
    const navPerms = new Set(role.permissions.filter((p) => p.startsWith("nav.")));
    setSelectedPerms(funcPerms);
    setSelectedNavPerms(navPerms);
    setEditingRole(role);
    setDialogOpen(true);
  };
  const togglePerm = (perm: string) => { setSelectedPerms((prev) => { const next = new Set(prev); if (next.has(perm)) next.delete(perm); else next.add(perm); return next; }); };
  const toggleGroup = (perms: string[]) => { const allSelected = perms.every((p) => selectedPerms.has(p)); setSelectedPerms((prev) => { const next = new Set(prev); perms.forEach((p) => (allSelected ? next.delete(p) : next.add(p))); return next; }); };
  const selectAll = () => setSelectedPerms(new Set(ALL_PERMISSIONS));
  const selectNone = () => setSelectedPerms(new Set());

  const toggleNavPerm = (key: string) => {
    setSelectedNavPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        // If toggling off a parent, also remove children
        if (key === "nav.admin") {
          NAV_PERMISSIONS.forEach((p) => { if (p.startsWith("nav.admin.")) next.delete(p); });
        }
      } else {
        next.add(key);
        // If toggling on a parent, also add children
        if (key === "nav.admin") {
          NAV_PERMISSIONS.forEach((p) => { if (p.startsWith("nav.admin.")) next.add(p); });
        }
        // If toggling on a child, ensure parent is on
        if (key.startsWith("nav.admin.")) {
          next.add("nav.admin");
        }
      }
      return next;
    });
  };

  const selectAllNav = () => setSelectedNavPerms(new Set(NAV_PERMISSIONS));
  const selectNoneNav = () => setSelectedNavPerms(new Set());

  const handleSave = async () => {
    if (!name.trim()) { toast.error(t("admin:name_required")); return; }
    try {
      const perms = [...Array.from(selectedPerms), ...Array.from(selectedNavPerms)];
      if (editingRole) { await updateRole.mutateAsync({ id: editingRole.id, name, description, base_role: baseRole, permissions: perms }); toast.success(t("admin:role_updated")); }
      else { await createRole.mutateAsync({ name, description, base_role: baseRole, permissions: perms }); toast.success(t("admin:role_created")); }
      setDialogOpen(false); resetForm();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteRole.mutateAsync(deleteTarget.id); toast.success(t("admin:role_deleted")); setDeleteTarget(null); }
    catch (err: any) { toast.error(err.message); }
  };

  const funcPermCount = (role: CustomRole) => role.permissions.filter((p) => !p.startsWith("nav.")).length;
  const navPermCount = (role: CustomRole) => role.permissions.filter((p) => p.startsWith("nav.")).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Shield className="h-6 w-6" />{t("admin:roles_title")}</h1>
          <p className="text-muted-foreground">{t("admin:roles_subtitle")}</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />{t("admin:new_role")}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin:role")}</TableHead>
                <TableHead>{t("common:description")}</TableHead>
                <TableHead>{t("admin:role_base")}</TableHead>
                <TableHead>{t("admin:role_permissions_count")}</TableHead>
                <TableHead><Eye className="h-4 w-4 inline mr-1" />{t("admin:nav_visibility")}</TableHead>
                <TableHead>{t("admin:role_type")}</TableHead>
                <TableHead className="w-[100px]">{t("common:actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">{t("common:loading")}</TableCell></TableRow>
              ) : roles.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">{t("admin:no_roles")}</TableCell></TableRow>
              ) : (
                roles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{r.description || "–"}</TableCell>
                    <TableCell><Badge variant="outline">{t(`admin:base_role_${r.base_role}`)}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{funcPermCount(r)} / {ALL_PERMISSIONS.length}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{navPermCount(r)} / {NAV_PERMISSIONS.length}</Badge></TableCell>
                    <TableCell>
                      {r.is_system ? (
                        <Badge variant="default" className="gap-1"><Lock className="h-3 w-3" />{t("admin:role_type_system")}</Badge>
                      ) : (
                        <Badge variant="outline">{t("admin:role_type_custom")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        {!r.is_system && (<Button variant="ghost" size="icon" onClick={() => setDeleteTarget(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) { setDialogOpen(false); resetForm(); } else setDialogOpen(v); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? t("admin:edit_role") : t("admin:create_role")}</DialogTitle>
            <DialogDescription>{t("admin:role_define_description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("admin:role_name")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("admin:role_name_placeholder")} disabled={editingRole?.is_system} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin:role_base")}</Label>
                <Select value={baseRole} onValueChange={setBaseRole} disabled={editingRole?.is_system}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="master">{t("admin:base_role_master")}</SelectItem>
                    <SelectItem value="auftraggeber">{t("admin:base_role_auftraggeber")}</SelectItem>
                    <SelectItem value="durchfuehrer">{t("admin:base_role_durchfuehrer")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>{t("admin:role_description")}</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>

            {/* Functional Permissions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t("admin:role_permissions")}</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>{t("common:all")}</Button>
                  <Button variant="outline" size="sm" onClick={selectNone}>{t("common:none")}</Button>
                </div>
              </div>
              {PERMISSION_GROUPS.map((group) => {
                const allInGroup = group.permissions.every((p) => selectedPerms.has(p));
                return (
                  <Card key={group.key}>
                    <CardHeader className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={allInGroup} onCheckedChange={() => toggleGroup(group.permissions)} />
                        <CardTitle className="text-sm font-medium">{lang === "de" ? group.labelDe : group.labelEn}</CardTitle>
                        <Badge variant="secondary" className="ml-auto text-xs">{group.permissions.filter((p) => selectedPerms.has(p)).length}/{group.permissions.length}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="py-2 px-4">
                      <div className="grid grid-cols-2 gap-2">
                        {group.permissions.map((perm) => (
                          <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded p-1">
                            <Checkbox checked={selectedPerms.has(perm)} onCheckedChange={() => togglePerm(perm)} />
                            <span>{PERMISSION_LABELS[perm as PermissionKey]?.[lang] || perm}</span>
                          </label>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Navigation Visibility */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold flex items-center gap-2"><Eye className="h-4 w-4" />{t("admin:nav_visibility")}</Label>
                  <p className="text-xs text-muted-foreground mt-1">{t("admin:nav_visibility_description")}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllNav}>{t("admin:nav_select_all")}</Button>
                  <Button variant="outline" size="sm" onClick={selectNoneNav}>{t("admin:nav_select_none")}</Button>
                </div>
              </div>

              <Card>
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-sm font-medium">{t("admin:nav_main_sections")}</CardTitle>
                </CardHeader>
                <CardContent className="py-2 px-4 space-y-1">
                  {NAV_TREE.filter((n) => n.key !== "nav.admin").map((node) => (
                    <label key={node.key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded p-1.5">
                      <Checkbox checked={selectedNavPerms.has(node.key)} onCheckedChange={() => toggleNavPerm(node.key)} />
                      <span>{NAV_PERMISSION_LABELS[node.key]?.[lang]}</span>
                    </label>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="py-0 px-0">
                  <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-2 py-2 px-4 cursor-pointer hover:bg-muted/50 rounded-t">
                        {adminOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <Checkbox
                          checked={selectedNavPerms.has("nav.admin")}
                          onCheckedChange={() => toggleNavPerm("nav.admin")}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm font-medium">{t("admin:nav_admin_sections")}</span>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {NAV_TREE.find((n) => n.key === "nav.admin")?.children?.filter((c) => selectedNavPerms.has(c.key)).length || 0}
                          /{NAV_TREE.find((n) => n.key === "nav.admin")?.children?.length || 0}
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-3 ml-6 space-y-1 border-l-2 border-muted">
                        {NAV_TREE.find((n) => n.key === "nav.admin")?.children?.map((child) => (
                          <label key={child.key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded p-1.5">
                            <Checkbox checked={selectedNavPerms.has(child.key)} onCheckedChange={() => toggleNavPerm(child.key)} />
                            <span>{NAV_PERMISSION_LABELS[child.key]?.[lang]}</span>
                          </label>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>{t("common:cancel")}</Button>
            <Button onClick={handleSave} disabled={createRole.isPending || updateRole.isPending}>
              {(createRole.isPending || updateRole.isPending) ? t("common:saving") : t("common:save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin:delete_role_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin:delete_role_description", { name: deleteTarget?.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("common:delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
