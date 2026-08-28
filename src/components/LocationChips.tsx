import { Badge } from "@/components/ui/badge";

interface LocationChipsProps {
  locations: string[];
}

export function LocationChips({ locations }: LocationChipsProps) {
  if (!locations.length) return <span>–</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {locations.map((loc) => (
        <Badge
          key={loc}
          variant="outline"
          className="text-xs font-normal max-w-[220px] truncate"
          title={loc}
        >
          {loc}
        </Badge>
      ))}
    </div>
  );
}
