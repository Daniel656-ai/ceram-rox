import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Briefcase, Flag, CheckCircle2, AlertTriangle, Clock, FileText, Save,
} from "lucide-react";
import { toast } from "sonner";

const LIGHTS = [
  { value: "green", label: "Grün – Auf Kurs", cls: "bg-emerald-500", ring: "ring-emerald-500", text: "text-emerald-600" },
  { value: "yellow", label: "Gelb – Achtung", cls: "bg-amber-500", ring: "ring-amber-500", text: "text-amber-600" },
  { value: "red", label: "Rot – Kritisch", cls: "bg-red-500", ring: "ring-red-500", text: "text-red-600" },
];

interface Props {
  portfolioId: string;
  portfolio: any;
  canEdit: boolean;
}

export default function PortfolioDashboardTab({ portfolioId, portfolio, canEdit }: Props) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<any>({
    queryKey: ["portfolio-dashboard", portfolioId],
    queryFn: () => api.portfolioDashboard.get(portfolioId),
  });

  const [light, setLight] = useState<string>(portfolio.traffic_light ?? "green");
  const [note, setNote] = useState<string>(portfolio.health_note ?? "");

  useEffect(() => {
    setLight(portfolio.traffic_light ?? "green");
    setNote(portfolio.health_note ?? "");
  }, [portfolio.id, portfolio.traffic_light, portfolio.health_note]);

  const saveHealth = useMutation({
    mutationFn: () => api.portfolioDashboard.updateHealth(portfolioId, {
      traffic_light: light,
      health_note: note.trim() || null,
    }),
    onSuccess: () => {
      toast.success("Ampelstatus gespeichert");
      qc.invalidateQueries({ queryKey: ["portfolio", portfolioId] });
    },
    onError: (e: any) => toast.error(e?.message || "Fehler"),
  });

  const currentLight = LIGHTS.find((l) => l.value === (portfolio.traffic_light ?? "green")) ?? LIGHTS[0];

  return (
    <div className="space-y-4">
      {/* Ampelstatus Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Flag className={`h-4 w-4 ${currentLight.text}`} /> Portfolio-Ampelstatus
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className={`h-14 w-14 rounded-full ${currentLight.cls} ring-4 ring-offset-2 ${currentLight.ring} ring-offset-background`} />
            <div>
              <div className="text-lg font-semibold">{currentLight.label}</div>
              {portfolio.health_updated_at && (
                <div className="text-xs text-muted-foreground">
                  Zuletzt aktualisiert: {new Date(portfolio.health_updated_at).toLocaleString("de-DE")}
                </div>
              )}
              {portfolio.health_note && (
                <div className="text-sm mt-1 max-w-xl">{portfolio.health_note}</div>
              )}
            </div>
          </div>

          {canEdit && (
            <div className="border-t pt-4 space-y-3">
              <div>
                <Label className="text-xs uppercase tracking-wide">Neuer Status</Label>
                <div className="flex gap-2 mt-1">
                  {LIGHTS.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => setLight(l.value)}
                      className={`flex-1 flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition
                        ${light === l.value ? "border-primary ring-2 ring-primary/40 bg-primary/5" : "hover:bg-muted"}`}
                    >
                      <span className={`h-3 w-3 rounded-full ${l.cls}`} />
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Begründung / Kommentar</Label>
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Verzögerung Antrag, Ressourcenengpass, …" />
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={() => saveHealth.mutate()} disabled={saveHealth.isPending}>
                  <Save className="h-4 w-4 mr-2" /> Speichern
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<Briefcase className="h-4 w-4" />} label="Projekte" value={data?.projects_total ?? 0} loading={isLoading} />
        <Kpi icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="Meilensteine erledigt" value={`${data?.milestones_done ?? 0} / ${data?.milestones_total ?? 0}`} loading={isLoading} />
        <Kpi icon={<AlertTriangle className="h-4 w-4 text-red-600" />} label="Überfällig" value={data?.milestones_overdue ?? 0} loading={isLoading} tone={data?.milestones_overdue > 0 ? "danger" : undefined} />
        <Kpi icon={<Clock className="h-4 w-4 text-amber-600" />} label="Nächste 30 Tage" value={data?.milestones_upcoming ?? 0} loading={isLoading} />
        <Kpi icon={<FileText className="h-4 w-4" />} label="Dokumente" value={data?.documents_total ?? 0} loading={isLoading} />
      </div>

      {/* Next milestone */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nächster offener Meilenstein</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Lade …</p>
          ) : data?.next_milestone ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">{data.next_milestone.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Fällig: {data.next_milestone.due_date ? new Date(data.next_milestone.due_date).toLocaleDateString("de-DE") : "—"}
                  {data.next_milestone.source === "project" && data.next_milestone.project_number && (
                    <> · Projekt: {data.next_milestone.project_number} {data.next_milestone.project_name ?? ""}</>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{data.next_milestone.source === "project" ? "Projekt" : "Portfolio"}</Badge>
                <Badge variant="outline">{data.next_milestone.status}</Badge>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Keine offenen Meilensteine.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon, label, value, loading, tone }: {
  icon: React.ReactNode; label: string; value: React.ReactNode; loading?: boolean; tone?: "danger";
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className={`mt-1 text-2xl font-semibold ${tone === "danger" ? "text-red-600" : ""}`}>
          {loading ? "…" : value}
        </div>
      </CardContent>
    </Card>
  );
}
