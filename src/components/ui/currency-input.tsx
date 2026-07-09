import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  /** Numeric value as string (raw, e.g. "1250000" or "1250000.5") or number. Empty string = no value. */
  value: number | string | null | undefined;
  /** Called with the raw numeric string (no separators, dot as decimal). */
  onChange: (raw: string) => void;
}

/**
 * Currency input that displays with de-DE thousand separators while keeping
 * a raw numeric string in state. Reuses the same de-DE formatting used by
 * `formatCurrency` so all money surfaces stay visually consistent.
 */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, className, ...rest }, ref) => {
    const raw = value == null || value === "" ? "" : String(value);
    const [focused, setFocused] = React.useState(false);

    const formatted = React.useMemo(() => {
      if (raw === "") return "";
      // Split integer / decimal on dot (raw storage uses dot).
      const [intPart, decPart] = raw.replace(/[^\d.-]/g, "").split(".");
      if (intPart === undefined) return "";
      const sign = intPart.startsWith("-") ? "-" : "";
      const digits = intPart.replace("-", "");
      const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      return decPart !== undefined ? `${sign}${grouped},${decPart}` : `${sign}${grouped}`;
    }, [raw]);

    // While focused let the user type freely; on blur we re-normalise.
    const [draft, setDraft] = React.useState<string>(formatted);
    React.useEffect(() => {
      if (!focused) setDraft(formatted);
    }, [formatted, focused]);

    const parseToRaw = (input: string): string => {
      if (input.trim() === "") return "";
      // Remove thousand separators (dots), convert decimal comma to dot, drop other chars.
      const cleaned = input.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
      if (cleaned === "" || cleaned === "-" || cleaned === ".") return cleaned;
      return cleaned;
    };

    return (
      <Input
        {...rest}
        ref={ref}
        type="text"
        inputMode="decimal"
        className={cn(className)}
        value={draft}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          onChange(parseToRaw(next));
        }}
        onBlur={(e) => {
          setFocused(false);
          const rawVal = parseToRaw(draft);
          onChange(rawVal);
          rest.onBlur?.(e);
        }}
      />
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";
