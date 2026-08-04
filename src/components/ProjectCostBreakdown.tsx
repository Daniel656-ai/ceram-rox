import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowUpDown, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import type { CostBreakdown, TaskCost } from "@/lib/costBreakdown";

type Props = {
  breakdown: CostBreakdown;
  expectedTotal: number;
  userName: (id: string) => string;
};

type SortKey = "task" | "service" | "person" | "hours" | "rate" | "personnel" | "material" | "total";

function budgetTone(pct: number) {
  if (pct > 100) return "text-destructive";
  if (pct >= 80) return "text-orange-500";
  return "text-emerald-600";
}

export function ProjectCostBreakdown({ breakdown, expectedTotal, userName }: Props) {
  const { totals, tasks, byPerson, byService } = breakdown;
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "total", dir: "desc" });
  const [drill, setDrill] = useState<TaskCost | null>(null);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filtered = tasks.filter((t) =>
      !q ||
      t.measurementNumber.toLowerCase().includes(q) ||
      t.serviceName.toLowerCase().includes(q) ||
      (t.personId ? userName(t.personId).toLowerCase().includes(q) : false)
    );
    const val = (t: TaskCost) => {
      switch (sort.key) {
        case "task": return t.measurementNumber;
        case "service": return t.serviceName;
        case "person": return t.personId ? userName(t.personId) : "";
        case "hours": return t.hours;
        case "rate": return t.rate;
        case "personnel": return t.personnel;
        case "material": return t.material;
        default: return t.total;
      }
    };
    return [...filtered].sort((a, b) => {
      const av = val(a), bv = val(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "de");
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [tasks, filter, sort, userName]);

  const delta = Math.abs(totals.sum - expectedTotal);
  const inconsistent = delta > 0.01;

  const SortHead = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggle(k)}>
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sort.key === k ? "text-primary" : "opacity-40"}`} />
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      {/* Kostenübersicht */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Kostenübersicht</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Personal</p>
            <p className="text-xl font-bold">{formatCurrency(totals.personnel)} €</p>
            <p className="text-xs text-muted-foreground">
              {totals.personnelHours.toFixed(1)} h · Ø {formatCurrency(totals.personnelAvgRate)} €/h
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Material</p>
            <p className="text-xl font-bold">{formatCurrency(totals.material)} €</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Fremdleistungen</p>
            <p className="text-xl font-bold">{formatCurrency(totals.subcontract)} €</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sonstige Kosten</p>
            <p className="text-xl font-bold">{formatCurrency(totals.other)} €</p>
          </div>
          <div className="border-l pl-4">
            <p className="text-xs text-muted-foreground">Gesamtsumme</p>
            <p className="text-xl font-bold">{formatCurrency(totals.sum)} €</p>
          </div>
        </CardContent>
      </Card>

      {inconsistent && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            Kosteninkonsistenz erkannt. Bitte Zuordnung der Arbeitszeiten oder Kostenpositionen prüfen.
            <span className="block text-xs opacity-80">
              Differenz: {formatCurrency(delta)} € (Positionen {formatCurrency(totals.sum)} € vs. Projektkosten {formatCurrency(expectedTotal)} €)
            </span>
          </div>
        </div>
      )}

      {breakdown.issues.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Fehlende Zuordnungen ({breakdown.issues.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            {breakdown.issues.slice(0, 20).map((i, idx) => <p key={idx}>• {i}</p>)}
          </CardContent>
        </Card>
      )}

      {/* Kosten pro Aufgabe */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Kosten pro Aufgabe</CardTitle>
          <Input
            className="h-8 w-56"
            placeholder="Filtern (Aufgabe, Dienstleistung, Person)"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead k="task">Aufgabe</SortHead>
                <SortHead k="service">Dienstleistung</SortHead>
                <SortHead k="person">Mitarbeiter</SortHead>
                <SortHead k="hours" className="text-right">Stunden</SortHead>
                <SortHead k="rate" className="text-right">Satz</SortHead>
                <SortHead k="personnel" className="text-right">Personal</SortHead>
                <SortHead k="material" className="text-right">Material</SortHead>
                <SortHead k="total" className="text-right">Gesamt</SortHead>
                <TableHead className="text-right">Budget / Verbrauch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Keine Aufgaben vorhanden</TableCell></TableRow>
              ) : rows.map((t) => {
                const pct = t.budget && t.budget > 0 ? (t.total / t.budget) * 100 : null;
                return (
                  <TableRow key={t.key} className="cursor-pointer" onClick={() => setDrill(t)}>
                    <TableCell className="font-medium">{t.measurementNumber}</TableCell>
                    <TableCell>{t.serviceName}</TableCell>
                    <TableCell>{t.personId ? userName(t.personId) : "–"}</TableCell>
                    <TableCell className="text-right">{t.hours.toFixed(1)} h</TableCell>
                    <TableCell className="text-right">{t.rate > 0 ? `${formatCurrency(t.rate)} €` : "–"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(t.personnel)} €</TableCell>
                    <TableCell className="text-right">{formatCurrency(t.material + t.other)} €</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(t.total)} €</TableCell>
                    <TableCell className="text-right text-xs">
                      {t.budget != null ? (
                        <span className={budgetTone(pct!)}>
                          {formatCurrency(t.budget)} € · Rest {formatCurrency(t.budget - t.total)} € · {pct!.toFixed(0)} %
                        </span>
                      ) : "–"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Kosten pro Mitarbeiter */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Kosten pro Mitarbeiter</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mitarbeiter</TableHead>
                  <TableHead className="text-right">Stunden</TableHead>
                  <TableHead className="text-right">Ø Satz</TableHead>
                  <TableHead className="text-right">Personalkosten</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byPerson.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Keine Stunden erfasst</TableCell></TableRow>
                ) : byPerson.map((g) => (
                  <TableRow key={g.key}>
                    <TableCell>{userName(g.key)}</TableCell>
                    <TableCell className="text-right">{g.hours.toFixed(1)} h</TableCell>
                    <TableCell className="text-right">{formatCurrency(g.avgRate)} €</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(g.total)} €</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Kosten pro Dienstleistung */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Kosten pro Dienstleistung</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dienstleistung</TableHead>
                  <TableHead className="text-right">Stunden</TableHead>
                  <TableHead className="text-right">Ø Satz</TableHead>
                  <TableHead className="text-right">Gesamtkosten</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byService.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Keine Stunden erfasst</TableCell></TableRow>
                ) : byService.map((g) => (
                  <TableRow key={g.key}>
                    <TableCell>{g.label}</TableCell>
                    <TableCell className="text-right">{g.hours.toFixed(1)} h</TableCell>
                    <TableCell className="text-right">{formatCurrency(g.avgRate)} €</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(g.total)} €</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Nicht zugeordnete Kostenpositionen */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Kostenpositionen ohne Aufgabenbezug</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Typ</TableHead>
                <TableHead>Bezeichnung</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdown.positions.filter((p) => !p.taskKey).length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Alle Positionen sind zugeordnet</TableCell></TableRow>
              ) : breakdown.positions.filter((p) => !p.taskKey).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Badge variant="outline">
                      {p.kind === "material" ? "Material" : p.kind === "subcontract" ? "Fremdleistung" : p.kind === "other" ? "Sonstige" : "Personal"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.note || "–"}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(p.amount)} €</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Drill-Down */}
      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Aufgabe {drill?.measurementNumber}</DialogTitle></DialogHeader>
          {drill && (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">{drill.serviceName}</p>
              {drill.positions.length === 0 && <p className="text-muted-foreground">Keine Einzelpositionen erfasst.</p>}
              {drill.positions.map((p) => (
                <div key={p.id} className="flex justify-between border-b pb-1">
                  <span>
                    {p.kind === "personnel"
                      ? `${p.personId ? userName(p.personId) : "Unzugeordnet"} · ${p.hours.toFixed(1)} h × ${formatCurrency(p.rate)} €`
                      : p.note || "Position"}
                  </span>
                  <span className="font-medium">{formatCurrency(p.amount)} €</span>
                </div>
              ))}
              <div className="flex justify-between pt-1 font-bold">
                <span>Gesamt</span><span>{formatCurrency(drill.total)} €</span>
              </div>
              {drill.budget != null && (
                <div className="flex justify-between text-xs">
                  <span>Budget (Plan)</span>
                  <span className={budgetTone((drill.total / drill.budget) * 100)}>
                    {formatCurrency(drill.budget)} € · {((drill.total / drill.budget) * 100).toFixed(0)} %
                  </span>
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setDrill(null)}>Schließen</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
