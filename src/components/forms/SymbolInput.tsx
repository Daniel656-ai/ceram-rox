import { useRef, useState, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Wissenschaftliche Sonderzeichen für Formularbezeichnungen.
 * Alle Zeichen werden als reine Unicode-Zeichen eingefügt (keine Codes/Bilder).
 */
export const GREEK_LOWER = "αβγδεζηθικλμνξοπρστυφχψω".split("");
export const GREEK_UPPER = "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ".split("");
export const SCIENTIFIC = [
  "±", "°", "×", "÷", "≈", "≠", "≤", "≥", "→", "∅", "∑", "√", "∞",
  "µ", "·", "‰", "²", "³", "⁻", "⁺", "⁰", "¹", "⁴", "⁵", "⁶", "₀", "₁", "₂", "₃", "₊", "₋",
];

type Target = HTMLInputElement | HTMLTextAreaElement;

interface PickerProps {
  onPick: (symbol: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Eigenständiger Ω-Button; das Popover bleibt für Mehrfachauswahl offen. */
export function SymbolPickerButton({ onPick, disabled, className }: PickerProps) {
  const [open, setOpen] = useState(false);
  const group = (label: string, chars: string[]) => (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1">
        {chars.map((c) => (
          <button
            key={label + c}
            type="button"
            className="h-7 w-7 rounded border text-sm hover:bg-accent"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(c)}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          title="Symbole einfügen"
          aria-label="Symbole einfügen"
          className={cn("h-9 w-9 shrink-0", className)}
        >
          Ω
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3" onOpenAutoFocus={(e) => e.preventDefault()}>
        {group("Griechisch klein", GREEK_LOWER)}
        {group("Griechisch groß", GREEK_UPPER)}
        {group("Wissenschaftlich", SCIENTIFIC)}
        <p className="text-[10px] text-muted-foreground">
          Klick fügt das Zeichen an der Cursorposition ein. Mehrfachauswahl möglich.
        </p>
      </PopoverContent>
    </Popover>
  );
}

function insertAtCursor(el: Target | null, value: string, symbol: string) {
  const start = el?.selectionStart ?? value.length;
  const end = el?.selectionEnd ?? value.length;
  const next = value.slice(0, start) + symbol + value.slice(end);
  return { next, caret: start + symbol.length };
}

interface FieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  rows?: number;
  id?: string;
}

/** Einzeiliges Textfeld mit Symbolauswahl. */
export const SymbolInput = forwardRef<HTMLInputElement, FieldProps>(function SymbolInput(
  { value, onChange, disabled, placeholder, className, id },
  _ref
) {
  const ref = useRef<HTMLInputElement>(null);
  const pick = (symbol: string) => {
    const el = ref.current;
    const { next, caret } = insertAtCursor(el, value, symbol);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };
  return (
    <div className="flex items-center gap-1">
      <Input
        id={id}
        ref={ref}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        onChange={(e) => onChange(e.target.value)}
      />
      <SymbolPickerButton onPick={pick} disabled={disabled} />
    </div>
  );
});

/** Mehrzeiliges Textfeld mit Symbolauswahl. */
export function SymbolTextarea({ value, onChange, disabled, placeholder, className, rows = 2, id }: FieldProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const pick = (symbol: string) => {
    const el = ref.current;
    const { next, caret } = insertAtCursor(el, value, symbol);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };
  return (
    <div className="flex items-start gap-1">
      <Textarea
        id={id}
        ref={ref}
        value={value}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        onChange={(e) => onChange(e.target.value)}
      />
      <SymbolPickerButton onPick={pick} disabled={disabled} />
    </div>
  );
}
