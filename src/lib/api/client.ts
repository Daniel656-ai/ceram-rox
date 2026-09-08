/**
 * Single source of truth for the backend client.
 *
 * NOTE: `src/integrations/supabase/client.ts` is auto-generated and must not be
 * edited. This file is the ONLY place in the application that is allowed to
 * import from it. Everything else MUST go through `src/lib/api`.
 *
 * If the backend is ever swapped (self-hosted Supabase, custom REST, etc.),
 * only this file and the domain modules under `src/lib/api/` need to change.
 * Hooks, components and pages stay untouched.
 */
import { supabase as _supabase } from "@/integrations/supabase/client";

export const dbClient = _supabase;
export type { Database } from "@/integrations/supabase/types";
