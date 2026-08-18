import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AxisScale } from "@/lib/resultsChartData";

export interface ManualScale {
  min: string;
  max: string;
  step: string;
}

interface Props {
  title: string;
  auto: boolean;
  onAutoChange: (v: boolean) => void;
  manual: ManualScale;
  onManualChange: (v: ManualScale) => void;
  autoScale: AxisScale | null;
  disabled?: boolean;
  disabledHint?: string;
}

/**
 * Achsen-Skalierung: automatisch (runde Schrittweiten) oder manuell
 * mit Minimum, Maximum und Schrittweite.
 */
export function AxisScaleControls({
  title,
  auto,
  onAutoChange,
  manual,
  onManualChange,
  autoScale,
  disabled,
  disabledHint,
}: Props) {
  const fmt = (n: number | undefined) =>
    n == null || !Number.isFinite(n) ? "–" : String(Number(n.toPrecision(6)));

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">{title}</p>
        {!disabled && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Automatisch</Label>
            <Switch checked={auto} onCheckedChange={onAutoChange} />
          </div>
        )}
      </div>

      {disabled ? (
        <p className="text-xs text-muted-foreground">{disabledHint ?? "Nicht verfügbar"}</p>
      ) : auto ? (
        <p className="text-xs text-muted-foreground">
          Min {fmt(autoScale?.min)} · Max {fmt(autoScale?.max)} · Schritt {fmt(autoScale?.step)}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {(["min", "max", "step"] as const).map((k) => (
            <div key={k}>
              <Label className="text-[11px] text-muted-foreground">
                {k === "min" ? "Min" : k === "max" ? "Max" : "Schritt"}
              </Label>
              <Input
                className="h-8"
                inputMode="decimal"
                value={manual[k]}
                placeholder={fmt(autoScale?.[k])}
                onChange={(e) => onManualChange({ ...manual, [k]: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
