import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, BarChart, Bar,
} from "recharts";

function fmtHours(v: number | null | undefined) {
  if (v == null) return "—";
  return Number(v).toLocaleString("de-DE", { maximumFractionDigits: 2 });
}
function fmtEuro(v: number | null | undefined) {
  if (v == null) return "—";
  return `${formatCurrency(v)} €`;
}
const CAT_LABEL: Record<string, string> = {
  personal: "Personal",
  verbrauchsmaterial: "Verbrauchsmaterial",
  knetung: "Knetung",
  aufwendung: "Aufwendung",
};

export default function PortfolioAnalyticsTab({ portfolioId }: { portfolioId: string }) {
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const s = start || null;
  const e = end || null;

  const key = ["portfolio-analytics", portfolioId, s, e] as const;

  const summary = useQuery({
    queryKey: [...key, "summary"],
    queryFn: () => api.portfolioAnalytics.summary(portfolioId, s, e),
  });
  const hoursByProject = useQuery({
    queryKey: [...key, "hoursByProject"],
    queryFn: () => api.portfolioAnalytics.hoursByProject(portfolioId, s, e),
  });
  const hoursByPerson = useQuery({
    queryKey: [...key, "hoursByPerson"],
    queryFn: () => api.portfolioAnalytics.hoursByPerson(portfolioId, s, e),
  });
  const hoursByMonth = useQuery({
    queryKey: [...key, "hoursByMonth"],
    queryFn: () => api.portfolioAnalytics.hoursByMonth(portfolioId, s, e),
  });
  const costsByProject = useQuery({
    queryKey: [...key, "costsByProject"],
    queryFn: () => api.portfolioAnalytics.costsByProject(portfolioId, s, e),
  });
  const costsByMonth = useQuery({
    queryKey: [...key, "costsByMonth"],
    queryFn: () => api.portfolioAnalytics.costsByMonth(portfolioId, s, e),
  });
  const personJournal = useQuery({
    queryKey: [...key, "personJournal"],
    queryFn: () => api.portfolioAnalytics.personJournal(portfolioId, s, e),
  });
  const costJournal = useQuery({
    queryKey: [...key, "costJournal"],
    queryFn: () => api.portfolioAnalytics.costJournal(portfolioId, s, e),
  });

  const sum = summary.data;
  const monthCosts = useMemo(
    () => (costsByMonth.data ?? []).map((r: any) => ({
      month: r.month,
      Personal: Number(r.personnel_cost),
      Material: Number(r.material_cost),
      Aufwendungen: Number(r.expenses_cost),
      Gesamt: Number(r.cost_total),
    })),
    [costsByMonth.data]
  );
  const monthHours = useMemo(
    () => (hoursByMonth.data ?? []).map((r: any) => ({ month: r.month, Stunden: Number(r.hours) })),
    [hoursByMonth.data]
  );

  return (
    <div className="space-y-4">
      {/* Filter */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div>
            <Label>Von</Label>
            <Input type="date" value={start} onChange={(ev) => setStart(ev.target.value)} className="w-40" />
          </div>
          <div>
            <Label>Bis</Label>
            <Input type="date" value={end} onChange={(ev) => setEnd(ev.target.value)} className="w-40" />
          </div>
          <Button size="sm" variant="outline" onClick={() => { setStart(""); setEnd(""); }}>
            Zurücksetzen
          </Button>
          <div className="text-xs text-muted-foreground ml-auto">
            Zeitraum wirkt auf alle Auswertungen unten. Personalkosten werden aus abgeschlossenen Messungen
            (Stunden × Stundensatz der Dienstleistung) berechnet.
          </div>
        </CardContent>
      </Card>

      {/* KPI Kacheln */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Kpi label="Projekte" value={`${sum?.project_count ?? 0}`} sub={`${sum?.active_count ?? 0} aktiv · ${sum?.closed_count ?? 0} abgeschlossen`} />
        <Kpi label="Beteiligte Personen" value={`${sum?.people_count ?? 0}`} />
        <Kpi label="Stunden gesamt" value={fmtHours(sum?.hours_total ?? 0)} sub="h" />
        <Kpi label="Kosten gesamt" value={fmtEuro(sum?.cost_total ?? 0)} sub={`Budget ${fmtEuro(sum?.budget_total ?? 0)} · Rest ${fmtEuro(sum?.budget_remaining ?? 0)}`} />
        <Kpi label="Personal" value={fmtEuro(sum?.personnel_cost ?? 0)} />
        <Kpi label="Verbrauchsmaterial" value={fmtEuro(sum?.consumables_cost ?? 0)} />
        <Kpi label="Knetung" value={fmtEuro(sum?.knetung_cost ?? 0)} />
        <Kpi label="Sonstige Aufwendungen" value={fmtEuro(sum?.expenses_cost ?? 0)} />
      </div>

      <Tabs defaultValue="projects">
        <TabsList>
          <TabsTrigger value="projects">Pro Projekt</TabsTrigger>
          <TabsTrigger value="persons">Pro Person</TabsTrigger>
          <TabsTrigger value="time">Zeitliche Entwicklung</TabsTrigger>
          <TabsTrigger value="person-journal">Personenjournal</TabsTrigger>
          <TabsTrigger value="cost-journal">Kostenjournal</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Kosten und Budget pro Projekt</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projekt-Nr.</TableHead>
                    <TableHead>Projekt</TableHead>
                    <TableHead className="text-right">Stunden</TableHead>
                    <TableHead className="text-right">Personal</TableHead>
                    <TableHead className="text-right">Verbrauch</TableHead>
                    <TableHead className="text-right">Knetung</TableHead>
                    <TableHead className="text-right">Sonstige</TableHead>
                    <TableHead className="text-right">Gesamt</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(costsByProject.data ?? []).map((row: any) => {
                    const hoursRow = (hoursByProject.data ?? []).find((h: any) => h.project_id === row.project_id);
                    return (
                      <TableRow key={row.project_id}>
                        <TableCell className="font-mono">{row.project_number}</TableCell>
                        <TableCell>{row.project_name}</TableCell>
                        <TableCell className="text-right">{fmtHours(hoursRow?.hours ?? 0)}</TableCell>
                        <TableCell className="text-right">{fmtEuro(row.personnel_cost)}</TableCell>
                        <TableCell className="text-right">{fmtEuro(row.consumables_cost)}</TableCell>
                        <TableCell className="text-right">{fmtEuro(row.knetung_cost)}</TableCell>
                        <TableCell className="text-right">{fmtEuro(row.expenses_cost)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtEuro(row.cost_total)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmtEuro(row.budget_total)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {(!costsByProject.data || costsByProject.data.length === 0) && (
                    <TableRow><TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">Keine Daten im gewählten Zeitraum.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="persons" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Stunden pro Person</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kürzel</TableHead>
                    <TableHead>Person</TableHead>
                    <TableHead className="text-right">Buchungen</TableHead>
                    <TableHead className="text-right">Projekte</TableHead>
                    <TableHead className="text-right">Stunden</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(hoursByPerson.data ?? []).map((row: any) => (
                    <TableRow key={row.person_id}>
                      <TableCell className="font-mono">{row.short_code ?? "—"}</TableCell>
                      <TableCell>{[row.first_name, row.last_name].filter(Boolean).join(" ") || "—"}</TableCell>
                      <TableCell className="text-right">{row.entries_count}</TableCell>
                      <TableCell className="text-right">{row.project_count}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtHours(row.hours)}</TableCell>
                    </TableRow>
                  ))}
                  {(!hoursByPerson.data || hoursByPerson.data.length === 0) && (
                    <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Keine Zeitbuchungen im gewählten Zeitraum.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Stunden pro Monat</CardTitle></CardHeader>
            <CardContent style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={monthHours}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Stunden" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Kosten pro Monat</CardTitle></CardHeader>
            <CardContent style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <LineChart data={monthCosts}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Personal" stroke="hsl(var(--primary))" />
                  <Line type="monotone" dataKey="Material" stroke="hsl(var(--chart-2, 25 95% 53%))" />
                  <Line type="monotone" dataKey="Aufwendungen" stroke="hsl(var(--chart-3, 262 83% 58%))" />
                  <Line type="monotone" dataKey="Gesamt" stroke="hsl(var(--foreground))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="person-journal" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Personenjournal</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Projekt</TableHead>
                    <TableHead>Person</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead className="text-right">Stunden</TableHead>
                    <TableHead>Notiz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(personJournal.data ?? []).map((row: any) => (
                    <TableRow key={row.entry_id}>
                      <TableCell>{row.entry_date}</TableCell>
                      <TableCell><span className="font-mono">{row.project_number}</span> {row.project_name}</TableCell>
                      <TableCell>{[row.first_name, row.last_name].filter(Boolean).join(" ") || row.short_code || "—"}</TableCell>
                      <TableCell className="text-xs">{row.entry_type}</TableCell>
                      <TableCell className="text-right">{fmtHours(row.hours)}</TableCell>
                      <TableCell className="max-w-md truncate" title={row.note ?? ""}>{row.note ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {(!personJournal.data || personJournal.data.length === 0) && (
                    <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">Keine Einträge.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost-journal" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Kostenjournal</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead>Projekt</TableHead>
                    <TableHead>Beschreibung</TableHead>
                    <TableHead className="text-right">Betrag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(costJournal.data ?? []).map((row: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell>{row.item_date}</TableCell>
                      <TableCell>{CAT_LABEL[row.category] ?? row.category}</TableCell>
                      <TableCell><span className="font-mono">{row.project_number}</span> {row.project_name}</TableCell>
                      <TableCell className="max-w-md truncate" title={row.description ?? ""}>{row.description || "—"}</TableCell>
                      <TableCell className="text-right">{fmtEuro(row.amount)}</TableCell>
                    </TableRow>
                  ))}
                  {(!costJournal.data || costJournal.data.length === 0) && (
                    <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Keine Einträge.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
