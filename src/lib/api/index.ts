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
import { orderSamples } from "./orderSamples";
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
import { weighingOcr } from "./weighingOcr";
import { users, profiles } from "./users";
import { customRoles } from "./customRoles";
import { absences } from "./absences";
import { downtimes } from "./downtimes";
import { workSchedules } from "./workSchedules";
import { syncSettings } from "./syncSettings";
import { workPackages } from "./workPackages";
import { workPackageDependencies } from "./workPackageDependencies";
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
import { projectReports } from "./projectReports";
import {
  projectChangeRequests,
  projectDecisions,
  projectStakeholders,
  projectLessonsLearned,
} from "./projectGovernance";
import { projectClosure } from "./projectClosure";
import { projectServices } from "./projectServices";
import { serviceDataFields } from "./serviceDesigner";
import { serviceFormLayouts } from "./serviceFormLayouts";
import { serviceRules } from "./serviceRules";
import { serviceDocumentTemplates } from "./serviceDocumentTemplates";
import { serviceBlocks } from "./serviceBlocks";
import { serviceWorkflows } from "./serviceWorkflows";
import { serviceVersions } from "./serviceVersions";
import { projectExpenseCategories, projectExpenses } from "./projectExpenses";
import { serviceFieldTemplates } from "./serviceFieldTemplates";
import { orderUploads } from "./orderUploads";
import { servicePackages } from "./servicePackages";
import { orderAnalysisRequests } from "./orderAnalysisRequests";
import { orderReports } from "./orderReports";
import {
  projectPortfolios,
  portfolioMembers,
  portfolioPeriods,
  portfolioMilestones,
  portfolioDocuments,
  portfolioAnalytics,
  portfolioDashboard,
} from "./projectPortfolios";
import { portfolioControlling } from "./portfolioControlling";
import { workPackageCategories } from "./workPackageCategories";
import {
  portfolioWorkPackages,
  portfolioTasks,
  portfolioFfgAnalytics,
  portfolioWpProjectMap,
  portfolioTaskProjectMap,
  projectWorkPackagesLookup,
  portfolioStructureAudit,
} from "./portfolioStructure";
import {
  serviceForms,
  workflowDefinitions,
  workflowSteps,
  workflowTasks,
  workflowStepServices,
  workflowTaskPositions,
  orderSharedFormData,
} from "./workflowDesigner";
import {
  workObjects,
  workObjectOrigins,
  workflowTemplates,
  servicePackageWorkflowMap,
  workTasks,
} from "./workObjects";
import { pilotPlantBlocks, pilotPlantProducedSamples } from "./pilotPlantProcess";
import { processTemplates } from "./processTemplates";
import { processSteps as processTemplateSteps } from "./processSteps";
import { processStepRawMaterials } from "./processStepRawMaterials";
import { formDefinitions } from "./formDefinitions";
import { formCalculations } from "./formCalculations";
import { globalObjects, globalFields } from "./globalModel";
import { globalLists, globalListItems, globalListAttributes, masterData, globalCalculations, globalValidations } from "./globalLibrary";
import { formFields } from "./formFields";
import { measurementImportProfiles } from "./measurementImportProfiles";
import { formRoleViews } from "./formRoleViews";
import { formFieldPermissions } from "./formFieldPermissions";
import { serviceFormLinks } from "./serviceFormLinks";
import { processServiceLinks } from "./processServiceLinks";
import { workflowProcessLinks } from "./workflowProcessLinks";
import { orderWorkflow } from "./orderWorkflow";
import { orderInstances } from "./orderInstances";
import { orderStepRuns, orderStepPositions } from "./orderStepRuns";
import { workflowEngine } from "./workflowEngine";
import { orderKindFormTemplates } from "./orderKindFormTemplates";
import { systemContext } from "./systemContext";









export const api = {
  // ---- domain modules (preferred) ----
  weighingOcr,
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
  orderSamples,
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
  workPackageDependencies,
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
  projectReports,
  projectChangeRequests,
  projectDecisions,
  projectStakeholders,
  projectLessonsLearned,
  projectClosure,
  projectServices,
  serviceDataFields,
  serviceFormLayouts,
  serviceRules,
  serviceDocumentTemplates,
  serviceBlocks,
  serviceWorkflows,
  serviceVersions,
  projectExpenseCategories,
  projectExpenses,
  serviceFieldTemplates,
  orderUploads,
  servicePackages,
  orderAnalysisRequests,
  orderReports,
  projectPortfolios,
  portfolioMembers,
  portfolioPeriods,
  portfolioMilestones,
  portfolioDocuments,
  portfolioAnalytics,
  portfolioDashboard,
  portfolioControlling,
  workPackageCategories,
  portfolioWorkPackages,
  portfolioTasks,
  portfolioFfgAnalytics,
  portfolioWpProjectMap,
  portfolioTaskProjectMap,
  projectWorkPackagesLookup,
  portfolioStructureAudit,

  // ---- workflow & form designer (Phase 1) ----
  serviceForms,
  workflowDefinitions,
  workflowSteps,
  workflowTasks,
  workflowStepServices,
  workflowTaskPositions,
  orderSharedFormData,

  // ---- work objects & workflow runtime (Big Bang UI) ----
  workObjects,
  workObjectOrigins,
  workflowTemplates,
  servicePackageWorkflowMap,
  workTasks,

  // ---- pilot plant process (9-step workflow) ----
  pilotPlantBlocks,
  pilotPlantProducedSamples,

  // ---- Phase 3: unified Prozess-Designer ----
  processTemplates,
  processTemplateSteps,
  processStepRawMaterials,
  formDefinitions,
  globalObjects,
  globalFields,
  globalLists,
  globalListItems,
  globalListAttributes,
  masterData,
  globalCalculations,
  globalValidations,
  formFields,
  measurementImportProfiles,
  formCalculations,
  formRoleViews,
  formFieldPermissions,

  // ---- Workflow-Architektur: Vorlagen-Verknüpfungen & Auftrags-Instanzen ----
  serviceFormLinks,
  processServiceLinks,
  workflowProcessLinks,
  orderWorkflow,

  // ---- Phase 5: order_instances + workflow engine ----
  orderInstances,
  orderStepRuns,
  orderStepPositions,
  workflowEngine,
  orderKindFormTemplates,

  // ---- Prozessmanager: globale Systemvariablen (Context Variables) ----
  systemContext,










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
