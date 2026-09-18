import { dbClient } from "./client";

export interface UsageEventInput {
  occurred_at: string;
  module: string;
  action: string;
  user_id: string;
  variant: "web" | "desktop";
}

/**
 * Technisches Nutzungs-Tracking.
 *
 * Bewusst entkoppelt von allen fachlichen Daten. Fehler werden still
 * behandelt: fehlt die Tabelle im jeweiligen Datenbestand oder besteht
 * keine Netzwerkverbindung, fällt das Tracking einfach aus.
 */
export const usageEvents = {
  async insertBatch(events: UsageEventInput[]): Promise<boolean> {
    if (events.length === 0) return true;
    try {
      const { error } = await (dbClient as any).from("usage_events").insert(events);
      return !error;
    } catch {
      return false;
    }
  },
};
