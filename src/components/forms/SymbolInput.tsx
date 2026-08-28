import { useRef, useState, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { applyFormat, hasRichMarkup, normalizeUnicodeToMarkup } from "@/lib/richText";
import RichText from "@/components/forms/RichText";

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

/**
 * Formatierungsaktionen x₂ / x² für die markierte Auswahl.
 * Nutzt die zentrale Auszeichnungslogik aus `@/lib/richText` — es gibt keine
 * zweite Textformatierungslogik im System.
 */
function ScriptButtons({
  targetRef, value, onChange, disabled,
}: {
  targetRef: React.RefObject<Target>;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const run = (variant: "toggle-sub" | "toggle-sup") => {
    const el = targetRef.current;
    const start = el?.selectionStart ?? 0;
    const end = el?.selectionEnd ?? 0;
    if (start === end) return;
    const r = applyFormat(value, start, end, variant);
    onChange(r.value);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(r.selectionStart, r.selectionEnd);
    });
  };
  return (
    <>
      <Button
        type="button" variant="outline" size="icon" disabled={disabled}
        title="Tiefgestellt (Auswahl markieren)" aria-label="Tiefgestellt"
        className="h-9 w-9 shrink-0 font-normal"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => run("toggle-sub")}
      >
        <span>x<sub className="text-[0.7em]">2</sub></span>
      </Button>
      <Button
        type="button" variant="outline" size="icon" disabled={disabled}
        title="Hochgestellt (Auswahl markieren)" aria-label="Hochgestellt"
        className="h-9 w-9 shrink-0 font-normal"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => run("toggle-sup")}
      >
        <span>x<sup className="text-[0.7em]">2</sup></span>
      </Button>
    </>
  );
}

/** Live-Vorschau der Formatierung unterhalb des Eingabefelds. */
function FormatPreview({ value }: { value: string }) {
  if (!hasRichMarkup(value)) return null;
  return (
    <p className="text-[11px] text-muted-foreground mt-1">
      Darstellung: <RichText value={value} className="text-foreground" />
    </p>
  );
}

/** Eingefügten Text mit Unicode-Sub/Superscript in Auszeichnung überführen. */
function handlePaste(
  e: React.ClipboardEvent<Target>,
  value: string,
  onChange: (v: string) => void
) {
  const text = e.clipboardData.getData("text");
  const converted = normalizeUnicodeToMarkup(text);
  if (converted === text) return; // nichts zu tun – Standardverhalten
  e.preventDefault();
  const el = e.currentTarget;
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const next = value.slice(0, start) + converted + value.slice(end);
  onChange(next);
  const caret = start + converted.length;
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(caret, caret);
  });
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
    <div>
      <div className="flex items-center gap-1">
        <Input
          id={id}
          ref={ref}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          className={className}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(e) => handlePaste(e, value, onChange)}
        />
        <ScriptButtons targetRef={ref} value={value} onChange={onChange} disabled={disabled} />
        <SymbolPickerButton onPick={pick} disabled={disabled} />
      </div>
      <FormatPreview value={value} />
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
    <div>
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
          onPaste={(e) => handlePaste(e, value, onChange)}
        />
        <div className="flex flex-col gap-1">
          <ScriptButtons targetRef={ref} value={value} onChange={onChange} disabled={disabled} />
          <SymbolPickerButton onPick={pick} disabled={disabled} />
        </div>
      </div>
      <FormatPreview value={value} />
    </div>
  );
}
