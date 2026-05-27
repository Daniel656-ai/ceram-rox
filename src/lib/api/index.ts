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

// Note: we delegate via arrow functions (not Function.prototype.bind) so that
// TypeScript preserves the generic overloads of `from<T>` and `rpc<T>`.
export const api = {
  from: ((...args: Parameters<typeof dbClient.from>) =>
    dbClient.from(...args)) as typeof dbClient.from,
  rpc: ((...args: Parameters<typeof dbClient.rpc>) =>
    dbClient.rpc(...args)) as typeof dbClient.rpc,

  auth: dbClient.auth,
  storage: dbClient.storage,
  functions: dbClient.functions,

  channel: ((...args: Parameters<typeof dbClient.channel>) =>
    dbClient.channel(...args)) as typeof dbClient.channel,
  removeChannel: ((...args: Parameters<typeof dbClient.removeChannel>) =>
    dbClient.removeChannel(...args)) as typeof dbClient.removeChannel,
  getChannels: () => dbClient.getChannels(),
};

export type Api = typeof api;
export { dbClient } from "./client";
export type { Database } from "./client";
