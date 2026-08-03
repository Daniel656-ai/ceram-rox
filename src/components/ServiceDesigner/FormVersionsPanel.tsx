import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FormDefinition } from "@/lib/api/formDefinitions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, Upload } from "lucide-react";
import { toast } from "sonner";

/**
 * Phase 4: Versionierung eines Formulars. Beim Veröffentlichen wird ein
 * vollständiger Snapshot abgelegt, den Aufträge referenzieren können.
 */
export default function FormVersionsPanel({
  form,
  canManage,
}: {
  form: FormDefinition;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["form-versions", form.id],
    queryFn: () => api.formVersions.list(form.id),
  });

  const publish = useMutation({
    mutationFn: () => api.formVersions.publish(form.id, note || undefined),
    onSuccess: (v) => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["form-versions", form.id] });
      qc.invalidateQueries({ queryKey: ["form-definitions"] });
      qc.invalidateQueries({ queryKey: ["forms"] });
      toast.success(`Version v${v.version} veröffentlicht`);
    },
    onError: (e: any) => toast.error(e.message || "Fehler beim Veröffentlichen"),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4" /> Versionen · aktuell v{form.version}
          </h3>
          <p className="text-xs text-muted-foreground">
            Jede Version speichert Felder, Layout, Rollenansichten, Rechte und Regeln.
            Aufträge merken sich die verwendete Version.
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Input
              className="h-8 w-56 text-xs"
              placeholder="Notiz zur Version (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button size="sm" onClick={() => publish.mutate()} disabled={publish.isPending}>
              <Upload className="h-4 w-4 mr-1" /> Version veröffentlichen
            </Button>
          </div>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Version</TableHead>
            <TableHead>Notiz</TableHead>
            <TableHead className="w-40">Erstellt</TableHead>
            <TableHead className="w-32">Umfang</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow><TableCell colSpan={4} className="text-xs text-muted-foreground">Lade…</TableCell></TableRow>
          )}
          {!isLoading && versions.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                Noch keine veröffentlichten Versionen.
              </TableCell>
            </TableRow>
          )}
          {versions.map((v) => {
            const snap = (v.snapshot ?? {}) as Record<string, any>;
            return (
              <TableRow key={v.id}>
                <TableCell><Badge variant="outline">v{v.version}</Badge></TableCell>
                <TableCell className="text-xs">{v.note || "—"}</TableCell>
                <TableCell className="text-xs">
                  {new Date(v.created_at).toLocaleString("de-AT")}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {(snap.fields?.length ?? 0)} Felder · {(snap.rules?.length ?? 0)} Regeln
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
