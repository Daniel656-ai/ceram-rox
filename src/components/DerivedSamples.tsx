import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

interface Props {
  rawMaterialId: string;
  rawMaterialBatchId?: string | null;
}

/**
 * Forward traceability: shows every sample that was derived from a raw material
 * (optionally narrowed to a single raw-material batch).
 */
export function DerivedSamples({ rawMaterialId, rawMaterialBatchId }: Props) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["raw_material_derived_samples", rawMaterialId, rawMaterialBatchId ?? null],
    queryFn: () =>
      api.mixtureTraceability.derivedSamples(rawMaterialId, rawMaterialBatchId ?? null),
    enabled: !!rawMaterialId,
  });

  if (isLoading) {
    return <div className="p-4 text-muted-foreground text-sm">…</div>;
  }

  const rows = data as any[];

  if (rows.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground text-sm">
        Aus diesem Rohstoff wurden noch keine Proben hergestellt.
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Probe</TableHead>
            <TableHead>Bezeichnung</TableHead>
            <TableHead>Mischung</TableHead>
            <TableHead>Herstellungscharge</TableHead>
            <TableHead>Rohstoffcharge</TableHead>
            <TableHead>Menge</TableHead>
            <TableHead>Erstellt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.sample_id}>
              <TableCell className="font-mono">
                <Link
                  to={`/proben/${r.sample_id}`}
                  className="hover:underline text-primary"
                >
                  {r.sample_number}
                </Link>
              </TableCell>
              <TableCell>{r.sample_name}</TableCell>
              <TableCell>
                <Link
                  to={`/mischungen/${r.mixture_id}`}
                  className="hover:underline"
                >
                  {r.mixture_name}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {r.mixture_batch_number}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {r.raw_material_batch_number || "—"}
              </TableCell>
              <TableCell>
                {Number(r.consumed_quantity)} {r.consumed_unit}
              </TableCell>
              <TableCell>
                {format(new Date(r.sample_created_at), "dd.MM.yyyy")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
