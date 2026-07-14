import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  PilotPlantBlock,
  PilotPlantBlockKey,
  PILOT_PLANT_BLOCK_LABELS,
  PilotPlantProducedSample,
} from "@/lib/api/pilotPlantProcess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { CheckCircle2, Play, Save, Lock, Plus, Trash2, Circle, Clock } from "lucide-react";
import { format } from "date-fns";

// -------------------------------------------------------------------
// Field definitions per block (hard-wired per spec)
// -------------------------------------------------------------------
type FieldDef = { key: string; label: string; type: "text" | "number" | "textarea" | "date" };

const BLOCK_FIELDS: Record<PilotPlantBlockKey, FieldDef[]> = {
  stammdaten: [], // shown read-only (created via order creation)
  rezeptur: [
    { key: "recipe_version", label: "Rezepturversion / Bezeichnung", type: "text" },
    { key: "rohstoff_hinweise", label: "Rohstoffhinweise", type: "textarea" },
  ],
  knetung: [
    { key: "knetzeit_min", label: "Knetzeit (min)", type: "number" },
    { key: "wasserzugabe_l", label: "Wasserzugabe (l)", type: "number" },
    { key: "drehzahl_rpm", label: "Drehzahl (rpm)", type: "number" },
    { key: "bediener", label: "Bediener", type: "text" },
    { key: "bemerkung", label: "Bemerkung", type: "textarea" },
  ],
  extrusion: [
    { key: "mundstueck", label: "Mundstück", type: "text" },
    { key: "extruder", label: "Extruder", type: "text" },
    { key: "druck_bar", label: "Druck (bar)", type: "number" },
    { key: "drehzahl_rpm", label: "Drehzahl (rpm)", type: "number" },
    { key: "bemerkung", label: "Bemerkung", type: "textarea" },
  ],
  trocknung: [
    { key: "temperatur_c", label: "Temperatur (°C)", type: "number" },
    { key: "dauer_h", label: "Dauer (h)", type: "number" },
    { key: "bediener", label: "Bediener", type: "text" },
    { key: "bemerkung", label: "Bemerkung", type: "textarea" },
  ],
  brennen: [
    { key: "brennkurve", label: "Brennkurve", type: "text" },
    { key: "ofen", label: "Ofen", type: "text" },
    { key: "temperatur_c", label: "Temperatur (°C)", type: "number" },
    { key: "haltezeit_min", label: "Haltezeit (min)", type: "number" },
    { key: "bemerkung", label: "Bemerkung", type: "textarea" },
  ],
  probenentnahme: [
    { key: "gesamt_anzahl", label: "Gesamtanzahl Proben", type: "number" },
    { key: "bemerkung", label: "Bemerkung", type: "textarea" },
  ],
  uebergabe: [
    { key: "bestaetigung", label: "Bestätigung / Übergabehinweise", type: "textarea" },
  ],
  abschluss: [
    { key: "bewertung", label: "Qualitative Bewertung", type: "textarea" },
    { key: "freigabe_hinweise", label: "Freigabehinweise", type: "text" },
  ],
};

const STATUS_BADGE: Record<string, { label: string; className: string; icon: any }> = {
  pending: { label: "Ausstehend", className: "bg-muted text-muted-foreground", icon: Circle },
  in_progress: { label: "In Bearbeitung", className: "bg-blue-500/15 text-blue-700 border-blue-500/30", icon: Clock },
  completed: { label: "Abgeschlossen", className: "bg-green-500/15 text-green-700 border-green-500/30", icon: CheckCircle2 },
  skipped: { label: "Übersprungen", className: "bg-muted text-muted-foreground", icon: Circle },
};

