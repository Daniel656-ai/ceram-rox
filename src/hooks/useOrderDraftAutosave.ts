import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { sanitizeDraftPayload, type OrderDraftPayload } from "@/lib/api/orderDrafts";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
interface Args {
  enabled: boolean;
  userId: string | undefined;
  draftId: string | null;
  onDraftCreated: (id: string) => void;
  payload: OrderDraftPayload;
  title: string;
  hasContent: boolean;
  restoredPayload?: OrderDraftPayload | null;
}

/** Single serialized writer: close/refresh drain all edits, including edits made during a request. */
export function useOrderDraftAutosave(args: Args) {
  const [state, setState] = useState<SaveState>("idle");
  const lastSerialized = useRef("");
  const baselineId = useRef<string | null>(null);
  const draftIdRef = useRef(args.draftId);
  const writer = useRef<Promise<string | null> | null>(null);
  const stopped = useRef(false);
  const latest = useRef(args);
  latest.current = args;
  const serialized = JSON.stringify(sanitizeDraftPayload(args.payload));
  const serializedRef = useRef(serialized);
  serializedRef.current = serialized;

  useEffect(() => {
    if (!args.draftId && baselineId.current) {
      draftIdRef.current = null;
      baselineId.current = null;
      lastSerialized.current = "";
      stopped.current = false;
      setState("idle");
    }
    if (args.restoredPayload && args.draftId !== baselineId.current) {
      draftIdRef.current = args.draftId;
      baselineId.current = args.draftId;
      lastSerialized.current = JSON.stringify(sanitizeDraftPayload(args.restoredPayload));
      setState("saved");
    }
  }, [args.draftId, args.restoredPayload]);

  const dirty = (args.hasContent || !!args.draftId) && serialized !== lastSerialized.current;
  const saveNow = (): Promise<string | null> => {
    if (writer.current) return writer.current;
    if (!latest.current.enabled || !latest.current.userId || stopped.current) return Promise.resolve(null);
    const job = async () => {
      setState("saving");
      try {
        do {
          const current = latest.current;
          const userId = current.userId;
          if (!userId || !current.enabled || stopped.current) return null;
          const snapshot = serializedRef.current;
          if (snapshot === lastSerialized.current && draftIdRef.current) break;
          const payload = JSON.parse(snapshot) as OrderDraftPayload;
          const meta = { title: current.title, project_id: payload.selectedProjectId || null,
            order_kind: payload.orderKind ?? null, service_count: payload.measurements?.length ?? 0, payload };
          if (draftIdRef.current) await api.orderDrafts.update(draftIdRef.current, meta);
          else {
            const created = await api.orderDrafts.create({ created_by: userId, ...meta });
            draftIdRef.current = created.id;
            baselineId.current = created.id;
            current.onDraftCreated(created.id);
          }
          lastSerialized.current = snapshot;
        } while (serializedRef.current !== lastSerialized.current);
        setState("saved");
        return draftIdRef.current;
      } catch {
        setState("error");
        return null;
      }
    };
    writer.current = job().finally(() => { writer.current = null; });
    return writer.current;
  };

  useEffect(() => {
    if (!args.enabled || !args.userId || !dirty || stopped.current) return;
    if (!writer.current) setState("dirty");
    const timer = setTimeout(() => { void saveNow(); }, 1200);
    return () => clearTimeout(timer);
  }, [serialized, args.enabled, args.userId, dirty]);

  useEffect(() => {
    if (!dirty && !writer.current) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, state]);

  const discard = async () => {
    stopped.current = true;
    if (writer.current) await writer.current;
    if (draftIdRef.current) {
      try { await api.orderDrafts.remove(draftIdRef.current); } catch { /* submission remains valid */ }
    }
  };
  return { state: dirty && state === "saved" ? "dirty" as const : state, dirty, saveNow, discard };
}
