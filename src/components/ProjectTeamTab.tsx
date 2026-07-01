import { useTranslation } from "react-i18next";
import { useProjectMembers, useAddProjectMember, useUpdateProjectMember, useRemoveProjectMember } from "@/hooks/useProjectMembers";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserPlus, Trash2, Crown, ShieldCheck, User, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const ROLE_ICONS: Record<string, any> = {
  owner: Crown,
  leader: ShieldCheck,
  member: User,
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  leader: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  member: "bg-muted text-muted-foreground",
};

interface Props {
  projectId: string;
  canManage: boolean;
}

export function ProjectTeamTab({ projectId, canManage }: Props) {
  const { t } = useTranslation("projects");
  const { user } = useAuth();
  const { data: members = [], isLoading } = useProjectMembers(projectId);
  const { data: users = [] } = useUsers();
  const addMember = useAddProjectMember();
  const updateMember = useUpdateProjectMember();
  const removeMember = useRemoveProjectMember();

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("member");
  const [searchQuery, setSearchQuery] = useState("");

  const memberUserIds = new Set((members as any[]).map((m: any) => m.user_id));
  const availableUsers = (users as any[]).filter((u: any) => u.is_active && !memberUserIds.has(u.user_id));

  const sortedFilteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = availableUsers.slice();
    if (q) {
      list = list.filter((u: any) =>
        (u.first_name || "").toLowerCase().includes(q) ||
        (u.last_name || "").toLowerCase().includes(q)
      );
    }
    list.sort((a: any, b: any) => {
      const ln = (a.last_name || "").localeCompare(b.last_name || "", "de");
      if (ln !== 0) return ln;
      return (a.first_name || "").localeCompare(b.first_name || "", "de");
    });
    return list;
  }, [availableUsers, searchQuery]);

  const getUserName = (userId: string) => {
    const u = (users as any[]).find((u: any) => u.user_id === userId);
    return u ? `${u.first_name} ${u.last_name}`.trim() || "–" : "–";
  };

  const handleAdd = async () => {
    if (!selectedUserId) return;
    try {
      await addMember.mutateAsync({ project_id: projectId, user_id: selectedUserId, role: selectedRole });
      toast.success(t("team_member_added"));
      setSelectedUserId("");
      setSelectedRole("member");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      await updateMember.mutateAsync({ id: memberId, role: newRole, projectId });
      toast.success(t("team_role_updated"));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRemove = async (memberId: string) => {
    try {
      await removeMember.mutateAsync({ id: memberId, projectId });
      toast.success(t("team_member_removed"));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("tab_team")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && (
          <div className="flex items-end gap-3 p-4 rounded-lg border bg-muted/30">
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">{t("team_add_person")}</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("team_select_person")} />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((u: any) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.first_name} {u.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("team_role")}</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">{t("role_owner")}</SelectItem>
                  <SelectItem value="leader">{t("role_leader")}</SelectItem>
                  <SelectItem value="member">{t("role_member")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAdd} disabled={!selectedUserId || addMember.isPending}>
              <UserPlus className="h-4 w-4 mr-2" />{t("team_add")}
            </Button>
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("team_person")}</TableHead>
              <TableHead>{t("team_role")}</TableHead>
              <TableHead>{t("team_since")}</TableHead>
              {canManage && <TableHead className="w-24"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8">{t("loading")}</TableCell></TableRow>
            ) : (members as any[]).length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">{t("team_no_members")}</TableCell></TableRow>
            ) : (
              (members as any[]).map((m: any) => {
                const Icon = ROLE_ICONS[m.role] || User;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{getUserName(m.user_id)}</TableCell>
                    <TableCell>
                      {canManage ? (
                        <Select value={m.role} onValueChange={(v) => handleRoleChange(m.id, v)}>
                          <SelectTrigger className="w-44">
                            <div className="flex items-center gap-2">
                              <Icon className="h-3.5 w-3.5" />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">{t("role_owner")}</SelectItem>
                            <SelectItem value="leader">{t("role_leader")}</SelectItem>
                            <SelectItem value="member">{t("role_member")}</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={ROLE_COLORS[m.role] || ""}>
                          <Icon className="h-3 w-3 mr-1" />
                          {t(`role_${m.role}`)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString("de-DE")}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("team_remove_title")}</AlertDialogTitle>
                              <AlertDialogDescription>{t("team_remove_desc")}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("cancel", { ns: "common" })}</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => handleRemove(m.id)}>
                                {t("delete", { ns: "common" })}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
