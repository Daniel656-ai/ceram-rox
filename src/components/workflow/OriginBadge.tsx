import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const COLORS: Record<string, string> = {
  pilot_plant: "bg-blue-100 text-blue-800 border-blue-200",
  production: "bg-amber-100 text-amber-800 border-amber-200",
  qc: "bg-emerald-100 text-emerald-800 border-emerald-200",
  lab: "bg-violet-100 text-violet-800 border-violet-200",
  complaint: "bg-red-100 text-red-800 border-red-200",
  development: "bg-cyan-100 text-cyan-800 border-cyan-200",
  customer: "bg-orange-100 text-orange-800 border-orange-200",
};

export function OriginBadge({ originKey }: { originKey?: string | null }) {
  const { data: origins = [] } = useQuery({
    queryKey: ["work-object-origins"],
    queryFn: () => api.workObjectOrigins.list(),
    staleTime: 5 * 60 * 1000,
  });
  if (!originKey) return null;
  const o = origins.find((x: any) => x.key === originKey);
  const label = o?.label_de ?? originKey;
  const cls = COLORS[originKey] ?? "bg-muted text-foreground";
  return <Badge variant="outline" className={cls}>{label}</Badge>;
}
