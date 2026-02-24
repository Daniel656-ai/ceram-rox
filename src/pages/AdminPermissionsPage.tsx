import { useMemo } from "react";
import { useAllServices } from "@/hooks/useMeasurements";
import { useDurchfuehrer } from "@/hooks/useMeasurements";
import { useServicePermissions, useToggleServicePermission, usePermissionAuditLog } from "@/hooks/useServicePermissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export default function AdminPermissionsPage() {
  const { data: services, isLoading: loadingServices } = useAllServices();
  const { data: users, isLoading: loadingUsers } = useDurchfuehrer();
  const { data: permissions, isLoading: loadingPerms } = useServicePermissions();
  const { data: auditLog } = usePermissionAuditLog();
  const toggleMutation = useToggleServicePermission();

  const permSet = useMemo(() => {
    const s = new Set<string>();
    (permissions || []).forEach((p: any) => s.add(`${p.user_id}__${p.service_id}`));
    return s;
  }, [permissions]);

  const activeServices = useMemo(
    () => (services || []).filter((s: any) => s.active),
    [services]
  );

  const isLoading = loadingServices || loadingUsers || loadingPerms;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const handleToggle = (userId: string, serviceId: string, current: boolean) => {
    toggleMutation.mutate({ userId, serviceId, granted: !current });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Berechtigungs-Matrix</h1>
        <p className="text-sm text-muted-foreground">
          Legen Sie fest, welche Messdienstleister welche Messungen durchführen dürfen.
        </p>
      </div>

      <Tabs defaultValue="matrix">
        <TabsList>
          <TabsTrigger value="matrix">Matrix</TabsTrigger>
          <TabsTrigger value="audit">Änderungsprotokoll</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="mt-4">
          {(!users || users.length === 0) ? (
            <p className="text-muted-foreground">Keine Messdienstleister vorhanden.</p>
          ) : (
            <div className="rounded-md border overflow-auto max-h-[70vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]">Messdienstleister</TableHead>
                    {activeServices.map((s: any) => (
                      <TableHead key={s.id} className="text-center min-w-[120px] text-xs">
                        <div>{s.service_name}</div>
                        <div className="text-muted-foreground font-normal">{s.category === "labor" ? "Labor" : "Technikum"}</div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(users || []).map((u: any) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">
                        {u.first_name} {u.last_name}
                      </TableCell>
                      {activeServices.map((s: any) => {
                        const key = `${u.user_id}__${s.id}`;
                        const isGranted = permSet.has(key);
                        return (
                          <TableCell key={s.id} className="text-center">
                            <Checkbox
                              checked={isGranted}
                              disabled={toggleMutation.isPending}
                              onCheckedChange={() => handleToggle(u.user_id, s.id, isGranted)}
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          {(!auditLog || auditLog.length === 0) ? (
            <p className="text-muted-foreground">Noch keine Änderungen protokolliert.</p>
          ) : (
            <div className="rounded-md border overflow-auto max-h-[70vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zeitpunkt</TableHead>
                    <TableHead>Aktion</TableHead>
                    <TableHead>MDL (User-ID)</TableHead>
                    <TableHead>Service-ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLog.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(new Date(log.changed_at), "dd.MM.yyyy HH:mm", { locale: de })}
                      </TableCell>
                      <TableCell>
                        <span className={log.action === "granted" ? "text-green-600" : "text-destructive"}>
                          {log.action === "granted" ? "Berechtigt" : "Entzogen"}
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
