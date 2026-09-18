import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { moduleFromPath, runtimeVariant } from "@/lib/usageModule";
import type { UsageEventInput } from "@/lib/api/usageEvents";

const FLUSH_INTERVAL_MS = 15000;
const MAX_BUFFER = 20;

/**
 * Zentrales, rein technisches Nutzungs-Tracking ("module_opened").
 *
 * - keine fachlichen Inhalte
 * - blockiert niemals Navigation, Seitenaufbau oder fachliche Prozesse
 * - Fehler (fehlende Struktur, offline) werden still ignoriert
 */
export function useUsageTracking() {
  const location = useLocation();
  const { user } = useAuth();
  const buffer = useRef<UsageEventInput[]>([]);
  const lastModule = useRef<string | null>(null);
  const userId = user?.id ?? null;

  const flush = useRef(async () => {
    const pending = buffer.current;
    if (pending.length === 0) return;
    buffer.current = [];
    try {
      const ok = await api.usageEvents.insertBatch(pending);
      if (!ok) return; // still verwerfen – kein Retry, kein Fehlerdialog
    } catch {
      /* ignore */
    }
  });

  useEffect(() => {
    if (!userId) return;
    const mod = moduleFromPath(location.pathname);
    if (mod === lastModule.current) return;
    lastModule.current = mod;

    buffer.current.push({
      occurred_at: new Date().toISOString(),
      module: mod,
      action: "module_opened",
      user_id: userId,
      variant: runtimeVariant(),
    });

    if (buffer.current.length >= MAX_BUFFER) void flush.current();
  }, [location.pathname, userId]);

  useEffect(() => {
    if (!userId) return;
    const timer = window.setInterval(() => void flush.current(), FLUSH_INTERVAL_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush.current();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      void flush.current();
    };
  }, [userId]);
}
