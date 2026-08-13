import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FormInput, Check, X } from "lucide-react";
import { ROLE_VIEW_PRESETS } from "@/lib/api/formRoleViews";
import { toast } from "sonner";

interface Props {
  service: { id: string; service_name: string } | null;
  onClose: () => void;
}

/**
 * Verknüpft GENAU EIN Globales Formular mit einer Dienstleistung.
 *
 * Die Rollentrennung (Auftraggeber / Messdienstleister / Ergebnis) erfolgt
 * ausschließlich über die Rollenansichten des Globalen Formulars – hier werden
 * keine rollenspezifischen Einzelformulare mehr zugeordnet.
 */
export default function ServiceFormLinksDialog({ service, onClose }: Props) {
  const qc = useQueryClient();
  const open = !!service;

  const { data: allForms = [] } = useQuery({
    queryKey: ["form-definitions"],
    queryFn: () => api.formDefinitions.list(),
    enabled: open,
  });

  const { data: links = [] } = useQuery({
    queryKey: ["service-form-links", service?.id],
    queryFn: () => api.serviceFormLinks.listForService(service!.id),
    enabled: open,
  });

  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    setSelected(links[0]?.form_definition_id ?? null);
  }, [links, service?.id]);

  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () => allForms.filter((f) => !search || f.name.toLowerCase().includes(search.toLowerCase())),
    [allForms, search]
  );

  const dirty = (links[0]?.form_definition_id ?? null) !== selected;

  const save = useMutation({
    mutationFn: () => api.serviceFormLinks.setGlobalForm(service!.id, selected),
    onSuccess: () => {
      toast.success("Globales Formular zugeordnet");
      qc.invalidateQueries({ queryKey: ["service-form-links", service!.id] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FormInput className="h-4 w-4" /> Globales Formular · {service?.service_name}
          </DialogTitle>
          <DialogDescription>
            Eine Dienstleistung verknüpft genau ein Globales Formular. Welche Ansicht
            (Auftraggeber, Messdienstleister, Ergebnis) angezeigt wird, ergibt sich aus den
            Rollenansichten dieses Formulars.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Input
            placeholder="Formular suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
          <ScrollArea className="h-80 border rounded-md p-2">
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">Keine Formulare gefunden.</p>
            )}
            {filtered.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelected(selected === f.id ? null : f.id)}
                className={`w-full flex items-center gap-2 py-1.5 px-2 rounded text-left ${
                  selected === f.id ? "bg-primary/10" : "hover:bg-muted"
                }`}
              >
                {selected === f.id ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <span className="h-4 w-4" />
                )}
                <span className="text-sm flex-1 truncate">{f.name}</span>
                <Badge variant="outline" className="text-[10px]">v{f.version}</Badge>
              </button>
            ))}
          </ScrollArea>

          {selected && <FormViewsSummary formId={selected} />}
        </div>

        <DialogFooter className="gap-2">
          {selected && (
            <Button variant="ghost" onClick={() => setSelected(null)} className="mr-auto">
              <X className="h-3.5 w-3.5 mr-1" /> Verknüpfung entfernen
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Zeigt an, welche Rollenansichten das gewählte Globale Formular besitzt. */
function FormViewsSummary({ formId }: { formId: string }) {
  const { data: views = [] } = useQuery({
    queryKey: ["form-role-views", formId],
    queryFn: () => api.formRoleViews.list(formId),
  });

  return (
    <div className="rounded-md border bg-muted/30 p-2 space-y-1">
      <p className="text-xs font-medium">Vorhandene Ansichten</p>
      <div className="flex flex-wrap gap-1">
        {ROLE_VIEW_PRESETS.map((p) => {
          const exists = views.some((v) => v.role_key === p.key);
          return (
            <Badge key={p.key} variant={exists ? "default" : "outline"} className="text-[10px]">
              {p.label}
              {exists ? "" : " – fehlt"}
            </Badge>
          );
        })}
        {views
          .filter((v) => !ROLE_VIEW_PRESETS.some((p) => p.key === v.role_key))
          .map((v) => (
            <Badge key={v.id} variant="secondary" className="text-[10px]">{v.label}</Badge>
          ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Ansichten werden im Formulardesigner unter „Rollenansichten“ gepflegt.
      </p>
    </div>
  );
}
