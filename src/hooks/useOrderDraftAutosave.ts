import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { sanitizeDraftPayload, type OrderDraftPayload } from "@/lib/api/orderDrafts";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface Args {
  enabled: boolean;
  userId: string | undefined;
  draftId: string | null;
  onDraftCreated: (id: string) => void;
  payload: OrderDraftPayload;
  title: string;
  /** Entwurf darf erst angelegt werden, wenn tatsächlich etwas eingegeben wurde. */
  hasContent: boolean;
}

/**
 * Automatische Zwischenspeicherung der Auftragserstellung als Entwurf.
 * Entkoppelt vom Absenden: ein Entwurf startet keinen Workflow und erzeugt
 * weder Aufgaben noch Auftragsnummern.
 */
export function useOrderDraftAutosave({
  enabled, userId, draftId, onDraftCreated, payload, title, hasContent,
}: Args) {
  const [state, setState] = useState<SaveState>("idle");
  const lastSerialized = useRef<string>("");
  const inFlight = useRef(false);
  const draftIdRef = useRef<string | null>(draftId);
  draftIdRef.current = draftId;

  const serialized = JSON.stringify(sanitizeDraftPayload(payload));

  useEffect(() => {
    if (!enabled || !userId || !hasContent) return;
    if (serialized === lastSerialized.current) return;

    const timer = setTimeout(async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      setState("saving");
      try {
        const parsed = JSON.parse(serialized) as OrderDraftPayload;
        const meta = {
          title,
          project_id: parsed.selectedProjectId || null,
          order_kind: parsed.orderKind ?? null,
          service_count: parsed.measurements?.length ?? 0,
        };
        if (draftIdRef.current) {
          await api.orderDrafts.update(draftIdRef.current, { ...meta, payload: parsed });
        } else {
          const created = await api.orderDrafts.create({
            created_by: userId,
            ...meta,
            payload: parsed,
          });
          onDraftCreated(created.id);
        }
        lastSerialized.current = serialized;
        setState("saved");
      } catch {
        setState("error");
      } finally {
        inFlight.current = false;
      }
    }, 1200);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, enabled, userId, hasContent, title]);

  /** Sofort speichern (z. B. „Entwurf speichern & schließen"). */
  const saveNow = async (): Promise<string | null> => {
    if (!enabled || !userId) return null;
    setState("saving");
    try {
      const parsed = JSON.parse(serialized) as OrderDraftPayload;
      const meta = {
        title,
        project_id: parsed.selectedProjectId || null,
        order_kind: parsed.orderKind ?? null,
        service_count: parsed.measurements?.length ?? 0,
      };
      let id = draftIdRef.current;
      if (id) {
        await api.orderDrafts.update(id, { ...meta, payload: parsed });
      } else {
        const created = await api.orderDrafts.create({ created_by: userId, ...meta, payload: parsed });
        id = created.id;
        onDraftCreated(id);
      }
      lastSerialized.current = serialized;
      setState("saved");
      return id;
    } catch {
      setState("error");
      return null;
    }
  };

  /** Nach erfolgreichem Absenden: Entwurf entfernen. */
  const discard = async () => {
    if (draftIdRef.current) {
      try {
        await api.orderDrafts.remove(draftIdRef.current);
      } catch {
        /* Entwurf-Aufräumen darf den Auftrag nicht beeinträchtigen */
      }
    }
  };

  return { state, saveNow, discard };
}
