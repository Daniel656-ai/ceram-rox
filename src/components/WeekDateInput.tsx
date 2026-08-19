import { Input } from "@/components/ui/input";
import { getISOWeek, isoWeekToDate, isoWeeksInYear, formatWeek } from "@/lib/isoWeek";
import { cn } from "@/lib/utils";

interface Props {
  value: string; // "YYYY-MM-DD" | ""
  onChange: (value: string) => void;
  /** Wochentag, auf den eine KW-Eingabe abgebildet wird (1 = Montag, 5 = Freitag). */
  weekday?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  className?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Datumseingabe mit zusätzlicher KW-Planung.
 * Das Datum bleibt die führende Datenquelle; die KW wird daraus abgeleitet
 * bzw. eine KW-Eingabe wird in ein konkretes Datum umgerechnet.
 */
export function WeekDateInput({ value, onChange, weekday = 1, className, disabled, id }: Props) {
  const iso = value ? getISOWeek(value) : null;

  const applyWeek = (weekRaw: string) => {
    const week = parseInt(weekRaw, 10);
    if (!week || week < 1) return;
    const year = iso?.year ?? new Date().getFullYear();
    const max = isoWeeksInYear(year);
    onChange(isoWeekToDate(year, Math.min(week, max), weekday));
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Input
        id={id}
        type="date"
        className="h-9 w-40"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">KW</span>
        <Input
          type="number"
          min={1}
          max={53}
          className="h-9 w-16"
          disabled={disabled}
          value={iso?.week ?? ""}
          placeholder="–"
          onChange={(e) => applyWeek(e.target.value)}
        />
      </div>
      {value && <span className="text-xs text-muted-foreground whitespace-nowrap">{formatWeek(value, true)}</span>}
    </div>
  );
}
