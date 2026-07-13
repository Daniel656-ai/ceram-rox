import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OriginBadge } from "@/components/workflow/OriginBadge";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Inbox } from "lucide-react";

export default function WorkPage() {
  const { user, role } = useAuth();
  const roles = useMemo(() => (role ? [role] : []), [role]);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["my-work-tasks", user?.id, roles],
    queryFn: () => api.workTasks.listMine(user!.id, roles),
    enabled: !!user,
  });

  const grouped = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const t of tasks) {
      const key = t.order?.origin ?? "sonstiges";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(t);
    }
    return Array.from(m.entries());
  }, [tasks]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Meine Arbeit</h1>
        <p className="text-muted-foreground">Offene Prozessschritte, gruppiert nach Ursprung.</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Lädt …</p>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Inbox className="h-10 w-10" />
            <p>Keine offenen Schritte.</p>
          </CardContent>
        </Card>
      ) : (
        grouped.map(([origin, list]) => (
          <Card key={origin}>
            <CardHeader className="flex flex-row items-center gap-3 pb-3">
              <OriginBadge originKey={origin} />
              <CardTitle className="text-lg">{list.length} offen</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {list.map((t: any) => (
                <Link
                  key={t.id}
                  to={`/arbeit/${t.order_id}?task=${t.id}`}
                  className="group flex items-center justify-between rounded-lg border bg-background p-4 transition hover:border-primary hover:shadow-md"
                >
                  <div className="flex flex-col gap-1">
                    <div className="font-mono text-xl font-bold">
                      {t.order?.reference_number ?? t.order?.order_number ?? "—"}
                    </div>
                    <div className="text-sm text-foreground">{t.step?.name ?? "Schritt"}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {t.order?.projects && (
                        <span>{t.order.projects.project_number}</span>
                      )}
                      <Badge variant="outline" className="ml-auto">{t.status}</Badge>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
                </Link>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
