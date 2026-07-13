import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  name: string;
  step_key: string;
  order_index: number;
  task?: { status: string; assigned_to?: string | null } | null;
}

export function WorkflowProgress({
  steps,
  onStepClick,
}: {
  steps: Step[];
  onStepClick?: (stepId: string) => void;
}) {
  if (!steps.length) {
    return <p className="text-sm text-muted-foreground">Kein Workflow zugewiesen.</p>;
  }
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {steps.map((s, idx) => {
        const status = s.task?.status ?? "pending";
        const isDone = status === "completed";
        const isActive = status === "in_progress";
        return (
          <li key={s.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onStepClick?.(s.id)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
                isDone && "bg-emerald-100 border-emerald-300 text-emerald-900",
                isActive && "bg-blue-100 border-blue-300 text-blue-900 font-medium",
                !isDone && !isActive && "bg-muted text-muted-foreground",
                onStepClick && "hover:opacity-80 cursor-pointer"
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background/60 text-xs font-semibold">
                {isDone ? <Check className="h-3 w-3" /> : isActive ? <Loader2 className="h-3 w-3 animate-spin" /> : <Circle className="h-3 w-3" />}
              </span>
              <span>{s.name}</span>
            </button>
            {idx < steps.length - 1 && <span className="text-muted-foreground">→</span>}
          </li>
        );
      })}
    </ol>
  );
}
