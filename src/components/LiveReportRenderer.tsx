import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Link2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { FormLayoutData, FormFieldRef } from "@/lib/api/serviceFormLayouts";
import { loadReportContext, resolveBinding, type ReportDataContext } from "@/lib/reportBindings";
import HandwritingField, { type HandwritingValue } from "@/components/HandwritingField";
import { dbClient } from "@/lib/api/client";

interface Props {
  orderId: string;
  serviceId: string | null;
  canEdit: boolean;
}

type OverrideMap = Record<string, any>;

const widthCls = (w: FormFieldRef["width"]) => {
  const map: Record<number, string> = {
    12: "col-span-12", 9: "col-span-12 md:col-span-9", 8: "col-span-12 md:col-span-8",
    6: "col-span-12 md:col-span-6", 4: "col-span-12 md:col-span-4", 3: "col-span-12 md:col-span-3",
  };
  return map[w] ?? "col-span-12";
};

export default function LiveReportRenderer({ orderId, serviceId, canEdit }: Props) {
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Layout laden (role_view = report)
  const layoutQuery = useQuery({
    queryKey: ["report-layout", serviceId],
    queryFn: () => serviceId ? api.serviceFormLayouts.get(serviceId, "report") : Promise.resolve(null),
    enabled: !!serviceId,
  });

  // Daten-Kontext (Auftrag, Projekt, Probe, Messungen …)
  const ctxQuery = useQuery({
    queryKey: ["report-context", orderId],
    queryFn: () => loadReportContext(orderId),
    enabled: !!orderId,
  });

  // Field-Katalog (für Feldtypen)
  const fieldsQuery = useQuery({
    queryKey: ["service-data-fields", serviceId],
    queryFn: () => serviceId ? api.serviceDataFields.listForService(serviceId) : Promise.resolve([]),
    enabled: !!serviceId,
  });

  // Aktuelle Overrides + Report-Header
  const reportQuery = useQuery({
    queryKey: ["order-report", orderId],
    queryFn: () => api.orderReports.getOrCreateForOrder(orderId),
    enabled: !!orderId,
  });

  useEffect(() => {
    if (reportQuery.data && !dirty) {
      const remote = ((reportQuery.data as any).draft_overrides ?? {}) as OverrideMap;
      setOverrides(remote);
    }
  }, [reportQuery.data, dirty]);

  const fieldsById = useMemo(() => {
    const m = new Map<string, any>();
    for (const f of fieldsQuery.data ?? []) m.set(f.id, f);
    return m;
  }, [fieldsQuery.data]);

  const setOverride = useCallback((refId: string, value: any) => {
    setOverrides((cur) => ({ ...cur, [refId]: value }));
    setDirty(true);
  }, []);

  const save = async () => {
    if (!reportQuery.data) return;
    setSaving(true);
    try {
      const { error } = await (dbClient as any)
        .from("order_reports")
        .update({ draft_overrides: overrides, updated_at: new Date().toISOString() })
        .eq("id", (reportQuery.data as any).id);
      if (error) throw error;
      setDirty(false);
      toast.success("Entwurf gespeichert");
    } catch (e: any) {
      toast.error("Speichern fehlgeschlagen", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const layout = layoutQuery.data?.layout as FormLayoutData | undefined;

  if (!serviceId) {
    return (
      <Card><CardContent className="p-6 text-sm text-muted-foreground">
        Kein Service verknüpft — Ergebnisbericht nicht verfügbar.
      </CardContent></Card>
    );
  }
  if (layoutQuery.isLoading || ctxQuery.isLoading || fieldsQuery.isLoading) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Lade Berichtsdaten …</CardContent></Card>;
  }
  if (!layout || layout.sections.length === 0) {
    return (
      <Card><CardContent className="p-6 text-sm text-muted-foreground">
        Für diese Dienstleistung wurde noch kein Berichts-Layout im Service Designer angelegt.
      </CardContent></Card>
    );
  }
  if (!ctxQuery.data) {
    return <Card><CardContent className="p-6 text-sm text-destructive">Kontext konnte nicht geladen werden.</CardContent></Card>;
  }

  const ctx = ctxQuery.data;

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex items-center justify-between gap-3 sticky top-0 z-10 bg-background/95 backdrop-blur border rounded-md px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Automatisch übernommene Werte sind schreibgeschützt. Freie Felder und als „bearbeitbar" markierte Bindings können hier direkt ausgefüllt werden.
          </p>
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Entwurf speichern
          </Button>
        </div>
      )}

      {layout.sections.map((section) => (
        <Card key={section.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{section.title}</CardTitle>
            {section.description && (
              <p className="text-xs text-muted-foreground">{section.description}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-12 gap-3">
              {section.fields.filter((f) => !f.hidden).map((ref) => {
                const field = fieldsById.get(ref.field_id);
                if (!field) {
                  return (
                    <div key={ref.id} className={`${widthCls(ref.width)} text-xs text-destructive`}>
                      Feld nicht gefunden
                    </div>
                  );
                }
                const label = ref.label_override?.trim() || field.display_name;
                const resolved = ref.binding ? resolveBinding(ref.binding, ctx) : null;
                const isEditable = canEdit && (!ref.binding || ref.binding.source === "free" || ref.binding.editable);
                const overrideVal = overrides[ref.id];
                const displayVal = overrideVal !== undefined ? overrideVal : resolved?.display ?? "";

                return (
                  <div key={ref.id} className={widthCls(ref.width)}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">{label}{field.unit ? ` (${field.unit})` : ""}</Label>
                        {ref.binding && (
                          <Badge variant="outline" className="text-[9px] gap-0.5 h-4">
                            <Link2 className="h-2.5 w-2.5" />
                            {ref.binding.source}{ref.binding.path ? `.${ref.binding.path}` : ""}
                          </Badge>
                        )}
                      </div>
                      {renderControl({
                        field, ref, resolved, displayVal, isEditable,
                        onChange: (v) => setOverride(ref.id, v),
                      })}
                      {resolved?.missingReason && (
                        <p className="text-[10px] text-muted-foreground">{resolved.missingReason}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function renderControl({
  field, ref, resolved, displayVal, isEditable, onChange,
}: {
  field: any;
  ref: FormFieldRef;
  resolved: ReturnType<typeof resolveBinding> | null;
  displayVal: any;
  isEditable: boolean;
  onChange: (v: any) => void;
}) {
  const type = field.field_type as string;

  // Tabellen-Bindings (z.B. "*" für alle Ergebnisse)
  if (resolved?.table) {
    return (
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {resolved.table.columns.map((c) => <TableHead key={c} className="text-xs h-8">{c}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {resolved.table.rows.length === 0 ? (
              <TableRow><TableCell colSpan={resolved.table.columns.length} className="text-xs text-muted-foreground text-center">Keine Daten</TableCell></TableRow>
            ) : resolved.table.rows.map((row, i) => (
              <TableRow key={i}>
                {row.map((cell, j) => <TableCell key={j} className="text-xs">{String(cell ?? "")}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (type === "handwriting") {
    return (
      <HandwritingField
        value={(displayVal as HandwritingValue) ?? undefined}
        onChange={(v) => onChange(v)}
        readOnly={!isEditable}
      />
    );
  }

  if (type === "longtext") {
    return (
      <Textarea
        value={String(displayVal ?? "")}
        readOnly={!isEditable}
        onChange={(e) => isEditable && onChange(e.target.value)}
        rows={3}
        className={!isEditable ? "bg-muted/30" : ""}
      />
    );
  }

  return (
    <Input
      value={String(displayVal ?? "")}
      readOnly={!isEditable}
      onChange={(e) => isEditable && onChange(e.target.value)}
      className={!isEditable ? "bg-muted/30 font-mono text-xs" : ""}
    />
  );
}
