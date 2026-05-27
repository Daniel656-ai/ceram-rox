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
 */
import { dbClient } from "./client";

// We re-export the underlying client methods. `bind` preserves runtime `this`
// but TypeScript drops generic overloads through `bind`, so we cast back to
// the original method type to keep full type-safety in callers.
export const api = {
  from: dbClient.from.bind(dbClient) as typeof dbClient.from,
  rpc: dbClient.rpc.bind(dbClient) as typeof dbClient.rpc,

  auth: dbClient.auth,
  storage: dbClient.storage,
  functions: dbClient.functions,

  channel: dbClient.channel.bind(dbClient) as typeof dbClient.channel,
  removeChannel: dbClient.removeChannel.bind(dbClient) as typeof dbClient.removeChannel,
  getChannels: dbClient.getChannels.bind(dbClient) as typeof dbClient.getChannels,
};

export type Api = typeof api;
export { dbClient } from "./client";
export type { Database } from "./client";
