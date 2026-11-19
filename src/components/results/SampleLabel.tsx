/**
 * Einheitliche Darstellung einer Probe in der Ergebnisdatenbank:
 * Probenbezeichnung als Hauptbezeichnung (hervorgehoben), Probennummer klein und grau daneben.
 * Hat die Probe keine Bezeichnung, steht die Nummer als Hauptbezeichnung.
 */
export default function SampleLabel({
  number,
  name,
  stacked = false,
  className = "",
}: {
  number: string | null | undefined;
  name: string | null | undefined;
  /** Nummer unter der Bezeichnung statt daneben. */
  stacked?: boolean;
  className?: string;
}) {
  const n = (number ?? "").trim();
  const nm = (name ?? "").trim();
  if (!nm) return <span className={`font-mono ${className}`}>{n || "–"}</span>;
  return (
    <span className={`${stacked ? "block" : ""} ${className}`}>
      <span className="font-medium">{nm}</span>
      {n && (
        <span className={`${stacked ? "block" : "ml-2"} font-mono text-[11px] leading-tight text-muted-foreground`}>{n}</span>
      )}
    </span>
  );
}
