import { useState } from "react";
import { useWorkstationUtilization, TimePeriod } from "@/hooks/useUtilization";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

const PERIOD_LABELS: Record<TimePeriod, string> = {
  week: "Woche",
  month: "Monat",
  quarter: "Quartal",
  year: "Jahr",
};

export function UtilizationSidebar() {
  const [period, setPeriod] = useState<TimePeriod>("month");
  const { data: utilization = [], isLoading } = useWorkstationUtilization(period);

  const avgUtilization = utilization.length > 0
    ? Math.round(utilization.reduce((s, u) => s + u.utilization, 0) / utilization.length * 10) / 10
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Auslastung
          </CardTitle>
          <Select value={period} onValueChange={(v) => setPeriod(v as TimePeriod)}>
            <SelectTrigger className="w-24 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PERIOD_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Overall */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Gesamt</span>
            <span className="font-medium">{avgUtilization}%</span>
          </div>
          <Progress value={avgUtilization} className="h-2" />
        </div>

        {isLoading ? (
          <div className="text-xs text-muted-foreground">Laden...</div>
        ) : (
          <div className="space-y-2">
            {utilization.map((ws) => (
              <div key={ws.id}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="truncate max-w-[120px]">{ws.name}</span>
                  <span className={`font-medium ${ws.utilization > 90 ? "text-destructive" : ws.utilization > 70 ? "text-warning" : "text-muted-foreground"}`}>
                    {ws.utilization}%
                  </span>
                </div>
                <Progress
                  value={ws.utilization}
                  className={`h-1.5 ${ws.utilization > 90 ? "[&>div]:bg-destructive" : ws.utilization > 70 ? "[&>div]:bg-warning" : ""}`}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
