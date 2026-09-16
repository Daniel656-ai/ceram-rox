import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { GitBranch } from "lucide-react";
import {
  COMPARISON_OPERATORS, COMPARISON_OPERATOR_INFO, type ComparisonOperator,
} from "@/lib/formulaEngine";

/** Eine auswählbare Größe (Feld, Berechnung, Konstante …). */
export interface ConditionOption {
  /** Technischer Schlüssel, wie er in der Formel steht. */
  value: string;
  label: string;
  /** Optionale Gruppierung in der Auswahlliste. */
  group?: string;
}

interface Props {
  options: ConditionOption[];
  /** Fügt den erzeugten Text an die Formel an. */
  onInsert: (text: string) => void;
}

const CONST = "__const__";

/**
 * Baukasten für Vergleichsbedingungen: [Wert/Feld] [Operator] [Vergleichswert].
 * Erzeugt reinen Formeltext – es entsteht keine zweite Formelsyntax.
 */
export default function ConditionInsertPopover({ options, onInsert }: Props) {
  const [open, setOpen] = useState(false);
  const [leftKind, setLeftKind] = useState<string>("");
  const [leftConst, setLeftConst] = useState<string>("");
  const [op, setOp] = useState<ComparisonOperator>("<=");
  const [rightKind, setRightKind] = useState<string>(CONST);
  const [rightConst, setRightConst] = useState<string>("1");

  const groups = Array.from(new Set(options.map((o) => o.group ?? "Größen")));

  const side = (kind: string, constValue: string) =>
    kind === CONST ? (constValue.trim().replace(",", ".") || "0") : kind;

  const condition = `${side(leftKind, leftConst)} ${op} ${side(rightKind, rightConst)}`;
  const valid = Boolean(leftKind);

  const insert = (asIf: boolean) => {
    onInsert(asIf ? `IF(${condition}, ` : condition);
    setOpen(false);
  };

  const OperandSelect = ({
    value, onChange,
  }: { value: string; onChange: (v: string) => void }) => (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Größe wählen" /></SelectTrigger>
      <SelectContent>
        {groups.map((g) => (
          <SelectGroup key={g}>
            <SelectLabel>{g}</SelectLabel>
            {options.filter((o) => (o.group ?? "Größen") === g).map((o) => (
              <SelectItem key={`${g}-${o.value}`} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectGroup>
        ))}
        <SelectGroup>
          <SelectLabel>Sonstiges</SelectLabel>
          <SelectItem value={CONST}>Fester Wert …</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <GitBranch className="h-3 w-3 mr-1" />Bedingung
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 space-y-3" align="start">
        <p className="text-xs text-muted-foreground">
          Bedingung zusammenstellen: <span className="font-mono">[Größe] [Vergleich] [Wert]</span>
        </p>

        <div className="space-y-1">
          <Label className="text-xs">Linke Seite</Label>
          <OperandSelect value={leftKind} onChange={setLeftKind} />
          {leftKind === CONST && (
            <Input className="h-9" value={leftConst} placeholder="z. B. 1"
              onChange={(e) => setLeftConst(e.target.value)} />
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Vergleich</Label>
          <Select value={op} onValueChange={(v) => setOp(v as ComparisonOperator)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COMPARISON_OPERATORS.filter((o) => o !== "==").map((o) => (
                <SelectItem key={o} value={o}>
                  <span className="font-mono mr-2">{o}</span>{COMPARISON_OPERATOR_INFO[o]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Rechte Seite</Label>
          <OperandSelect value={rightKind} onChange={setRightKind} />
          {rightKind === CONST && (
            <Input className="h-9" value={rightConst} placeholder="z. B. 1"
              onChange={(e) => setRightConst(e.target.value)} />
          )}
        </div>

        <p className="rounded bg-muted px-2 py-1 font-mono text-[11px]">
          {valid ? condition : "Bitte linke Seite wählen"}
        </p>

        <div className="flex gap-2">
          <Button size="sm" disabled={!valid} onClick={() => insert(true)}>
            Als IF(…) einfügen
          </Button>
          <Button size="sm" variant="outline" disabled={!valid} onClick={() => insert(false)}>
            Nur Bedingung
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          „Als IF(…)“ fügt <span className="font-mono">IF(Bedingung, </span> ein – danach
          Dann-Wert, Komma, Sonst-Wert und schließende Klammer ergänzen.
        </p>
      </PopoverContent>
    </Popover>
  );
}
