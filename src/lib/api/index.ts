/**
 * Central API / repository layer.
 *
 * USAGE (public)
 *   import { api } from "@/lib/api";
 *   const projects = await api.projects.list();
 *   const project  = await api.projects.get(id);
 *   await api.consumables.create({ ... });
 *
 * RULE
 *   Outside of `src/lib/api/**` and `src/integrations/supabase/**`, nothing
 *   may import the supabase client directly. Use the `api.<domain>` functions.
 *
 *   The low-level escape hatches (`api.from`, `api.rpc`, `api.storage`,
 *   `api.functions`, `api.channel`, `api.auth`) still exist so the migration
 *   can proceed wave-by-wave without breaking older call sites, but they are
 *   considered legacy and must not be used in new code.
 */
import { dbClient } from "./client";

// --- Domain modules ----------------------------------------------------------
import {
  projects,
  projectMembers,
  projectSampleHistory,
} from "./projects";
import { samples, sampleHistory, sampleDocuments } from "./samples";
import { consumables } from "./consumables";
import { measurementResults } from "./measurementResults";
import { projectMilestones } from "./projectMilestones";
import { projectTimeEntries } from "./projectTimeEntries";
import {
  projectConsumables,
  projectKnetungMaterials,
} from "./projectMaterials";

export const api = {
  // ---- domain modules (preferred) ----
  projects,
  projectMembers,
  projectSampleHistory,
  samples,
  sampleHistory,
  sampleDocuments,
  consumables,
  measurementResults,
  projectMilestones,
  projectTimeEntries,
  projectConsumables,
  projectKnetungMaterials,

  // ---- legacy low-level facade (DO NOT use outside src/lib/api/**) ----
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
