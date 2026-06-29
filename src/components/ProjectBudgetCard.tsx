import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, DollarSign } from "lucide-react";
import { useState, useEffect } from "react";

interface Props {
  budgetTotal: number | null | undefined;
  budgetWarningThreshold: number | null | undefined;
  currency?: string | null;
  actualCosts: number;
  projectStartDate?: string | null;
  canEdit: boolean;
  onSave: (updates: { budget_total?: number | null; budget_warning_threshold?: number | null }) => void;
}

export function ProjectBudgetCard({ budgetTotal, budgetWarningThreshold, currency, actualCosts, projectStartDate, canEdit, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [budget, setBudget] = useState<string>(budgetTotal != null ? String(budgetTotal) : "");
  const [threshold, setThreshold] = useState<string>(budgetWarningThreshold != null ? String(budgetWarningThreshold) : "80");

  useEffect(() => {
    setBudget(budgetTotal != null ? String(budgetTotal) : "");
    setThreshold(budgetWarningThreshold != null ? String(budgetWarningThreshold) : "80");
  }, [budgetTotal, budgetWarningThreshold]);

  const curr = currency || "EUR";
  const total = budgetTotal != null ? Number(budgetTotal) : null;
  const pct = total && total > 0 ? Math.min(100, (actualCosts / total) * 100) : 0;
  const remaining = total != null ? total - actualCosts : null;
  const warn = budgetWarningThreshold ?? 80;
  const overWarn = total && pct >= warn;
  const overBudget = total && actualCosts > total;

  // Burn rate – cost per week since project start
  let burnRate: number | null = null;
  if (projectStartDate) {
    const start = new Date(projectStartDate).getTime();
    const weeks = Math.max(1, (Date.now() - start) / (1000 * 60 * 60 * 24 * 7));
    burnRate = actualCosts / weeks;
  }

  const save = () => {
    onSave({
      budget_total: budget ? Number(budget) : null,
      budget_warning_threshold: threshold ? Number(threshold) : null,
    });
    setEditing(false);
  };

  if (total == null && !editing) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <span className="text-sm">Kein Budget hinterlegt</span>
          </div>
          {canEdit && <button className="text-sm text-primary hover:underline" onClick={() => setEditing(true)}>Budget setzen</button>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Budget</div>
            <div className="text-lg font-semibold">{total != null ? total.toFixed(2) : "–"} {curr}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Ist-Kosten</div>
            <div className="text-lg font-semibold">{actualCosts.toFixed(2)} {curr}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Restbudget</div>
            <div className={`text-lg font-semibold ${remaining != null && remaining < 0 ? "text-destructive" : ""}`}>
              {remaining != null ? remaining.toFixed(2) : "–"} {curr}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Burn-Rate (€/Woche)</div>
            <div className="text-lg font-semibold">{burnRate != null ? burnRate.toFixed(2) : "–"}</div>
          </div>
        </div>
        {total != null && (
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>{pct.toFixed(1)} % verbraucht</span>
              {overBudget ? (
                <span className="text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Budget überschritten</span>
              ) : overWarn ? (
                <span className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Schwellwert {warn}% erreicht</span>
              ) : null}
            </div>
            <Progress value={pct} className={overBudget ? "[&>div]:bg-destructive" : overWarn ? "[&>div]:bg-yellow-500" : ""} />
          </div>
        )}

        {canEdit && editing && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <div><Label className="text-xs">Gesamtbudget ({curr})</Label><Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
            <div><Label className="text-xs">Warnschwelle (%)</Label><Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button className="text-sm px-3 py-1 rounded border" onClick={() => setEditing(false)}>Abbrechen</button>
              <button className="text-sm px-3 py-1 rounded bg-primary text-primary-foreground" onClick={save}>Speichern</button>
            </div>
          </div>
        )}
        {canEdit && !editing && (
          <div className="flex justify-end">
            <button className="text-xs text-primary hover:underline" onClick={() => setEditing(true)}>Budget bearbeiten</button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
