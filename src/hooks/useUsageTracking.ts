import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { moduleFromPath } from "@/lib/usageModule";
import { setUsageUser, trackUsage, flushUsage } from "@/lib/usageTracking";

const FLUSH_INTERVAL_MS = 15000;

/**
 * Bindet die zentrale Nutzungserfassung an die gemeinsame Hülle für
 * angemeldete Seiten:
 * - meldet den angemeldeten Benutzer an die zentrale Tracking-Funktion
 * - erfasst automatisch jedes geöffnete Modul ("module_opened")
 *
 * Alle weiteren Module und Funktionen rufen direkt trackUsage(...) auf;
 * dafür ist an dieser Stelle keine Änderung nötig.
 */
export function useUsageTracking() {
  const location = useLocation();
  const { user } = useAuth();
  const lastModule = useRef<string | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    setUsageUser(userId);
    if (!userId) lastModule.current = null;
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const mod = moduleFromPath(location.pathname);
    if (mod === lastModule.current) return;
    lastModule.current = mod;
    // genau ein Ereignis je Modulwechsel – unabhängig von der Anzahl der Rollen
    trackUsage({ module: mod, action: "module_opened" });
  }, [location.pathname, userId]);

  useEffect(() => {
    if (!userId) return;
    const timer = window.setInterval(() => void flushUsage(), FLUSH_INTERVAL_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushUsage();
    };
    const onPageHide = () => void flushUsage();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      void flushUsage();
    };
  }, [userId]);
}
