import { useMemo, useState } from "react";
import { useAllServices } from "@/hooks/useMeasurements";
import { useDurchfuehrer } from "@/hooks/useMeasurements";
import { useServicePermissions, useToggleServicePermission, usePermissionAuditLog } from "@/hooks/useServicePermissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AdminPermissionsPage() {
  const { t, i18n } = useTranslation(["admin", "common"]);
  const { data: services, isLoading: loadingServices } = useAllServices();
  const { data: users, isLoading: loadingUsers } = useDurchfuehrer();
  const { data: permissions, isLoading: loadingPerms } = useServicePermissions();
  const { data: auditLog } = usePermissionAuditLog();
  const toggleMutation = useToggleServicePermission();

  const [userQuery, setUserQuery] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
  const [onlyRelevant, setOnlyRelevant] = useState(false);

  const permSet = useMemo(() => {
    const s = new Set<string>();
    (permissions || []).forEach((p: any) => s.add(`${p.user_id}__${p.service_id}`));
    return s;
  }, [permissions]);

  const activeServices = useMemo(() => (services || []).filter((s: any) => s.active), [services]);
  const isLoading = loadingServices || loadingUsers || loadingPerms;

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    return (users || []).filter((u: any) =>
      !q || `${u.first_name ?? ""} ${u.last_name ?? ""}`.toLowerCase().includes(q),
    );
  }, [users, userQuery]);

  const filteredServices = useMemo(() => {
    const q = serviceQuery.trim().toLowerCase();
    let list = activeServices;
    if (q) {
      list = list.filter((s: any) =>
        (s.service_name ?? "").toLowerCase().includes(q) ||
        (s.category ?? "").toLowerCase().includes(q),
      );
    }
    if (onlyRelevant) {
      list = list.filter((s: any) =>
        (users || []).some((u: any) => permSet.has(`${u.user_id}__${s.id}`)),
      );
    }
    return list;
  }, [activeServices, serviceQuery, onlyRelevant, users, permSet]);

  if (isLoading) {
    return <div className="flex items-center justify-center p-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  const handleToggle = (userId: string, serviceId: string, current: boolean) => {
    toggleMutation.mutate({ userId, serviceId, granted: !current });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("admin:permissions_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin:permissions_subtitle")}</p>
      </div>

      <Tabs defaultValue="matrix">
        <TabsList>
          <TabsTrigger value="matrix">{t("admin:permissions_matrix")}</TabsTrigger>
          <TabsTrigger value="audit">{t("admin:permissions_audit")}</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="mt-4">
          {(!users || users.length === 0) ? (
            <p className="text-muted-foreground">{t("admin:no_technicians")}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t("admin:permissions_technician")}</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      placeholder="Mitarbeiter suchen…"
                      className="pl-8 h-9 w-56"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Kompetenz</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={serviceQuery}
                      onChange={(e) => setServiceQuery(e.target.value)}
                      placeholder="Kompetenz suchen…"
                      className="pl-8 h-9 w-56"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm h-9">
                  <Checkbox checked={onlyRelevant} onCheckedChange={(v) => setOnlyRelevant(!!v)} />
                  Nur zugewiesene Kompetenzen
                </label>
                <div className="ml-auto text-xs text-muted-foreground">
                  {filteredUsers.length} × {filteredServices.length}
                </div>
              </div>

              <div className="rounded-md border relative overflow-auto max-h-[75vh]">
                <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="sticky top-0 left-0 z-30 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80 border-b border-r px-4 h-12 text-left align-middle font-medium text-muted-foreground min-w-[200px] shadow-[1px_1px_0_0_hsl(var(--border))]">
                        {t("admin:permissions_technician")}
                      </th>
                      {filteredServices.map((s: any) => (
                        <th
                          key={s.id}
                          className="sticky top-0 z-20 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80 border-b px-2 h-12 text-center align-middle font-medium text-muted-foreground min-w-[120px] text-xs"
                        >
                          <div className="truncate" title={s.service_name}>{s.service_name}</div>
                          <div className="text-muted-foreground font-normal text-[10px]">
                            {s.category === "labor" ? t("common:category_labor") : t("common:category_pilot_plant")}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u: any) => (
                      <tr key={u.user_id} className="hover:bg-muted/30">
                        <td className="sticky left-0 z-10 bg-background border-b border-r px-4 py-2 align-middle font-medium whitespace-nowrap shadow-[1px_0_0_0_hsl(var(--border))]">
                          {u.first_name} {u.last_name}
                        </td>
                        {filteredServices.map((s: any) => {
                          const key = `${u.user_id}__${s.id}`;
                          const isGranted = permSet.has(key);
                          return (
                            <td key={s.id} className="border-b px-2 py-2 text-center align-middle">
                              <Checkbox checked={isGranted} disabled={toggleMutation.isPending} onCheckedChange={() => handleToggle(u.user_id, s.id, isGranted)} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          {(!auditLog || auditLog.length === 0) ? (
            <p className="text-muted-foreground">{t("admin:no_changes")}</p>
          ) : (
            <div className="rounded-md border overflow-auto max-h-[70vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin:audit_time")}</TableHead>
                    <TableHead>{t("admin:audit_action")}</TableHead>
                    <TableHead>{t("admin:audit_user")}</TableHead>
                    <TableHead>{t("admin:audit_service")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLog.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">{format(new Date(log.changed_at), "dd.MM.yyyy HH:mm")}</TableCell>
                      <TableCell>
                        <span className={log.action === "granted" ? "text-green-600" : "text-destructive"}>
                          {log.action === "granted" ? t("admin:permission_granted") : t("admin:permission_revoked")}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{log.user_id.slice(0, 8)}…</TableCell>
                      <TableCell className="text-xs font-mono">{log.service_id.slice(0, 8)}…</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