export function PilotPlantProcessPanel({ order }: { order: any }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const orderId = order?.id as string;

  const blocksQ = useQuery({
    queryKey: ["pp_blocks", orderId],
    queryFn: () => api.pilotPlantBlocks.listForOrder(orderId),
    enabled: !!orderId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["pp_blocks", orderId] });
    qc.invalidateQueries({ queryKey: ["pp_produced", orderId] });
    qc.invalidateQueries({ queryKey: ["order", orderId] });
  };

  const seedMut = useMutation({
    mutationFn: () => api.pilotPlantBlocks.seed(orderId),
    onSuccess: () => { toast.success("Prozessbausteine erzeugt"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const isLocked = order?.workflow_status === "abgeschlossen" || !!order?.locked_at;
  const blocks = blocksQ.data ?? [];

  if (!blocksQ.isLoading && blocks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Für diesen Auftrag wurden noch keine Pilot-Plant-Bausteine angelegt.
          </p>
          <Button onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
            Prozessbausteine erzeugen
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {isLocked && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm flex items-center gap-2">
          <Lock className="h-4 w-4 text-amber-600" /> Auftrag ist abgeschlossen und gegen Änderungen gesperrt.
        </div>
      )}
      <Accordion type="single" collapsible defaultValue={findCurrentBlock(blocks)?.id}>
        {blocks.map((b) => (
          <BlockAccordion
            key={b.id}
            block={b}
            allBlocks={blocks}
            order={order}
            userId={user?.id ?? null}
            locked={isLocked}
            onChanged={invalidate}
          />
        ))}
      </Accordion>
    </div>
  );
}

function findCurrentBlock(blocks: PilotPlantBlock[]): PilotPlantBlock | undefined {
  return blocks.find((b) => b.status === "in_progress") ?? blocks.find((b) => b.status === "pending");
}

// -------------------------------------------------------------------
// Single block accordion item
// -------------------------------------------------------------------
function BlockAccordion({
  block, allBlocks, order, userId, locked, onChanged,
}: {
  block: PilotPlantBlock;
  allBlocks: PilotPlantBlock[];
  order: any;
  userId: string | null;
  locked: boolean;
  onChanged: () => void;
}) {
  const [values, setValues] = useState<Record<string, any>>(() => ({ ...block.data }));
  const [notes, setNotes] = useState<string>(block.notes ?? "");

  const canEdit =
    !locked &&
    block.status !== "completed" &&
    (block.assigned_to === userId ||
      block.assigned_to === null ||
      order?.created_by === userId);

  const fields = BLOCK_FIELDS[block.block_key];
  const badge = STATUS_BADGE[block.status] ?? STATUS_BADGE.pending;
  const Icon = badge.icon;

  const saveDraft = useMutation({
    mutationFn: () => api.pilotPlantBlocks.saveDraft(block.id, values, notes),
    onSuccess: () => { toast.success("Entwurf gespeichert"); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  const startMut = useMutation({
    mutationFn: () => api.pilotPlantBlocks.start(block.id),
    onSuccess: () => { toast.success("Baustein gestartet"); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  const completeMut = useMutation({
    mutationFn: () => api.pilotPlantBlocks.complete(block.id, values, notes),
    onSuccess: () => { toast.success(`${PILOT_PLANT_BLOCK_LABELS[block.block_key]} abgeschlossen`); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateField = (k: string, v: any) => setValues((prev) => ({ ...prev, [k]: v }));

  // Aggregated briefing from previous blocks (read from their data)
  const briefing = useMemo(() => {
    return allBlocks
      .filter((b) => b.order_index < block.order_index && b.status === "completed")
      .map((b) => ({ key: b.block_key, label: PILOT_PLANT_BLOCK_LABELS[b.block_key], data: b.data }));
  }, [allBlocks, block.order_index]);

  return (
    <AccordionItem value={block.id}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-muted-foreground font-mono text-xs w-6">{block.order_index}.</span>
          <span className="font-medium">{PILOT_PLANT_BLOCK_LABELS[block.block_key]}</span>
          <Badge variant="outline" className={`ml-auto mr-2 ${badge.className}`}>
            <Icon className="h-3 w-3 mr-1" /> {badge.label}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-4">
        {briefing.length > 0 && (
          <BriefingCard briefing={briefing} orderData={order?.shared_form_data} />
        )}

        {block.block_key === "stammdaten" && (
          <StammdatenView order={order} />
        )}

        {fields.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Bausteindaten</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key} className={f.type === "textarea" ? "md:col-span-2" : ""}>
                  <Label className="text-xs">{f.label}</Label>
                  {f.type === "textarea" ? (
                    <Textarea
                      rows={2}
                      value={values[f.key] ?? ""}
                      onChange={(e) => updateField(f.key, e.target.value)}
                      disabled={!canEdit}
                    />
                  ) : (
                    <Input
                      type={f.type === "number" ? "number" : f.type}
                      value={values[f.key] ?? ""}
                      onChange={(e) => updateField(f.key, f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
                      disabled={!canEdit}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {block.block_key === "probenentnahme" && (
          <ProducedSamplesEditor orderId={order.id} blockId={block.id} canEdit={canEdit} />
        )}

        {block.block_key === "uebergabe" && (
          <UebergabeSummary orderId={order.id} />
        )}

        <div>
          <Label className="text-xs">Interne Notiz</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} />
        </div>

        <div className="flex flex-wrap gap-2">
          {block.status === "pending" && canEdit && (
            <Button size="sm" onClick={() => startMut.mutate()} disabled={startMut.isPending}>
              <Play className="h-4 w-4 mr-1" /> Bearbeitung starten
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => saveDraft.mutate()} disabled={saveDraft.isPending}>
              <Save className="h-4 w-4 mr-1" /> Entwurf speichern
            </Button>
          )}
          {block.status !== "completed" && canEdit && (
            <Button size="sm" variant="default" onClick={() => completeMut.mutate()} disabled={completeMut.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Baustein abschließen
            </Button>
          )}
          {block.completed_at && (
            <span className="text-xs text-muted-foreground self-center">
              Abgeschlossen {format(new Date(block.completed_at), "dd.MM.yyyy HH:mm")}
            </span>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// -------------------------------------------------------------------
// Briefing / read-only aggregation
// -------------------------------------------------------------------
function BriefingCard({ briefing, orderData }: { briefing: Array<{ key: string; label: string; data: any }>; orderData: any }) {
  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-2"><CardTitle className="text-sm">Informationen aus vorherigen Bausteinen</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {briefing.map((b) => (
          <div key={b.key}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{b.label}</p>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm mt-1">
              {Object.entries(b.data || {}).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="text-muted-foreground min-w-[120px]">{k}:</dt>
                  <dd className="font-medium">{v === null || v === "" ? "–" : String(v)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------------
// Stammdaten read-only from order + shared_form_data
// -------------------------------------------------------------------
function StammdatenView({ order }: { order: any }) {
  const st = order?.shared_form_data?.pp?.stammdaten ?? {};
  return (
    <Card className="bg-muted/20">
      <CardHeader className="pb-2"><CardTitle className="text-sm">Stammdaten</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
        <Field label="Versuchsnummer" value={st.versuchsnummer ?? order?.pp_experiment_number} />
        <Field label="Versuchsart" value={st.versuchsart ?? order?.pp_experiment_kind} />
        <Field label="Datum" value={st.experiment_date ?? order?.pp_experiment_date} />
        <Field label="Frühere Versuche" value={st.previous_experiments ?? order?.pp_previous_experiments} />
        <Field
          label="Gewünschte Proben"
          value={Array.isArray(st.requested_samples) ? st.requested_samples.join(", ") : st.requested_samples}
        />
        <Field
          label="Anzahl Labor-Dienstleistungen"
          value={Array.isArray(st.requested_lab_service_ids) ? st.requested_lab_service_ids.length : 0}
        />
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground min-w-[160px]">{label}:</span>
      <span className="font-medium">{value === null || value === undefined || value === "" ? "–" : String(value)}</span>
    </div>
  );
}

// -------------------------------------------------------------------
// Produced samples repeater
// -------------------------------------------------------------------
function ProducedSamplesEditor({
  orderId, blockId, canEdit,
}: { orderId: string; blockId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const listQ = useQuery({
    queryKey: ["pp_produced", orderId],
    queryFn: () => api.pilotPlantProducedSamples.listForOrder(orderId),
    enabled: !!orderId,
  });

  const [draft, setDraft] = useState({ label: "", quantity: 1, marking: "", notes: "" });

  const addMut = useMutation({
    mutationFn: () =>
      api.pilotPlantProducedSamples.create({
        order_id: orderId, block_id: blockId,
        label: draft.label, quantity: draft.quantity,
        marking: draft.marking || null, notes: draft.notes || null,
      }),
    onSuccess: () => {
      setDraft({ label: "", quantity: 1, marking: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["pp_produced", orderId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => api.pilotPlantProducedSamples.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pp_produced", orderId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const rows = listQ.data ?? [];

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Erzeugte Proben</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Proben erfasst.</p>
        ) : (
          <div className="space-y-1">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-2 p-2 border rounded-md text-sm">
                <span className="font-medium flex-1">{r.label}</span>
                <Badge variant="outline">{r.quantity}×</Badge>
                {r.marking && <span className="text-muted-foreground">Kz: {r.marking}</span>}
                {r.created_sample_id && (
                  <Badge className="bg-green-500/15 text-green-700 border-green-500/30" variant="outline">
                    → Sample erzeugt
                  </Badge>
                )}
                {canEdit && !r.created_sample_id && (
                  <Button variant="ghost" size="icon" onClick={() => delMut.mutate(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        {canEdit && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end pt-2 border-t">
            <div className="md:col-span-2">
              <Label className="text-xs">Bezeichnung</Label>
              <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Anzahl</Label>
              <Input type="number" min={1} value={draft.quantity}
                onChange={(e) => setDraft({ ...draft, quantity: parseInt(e.target.value) || 1 })} />
            </div>
            <div>
              <Label className="text-xs">Kennzeichnung</Label>
              <Input value={draft.marking} onChange={(e) => setDraft({ ...draft, marking: e.target.value })} />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs">Bemerkung</Label>
              <Input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </div>
            <Button size="sm" onClick={() => addMut.mutate()} disabled={!draft.label || addMut.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Hinzufügen
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Beim Abschluss dieses Bausteins werden je Zeile automatisch ein Sample und – falls Labor-Dienstleistungen
          in den Stammdaten hinterlegt sind – ein Labor-Auftrag erzeugt.
        </p>
      </CardContent>
    </Card>
  );
}

// -------------------------------------------------------------------
// Übergabe summary
// -------------------------------------------------------------------
function UebergabeSummary({ orderId }: { orderId: string }) {
  const listQ = useQuery({
    queryKey: ["pp_produced", orderId],
    queryFn: () => api.pilotPlantProducedSamples.listForOrder(orderId),
    enabled: !!orderId,
  });
  const rows = listQ.data ?? [];
  const materialised = rows.filter((r) => r.created_sample_id);

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Übergabe an das Labor</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">
          {materialised.length} von {rows.length} Proben wurden bereits als Labor-Samples angelegt.
        </p>
        {materialised.length > 0 && (
          <ul className="space-y-1">
            {materialised.map((r) => (
              <li key={r.id} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="font-medium">{r.label}</span>
                {r.created_order_id && (
                  <a
                    href={`/auftraege/${r.created_order_id}`}
                    className="text-primary underline text-xs ml-auto"
                  >
                    Labor-Auftrag öffnen
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
