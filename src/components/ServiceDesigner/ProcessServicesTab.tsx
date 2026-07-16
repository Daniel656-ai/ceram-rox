import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowUp, ArrowDown, Trash2, Wrench, Save } from "lucide-react";
import { toast } from "sonner";

interface Props {
  processTemplateId: string;
  canManage: boolean;
}

/**
 * Ordnet einer Prozessvorlage Dienstleistungen aus der Dienstleistungsbibliothek zu.
 * Speichert Reihenfolge in `process_service_links.order_index`.
 */
export default function ProcessServicesTab({ processTemplateId, canManage }: Props) {
  const qc = useQueryClient();

  const { data: allServices = [] } = useQuery({
    queryKey: ["measurement-services-active"],
    queryFn: () => api.measurementServices.listActive(),
  });

  const { data: links = [] } = useQuery({
    queryKey: ["process-service-links", processTemplateId],
    queryFn: () => api.processServiceLinks.listForProcess(processTemplateId),
  });

  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  useEffect(() => {
    setOrderedIds(links.map((l) => l.service_id));
  }, [links, processTemplateId]);

  const [search, setSearch] = useState("");
  const linkedServices = useMemo(
    () =>
      orderedIds
        .map((id) => allServices.find((s: any) => s.id === id))
        .filter((s: any): s is any => !!s),
    [orderedIds, allServices]
  );

  const availableServices = useMemo(
    () =>
      allServices.filter(
        (s: any) =>
          !orderedIds.includes(s.id) &&
          (!search || (s.service_name ?? "").toLowerCase().includes(search.toLowerCase()))
      ),
    [allServices, orderedIds, search]
  );

  const dirty =
    orderedIds.length !== links.length ||
    orderedIds.some((id, i) => links[i]?.service_id !== id);

  const save = useMutation({
    mutationFn: () => api.processServiceLinks.setForProcess(processTemplateId, orderedIds),
    onSuccess: () => {
      toast.success("Dienstleistungen gespeichert");
      qc.invalidateQueries({ queryKey: ["process-service-links", processTemplateId] });
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

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Verfügbare Dienstleistungen</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2 h-8"
          />
          <ScrollArea className="h-96 border rounded-md p-2">
            {availableServices.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">Keine weiteren Dienstleistungen verfügbar.</p>
            )}
            {availableServices.map((s: any) => (
              <div key={s.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted">
                <span className="text-sm flex-1 truncate">{s.service_name}</span>
                {s.category && <Badge variant="outline" className="text-[10px]">{s.category}</Badge>}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!canManage}
                  onClick={() => setOrderedIds((prev) => [...prev, s.id])}
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
            <Wrench className="h-4 w-4" /> Zugeordnete Dienstleistungen
            <Badge variant="secondary">{orderedIds.length}</Badge>
          </CardTitle>
          <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || !canManage || save.isPending}>
            <Save className="h-3 w-3 mr-1" /> Speichern
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[416px] border rounded-md p-2">
            {linkedServices.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">
                Noch keine Dienstleistungen ausgewählt. Prozesse bestehen aus einer geordneten Liste von Dienstleistungen.
              </p>
            )}
            {linkedServices.map((s: any, i: number) => (
              <div key={s.id} className="flex items-center gap-1 py-1 px-2 rounded hover:bg-muted">
                <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                <span className="text-sm flex-1 truncate">{s.service_name}</span>
                {s.category && <Badge variant="outline" className="text-[10px]">{s.category}</Badge>}
                <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  disabled={i === linkedServices.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => setOrderedIds((prev) => prev.filter((id) => id !== s.id))}
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
