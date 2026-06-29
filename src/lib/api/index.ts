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
import { orders } from "./orders";
import { measurements, workLogs } from "./measurements";
import {
  measurementServices,
  measurementUsers,
  serviceParameters,
  servicePermissions,
} from "./measurementServices";
import { templates } from "./templates";
import { workstations, workstationTasks } from "./workstations";
import {
  storageLocations,
  rawMaterials,
  rawMaterialBatches,
  rawMaterialAnalyses,
  inventoryMovements,
  rawMaterialDocuments,
} from "./rawMaterials";
import { rawMaterialContainers } from "./rawMaterialContainers";
import { containerMovements } from "./containerMovements";
import { users, profiles } from "./users";
import { customRoles } from "./customRoles";
import { absences } from "./absences";
import { downtimes } from "./downtimes";
import { workSchedules } from "./workSchedules";
import { syncSettings } from "./syncSettings";
import { workPackages } from "./workPackages";
import {
  activityLog,
  notifications,
  realtime,
  measurementServicesLookup,
  ordersLookup,
  measurementsLookup,
  projectsLookup,
} from "./activityLog";
import { utilization } from "./utilization";
import { documents, sampleStorage, rawMaterialStorage } from "./documents";
import { measurementParameters } from "./measurementParameters";
import { adminDatabase, durchfuehrerUsers } from "./adminDatabase";
import { auth } from "./auth";
import { hazardNotifications } from "./hazardNotifications";
import {
  mixtures,
  mixtureRecipes,
  mixtureBatches,
  mixtureInventory,
  mixtureTraceability,
} from "./mixtures";
import { batches } from "./batches";
import { recipeVersions, processSections, processSteps, plannedMeasurements } from "./mixtureProcess";
import { mixtureExecution } from "./mixtureExecution";
import { mixtureTemplates } from "./mixtureTemplates";
import { companySettings } from "./companySettings";
import { labelTemplates, labelPrintHistory } from "./labelTemplates";
import { weeklyReviews } from "./weeklyReviews";
import { customSymbols } from "./customSymbols";
import { projectDocuments } from "./projectDocuments";
import {
  projectChangeRequests,
  projectDecisions,
  projectStakeholders,
  projectLessonsLearned,
} from "./projectGovernance";
import { projectClosure } from "./projectClosure";
import { projectServices } from "./projectServices";








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
  orders,
  measurements,
  workLogs,
  measurementServices,
  measurementUsers,
  serviceParameters,
  servicePermissions,
  templates,
  workstations,
  workstationTasks,
  storageLocations,
  rawMaterials,
  rawMaterialBatches,
  rawMaterialAnalyses,
  inventoryMovements,
  rawMaterialDocuments,
  rawMaterialContainers,
  containerMovements,
  users,
  profiles,
  customRoles,
  absences,
  downtimes,
  workSchedules,
  syncSettings,
  workPackages,
  activityLog,
  notifications,
  realtime,
  measurementServicesLookup,
  ordersLookup,
  measurementsLookup,
  projectsLookup,
  utilization,
  documents,
  sampleStorage,
  rawMaterialStorage,
  measurementParameters,
  adminDatabase,
  durchfuehrerUsers,
  hazardNotifications,
  mixtures,
  mixtureRecipes,
  mixtureBatches,
  mixtureInventory,
  mixtureTraceability,
  batches,
  recipeVersions,
  processSections,
  processSteps,
  plannedMeasurements,
  mixtureExecution,
  mixtureTemplates,
  companySettings,
  labelTemplates,
  labelPrintHistory,
  weeklyReviews,
  customSymbols,
  projectDocuments,
  projectChangeRequests,
  projectDecisions,
  projectStakeholders,
  projectLessonsLearned,
  projectClosure,
  projectServices,







  // ---- auth domain (preferred wrapper around the auth client) ----
  auth,

  // ---- legacy low-level facade (DO NOT use outside src/lib/api/**) ----
  from: dbClient.from.bind(dbClient) as typeof dbClient.from,
  rpc: dbClient.rpc.bind(dbClient) as typeof dbClient.rpc,
  storage: dbClient.storage,
  functions: dbClient.functions,
  channel: dbClient.channel.bind(dbClient) as typeof dbClient.channel,
  removeChannel: dbClient.removeChannel.bind(dbClient) as typeof dbClient.removeChannel,
  getChannels: dbClient.getChannels.bind(dbClient) as typeof dbClient.getChannels,
};


export type Api = typeof api;
export { dbClient } from "./client";
export type { Database } from "./client";
