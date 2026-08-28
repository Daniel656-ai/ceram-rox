import { parseRichText } from "@/lib/richText";

/**
 * Einheitliche Anzeige von Texten mit Hoch-/Tiefstellung.
 *
 * Unformatierter Text wird unverändert ausgegeben — die Komponente ist damit
 * überall gefahrlos einsetzbar (Bezeichnungen, Einheiten, Beschreibungen,
 * Überschriften, Ergebnisbezeichnungen, Berichtstexte).
 */
export default function RichText({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  const segments = parseRichText(value);
  if (segments.length === 0) return null;
  return (
    <span className={className}>
      {segments.map((s, i) =>
        s.variant === "sub" ? (
          <sub key={i} className="text-[0.72em]">{s.text}</sub>
        ) : s.variant === "sup" ? (
          <sup key={i} className="text-[0.72em]">{s.text}</sup>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </span>
  );
}
