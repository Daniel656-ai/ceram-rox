import { HorizontalScrollArea } from "@/components/ui/HorizontalScrollArea";
import SampleLabel from "@/components/results/SampleLabel";

const nf = new Intl.NumberFormat("de-AT", { maximumFractionDigits: 6 });

export interface BetRow {
  key: string;
  sample: { number: string | null | undefined; name: string | null | undefined };
  value: number | string | null;
  official: boolean;
  /** Bezeichnung eines Durchlaufs, falls eine Probe mehrere BET-Werte hat. */
  runLabel?: string | null;
  onClick?: () => void;
}

/** BET: je Probe eine Zeile „Probe | BET [m²/g]“. Vorläufig grau, offiziell normal. */
export default function BetResultsTable({ rows }: { rows: BetRow[] }) {
  return (
    <HorizontalScrollArea className="rounded-md border">
      <table className="w-full text-sm" data-testid="bet-results">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-2 text-left font-medium">Probe</th>
            <th className="whitespace-nowrap p-2 text-right font-medium">BET [m²/g]</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              className={`border-t ${r.onClick ? "cursor-pointer hover:bg-muted/40" : ""}`}
              onClick={r.onClick}
            >
              <td className="p-2">
                <SampleLabel number={r.sample.number} name={r.sample.name} />
                {r.runLabel ? <span className="ml-2 text-xs text-muted-foreground">· {r.runLabel}</span> : null}
              </td>
              <td className={`whitespace-nowrap p-2 text-right font-mono ${r.official ? "" : "text-muted-foreground"}`}>
                {r.value === null ? "–" : typeof r.value === "number" ? nf.format(r.value) : r.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </HorizontalScrollArea>
  );
}
