import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

export default function Dashboard() {
  const { profile, role } = useAuth();

  const greeting = profile?.first_name
    ? `Willkommen, ${profile.first_name}!`
    : "Willkommen!";

  const roleLabel =
    role === "master" ? "Administrator" :
    role === "auftraggeber" ? "Auftraggeber" :
    role === "durchfuehrer" ? "Durchführer" : "";

  const stats = [
    { title: "Gesamt Aufträge", value: "0", icon: ClipboardList, color: "text-primary" },
    { title: "In Bearbeitung", value: "0", icon: Clock, color: "text-warning" },
    { title: "Abgeschlossen", value: "0", icon: CheckCircle2, color: "text-success" },
    { title: "Hohe Priorität", value: "0", icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{greeting}</h1>
        <p className="text-muted-foreground">
          {roleLabel}-Dashboard – Überblick über Ihre Aktivitäten
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Letzte Aktivitäten</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Noch keine Aktivitäten vorhanden. Erstellen Sie Ihren ersten Auftrag!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
