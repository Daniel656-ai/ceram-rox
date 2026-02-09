import { useUsers, useUpdateUserRole, useUpdateUserStatus } from "@/hooks/useUsers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  master: "Administrator",
  auftraggeber: "Auftraggeber",
  durchfuehrer: "Messdienstleister",
};

export default function AdminUsersPage() {
  const { data: users = [], isLoading } = useUsers();
  const updateRole = useUpdateUserRole();
  const updateStatus = useUpdateUserStatus();

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Benutzerverwaltung</h1>
        <p className="text-muted-foreground">Verwaltung aller registrierten Benutzer</p>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8">Laden...</TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8">Keine Benutzer gefunden</TableCell></TableRow>
              ) : (
                users.map((u: any) => {
                  const role = u.user_roles?.[0]?.role || "auftraggeber";
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{u.first_name} {u.last_name}</p>
                        </div>
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
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
