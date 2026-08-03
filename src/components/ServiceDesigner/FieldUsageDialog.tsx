import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { GlobalField } from "@/lib/api/globalModel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, FormInput, Calculator, GitBranch, LayoutDashboard } from "lucide-react";

/**
 * Phase 4: Zeigt an, wo ein globales Feld überall verwendet wird
 * (Formulare, Workflows, Berichte, Berechnungen, Dashboards).
 */
export default function FieldUsageDialog({
  field,
  open,
  onOpenChange,
}: {
  field: GlobalField | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: usage, isLoading } = useQuery({
    queryKey: ["global-field-usage", field?.id],
    queryFn: () => api.globalFields.usage(field!.id),
    enabled: !!field?.id && open,
  });

  const sections = [
    { key: "forms", label: "Formulare", icon: FormInput, items: usage?.forms ?? [] },
    { key: "workflows", label: "Workflows", icon: GitBranch, items: usage?.workflows ?? [] },
    { key: "reports", label: "Berichte / Vorlagen", icon: FileText, items: usage?.reports ?? [] },
    { key: "calculations", label: "Berechnungen", icon: Calculator, items: usage?.calculations ?? [] },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Feldverwendung · {field?.display_name}
          </DialogTitle>
        </DialogHeader>

        {usage?.binding_path && (
          <p className="font-mono text-xs text-muted-foreground">{usage.binding_path}</p>
        )}
        {isLoading && <p className="text-sm text-muted-foreground">Analysiere Verwendung…</p>}

        <div className="space-y-4">
          {sections.map((s) => (
            <div key={s.key}>
              <div className="flex items-center gap-2 text-sm font-medium">
                <s.icon className="h-4 w-4" /> {s.label}
                <Badge variant="outline">{s.items.length}</Badge>
              </div>
              {s.items.length === 0 ? (
                <p className="pl-6 text-xs text-muted-foreground">Keine Verwendung.</p>
              ) : (
                <ul className="pl-6 pt-1 space-y-0.5">
                  {s.items.map((i) => (
                    <li key={i.id} className="text-xs">• {i.name}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <LayoutDashboard className="h-4 w-4" /> Dashboards
              <Badge variant="outline">0</Badge>
            </div>
            <p className="pl-6 text-xs text-muted-foreground">
              Dashboard-Widgets nutzen dieses Feld derzeit nicht.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
