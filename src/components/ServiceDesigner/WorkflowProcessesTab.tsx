import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowUp, ArrowDown, Trash2, Workflow, Save, Beaker, Factory } from "lucide-react";
import { toast } from "sonner";

interface Props {
  workflowTemplateId: string;
  canManage: boolean;
}

/**
 * Ordnet einem Workflow eine geordnete Liste von Prozessvorlagen zu (`workflow_process_links`).
 */
export default function WorkflowProcessesTab({ workflowTemplateId, canManage }: Props) {
  const qc = useQueryClient();

  const { data: allProcesses = [] } = useQuery({
    queryKey: ["process-templates"],
    queryFn: () => api.processTemplates.list(),
  });

  const { data: links = [] } = useQuery({
    queryKey: ["workflow-process-links", workflowTemplateId],
    queryFn: () => api.workflowProcessLinks.listForWorkflow(workflowTemplateId),
  });

  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  useEffect(() => {
    setOrderedIds(links.map((l) => l.process_template_id));
  }, [links, workflowTemplateId]);

  const [search, setSearch] = useState("");
  const linkedProcesses = useMemo(
    () => orderedIds.map((id) => allProcesses.find((p) => p.id === id)).filter((p): p is any => !!p),
    [orderedIds, allProcesses]
  );

  const availableProcesses = useMemo(
    () =>
      allProcesses.filter(
        (p) =>
          !orderedIds.includes(p.id) &&
          (!search || p.name.toLowerCase().includes(search.toLowerCase()))
      ),
    [allProcesses, orderedIds, search]
  );

  const dirty =
    orderedIds.length !== links.length ||
    orderedIds.some((id, i) => links[i]?.process_template_id !== id);

  const save = useMutation({
    mutationFn: () => api.workflowProcessLinks.setForWorkflow(workflowTemplateId, orderedIds),
    onSuccess: () => {
      toast.success("Workflow gespeichert");
      qc.invalidateQueries({ queryKey: ["workflow-process-links", workflowTemplateId] });
    },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const move = (idx: number, dir: -1 | 1) => {
    const t = idx + dir;
    if (t < 0 || t >= orderedIds.length) return;
    const next = [...orderedIds];
    [next[idx], next[t]] = [next[t], next[idx]];
    setOrderedIds(next);
  };

  const kindBadge = (kind: string) =>
    kind === "labor" ? (
      <Badge variant="secondary" className="text-[10px]"><Beaker className="h-3 w-3 mr-1" />Labor</Badge>
    ) : (
      <Badge variant="secondary" className="text-[10px]"><Factory className="h-3 w-3 mr-1" />Pilot</Badge>
    );

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Verfügbare Prozesse</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2 h-8"
          />
          <ScrollArea className="h-96 border rounded-md p-2">
            {availableProcesses.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">Keine weiteren Prozesse verfügbar.</p>
            )}
            {availableProcesses.map((p) => (
              <div key={p.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted">
                <span className="text-sm flex-1 truncate">{p.name}</span>
                {kindBadge(p.kind)}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!canManage}
                  onClick={() => setOrderedIds((prev) => [...prev, p.id])}
                >
                  Hinzufügen
                </Button>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Workflow className="h-4 w-4" /> Prozessfolge
            <Badge variant="secondary">{orderedIds.length}</Badge>
          </CardTitle>
          <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || !canManage || save.isPending}>
            <Save className="h-3 w-3 mr-1" /> Speichern
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[416px] border rounded-md p-2">
            {linkedProcesses.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">
                Noch keine Prozesse. Workflows sind eine Abfolge vorhandener Prozessvorlagen.
              </p>
            )}
            {linkedProcesses.map((p, i) => (
              <div key={p.id} className="flex items-center gap-1 py-1 px-2 rounded hover:bg-muted">
                <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                <span className="text-sm flex-1 truncate">{p.name}</span>
                {kindBadge(p.kind)}
                <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  disabled={i === linkedProcesses.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => setOrderedIds((prev) => prev.filter((id) => id !== p.id))}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
