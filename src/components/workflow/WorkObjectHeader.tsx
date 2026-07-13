import { OriginBadge } from "./OriginBadge";
import { Badge } from "@/components/ui/badge";

interface Props {
  referenceNumber?: string | null;
  origin?: string | null;
  status?: string | null;
  workflowStatus?: string | null;
  project?: { project_number: string; project_name: string } | null;
  customerName?: string | null;
  progress?: { done: number; total: number };
}

export function WorkObjectHeader({
  referenceNumber, origin, status, workflowStatus, project, customerName, progress,
}: Props) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <OriginBadge originKey={origin} />
            {workflowStatus && <Badge variant="secondary">{workflowStatus}</Badge>}
            {status && <Badge variant="outline">{status}</Badge>}
          </div>
          <h1 className="text-5xl font-bold tracking-tight font-mono">
            {referenceNumber ?? "—"}
          </h1>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            {project && (
              <span>
                <span className="font-medium text-foreground">Projekt:</span>{" "}
                {project.project_number} · {project.project_name}
              </span>
            )}
            {customerName && (
              <span>
                <span className="font-medium text-foreground">Kunde:</span> {customerName}
              </span>
            )}
          </div>
        </div>
        {progress && (
          <div className="text-right">
            <div className="text-3xl font-semibold">
              {progress.done}<span className="text-muted-foreground">/{progress.total}</span>
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Fortschritt
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
