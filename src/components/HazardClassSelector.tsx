import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle } from "lucide-react";
import { GhsPictogram } from "@/components/GhsPictogram";
import {
  HAZARD_CLASSES,
  type HazardClassKey,
  normalizeHazardClasses,
} from "@/lib/hazardClasses";
import { cn } from "@/lib/utils";

interface HazardClassSelectorProps {
  value: readonly string[];
  onChange: (next: HazardClassKey[]) => void;
  /** Optional Überschrift, falls null wird keine angezeigt */
  label?: string | null;
  className?: string;
  idPrefix?: string;
}

/**
 * Multi-Select für die 9 GHS-Gefahrstoffklassen.
 * Zeigt Piktogramm + Bezeichnung als auswählbare Karten.
 * Akzeptiert Legacy-Keys über `normalizeHazardClasses`.
 */
export function HazardClassSelector({
  value,
  onChange,
  label,
  className,
  idPrefix = "haz",
}: HazardClassSelectorProps) {
  const { t } = useTranslation(["hazard", "common"]);
  const selected = normalizeHazardClasses(value);

  const toggle = (key: HazardClassKey) => {
    onChange(
      selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key],
    );
  };

  return (
    <div className={cn("space-y-2 rounded-md border p-3", className)}>
      {label !== null && (
        <Label className="font-semibold flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          {label ?? t("hazard:selector_title")}
        </Label>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {HAZARD_CLASSES.map((cls) => {
          const id = `${idPrefix}-${cls.key}`;
          const isOn = selected.includes(cls.key);
          return (
            <label
              key={cls.key}
              htmlFor={id}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2 py-1.5 cursor-pointer transition-colors",
                isOn
                  ? "border-destructive/60 bg-destructive/5"
                  : "border-input hover:bg-muted/50",
              )}
            >
              <Checkbox id={id} checked={isOn} onCheckedChange={() => toggle(cls.key)} />
              <GhsPictogram hazardKey={cls.key} size="sm" showTooltip={false} />
              <span className="text-sm leading-tight">
                <span className="font-medium">{t(`hazard:class_${cls.key}`)}</span>
                <span className="text-muted-foreground text-[10px] ml-1">{cls.ghsCode}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
