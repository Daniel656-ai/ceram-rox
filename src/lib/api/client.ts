/**
 * Single source of truth for the backend client.
 *
 * Web-App und Desktop-Version (Tauri) müssen zwingend dasselbe Backend
 * verwenden. Der Client wird deshalb aus der zentralen Backend-Konfiguration
 * (`backendConfig.ts`) erzeugt – dort wird eine unbrauchbare, lokale
 * Build-Adresse (z. B. ein Supabase auf …:54321 im LAN) durch die produktive
 * Adresse desselben Projekts ersetzt. Datenbank, Storage, Auth und Edge
 * Functions zeigen damit immer auf ein und dieselbe Instanz.
 *
 * `src/integrations/supabase/client.ts` ist auto-generiert; hier wird nur der
 * ebenfalls auto-generierte Auth-Storage übernommen, damit die Anmeldung in
 * der Vorschau unverändert funktioniert.
 *
 * If the backend is ever swapped (self-hosted Supabase, custom REST, etc.),
 * only this file and the domain modules under `src/lib/api/` need to change.
 * Hooks, components and pages stay untouched.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { brokeredPreviewStorage } from "@/integrations/supabase/previewAuthStorage";
import { BACKEND_URL, BACKEND_ANON_KEY } from "./backendConfig";

export const dbClient = createClient<Database>(BACKEND_URL, BACKEND_ANON_KEY, {
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type { Database } from "@/integrations/supabase/types";
