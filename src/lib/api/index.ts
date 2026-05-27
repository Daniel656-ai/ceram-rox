/**
 * Central API / repository layer.
 *
 * USAGE
 *   import { api } from "@/lib/api";
 *   const { data, error } = await api.from("orders").select("*");
 *   api.auth.signInWithPassword({ email, password });
 *   api.channel("foo").on(...).subscribe();
 *
 * RULE
 *   Outside of `src/lib/api/**` and `src/integrations/supabase/**`, nothing
 *   may import the supabase client directly. Always use `api`.
 *
 * Domain modules (api.orders, api.samples, ...) live next to this file and
 * encapsulate higher-level operations. New code should prefer them. The raw
 * `api.from / api.rpc / api.storage / ...` surface remains as an escape hatch
 * and for ad-hoc queries.
 */
import { dbClient } from "./client";

export const api = {
  // raw access (PostgREST-compatible escape hatch)
  from: dbClient.from.bind(dbClient),
  rpc: dbClient.rpc.bind(dbClient),

  // sub-systems
  auth: dbClient.auth,
  storage: dbClient.storage,
  functions: dbClient.functions,

  // realtime
  channel: dbClient.channel.bind(dbClient),
  removeChannel: dbClient.removeChannel.bind(dbClient),
  getChannels: dbClient.getChannels.bind(dbClient),
};

export type Api = typeof api;
export { dbClient } from "./client";
export type { Database } from "./client";
