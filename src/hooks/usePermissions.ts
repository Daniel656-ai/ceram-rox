import { useAuth } from "@/contexts/AuthContext";
import { useCallback } from "react";

// All available permission keys in the system.
// SINGLE SOURCE OF TRUTH — also used by scripts/audit-permissions.ts
export const ALL_PERMISSIONS = [
  // Samples
  "samples.create",
  "samples.view",
  "samples.edit",
  // Measurements / tasks
  "measurements.enter",
  "measurements.view",
  // Ergebniskorrekturen (nachträgliche Änderung gespeicherter Messergebnisse)
  "results.correct",
  // General editorial
  "priorities.edit",
  "locations.edit",
  "reports.create",
  "reports.generate",
  "reports.approve",
  "reports.delete",
  "sds.manage",
  // Projects
  "projects.assign",
  "projects.create",
  "projects.view",
  "projects.edit",
  // Orders
  "orders.create",
  "orders.view",
  "orders.edit",
  "orders.delete",
  // Auftragsentwürfe & Vorlagen (optionale Zusatzfunktionen, deaktivierbar)
  "orders.drafts.manage",
  "orders.use_as_template",
  // Raw materials / consumables / mixtures
  "raw_materials.manage",
  "raw_materials.batches.manage",
  "consumables.manage",
  "mixtures.view",
  "mixtures.create",
  "mixtures.edit",
  "mixtures.delete",
  "mixtures.produce",
  // Admin
  "users.manage",
  "services.manage",
  "absences.manage_all",
  "admin.system",
  "admin.database",
  // Costs
  "costs.manage",
  "costs.view_personnel",
  "costs.view_hourly_rates",
  "costs.edit_hourly_rates",
  // Calendar
  "calendar.view_others_vacation",
  // Notifications / audit (DB-driven, now exposed in UI)
  "notifications.measurement_completed",
  "notifications.priority_violation",
  "activity_log.view_all",
  "hazard_notifications.manage",
  "weekly_reviews.manage_all",
  // Portfolios
  "portfolios.view",
  "portfolios.create",
  "portfolios.edit",
  "portfolios.delete",
  "portfolios.assign_projects",
  "portfolios.remove_projects",
  "portfolios.export",
  "portfolios.documents.manage",
  "portfolios.dashboard.view",
] as const;

export type PermissionKey = (typeof ALL_PERMISSIONS)[number];

// Navigation visibility permission keys
export const NAV_PERMISSIONS = [
  "nav.dashboard",
  "nav.orders",
  "nav.projects",
  "nav.samples",
  "nav.results_database",
  "nav.raw_materials",
  "nav.mixtures",
  "nav.consumables",
  "nav.lab_planning",
  "nav.calendar",
  "nav.admin",
  "nav.admin.users",
  "nav.admin.roles",
  "nav.admin.services",
  "nav.admin.statistics",
  "nav.admin.permissions",
  "nav.admin.sync",
  "nav.admin.database",
  "nav.portfolios",
] as const;

export type NavPermissionKey = (typeof NAV_PERMISSIONS)[number];

export const NAV_PERMISSION_LABELS: Record<NavPermissionKey, { de: string; en: string }> = {
  "nav.dashboard": { de: "Dashboard", en: "Dashboard" },
  "nav.orders": { de: "Messaufträge", en: "Measurement Orders" },
  "nav.projects": { de: "Projekte", en: "Projects" },
  "nav.samples": { de: "Proben", en: "Samples" },
  "nav.results_database": { de: "Ergebnisdatenbank", en: "Results Database" },
  "nav.raw_materials": { de: "Rohstoffe", en: "Raw Materials" },
  "nav.mixtures": { de: "Knetungen & Lösungen", en: "Kneadings & Solutions" },
  "nav.consumables": { de: "Projektaufwendungen", en: "Project Expenses" },
  "nav.lab_planning": { de: "Laborplanung", en: "Lab Planning" },
  "nav.calendar": { de: "Kalender", en: "Calendar" },
  "nav.admin": { de: "Administration (Hauptordner)", en: "Administration (Main)" },
  "nav.admin.users": { de: "Benutzer", en: "Users" },
  "nav.admin.roles": { de: "Rollen", en: "Roles" },
  "nav.admin.services": { de: "Dienstleistungen", en: "Services" },
  "nav.admin.statistics": { de: "Statistiken", en: "Statistics" },
  "nav.admin.permissions": { de: "Kompetenzmatrix", en: "Competency Matrix" },
  "nav.admin.sync": { de: "Synchronisation", en: "Synchronization" },
  "nav.admin.database": { de: "Datenbank", en: "Database" },
  "nav.portfolios": { de: "Projektportfolio", en: "Project Portfolio" },
};

export interface NavTreeNode {
  key: NavPermissionKey;
  children?: NavTreeNode[];
}

export const NAV_TREE: NavTreeNode[] = [
  { key: "nav.dashboard" },
  { key: "nav.orders" },
  { key: "nav.projects" },
  { key: "nav.samples" },
  { key: "nav.results_database" },
  { key: "nav.raw_materials" },
  { key: "nav.mixtures" },
  { key: "nav.consumables" },
  { key: "nav.lab_planning" },
  { key: "nav.calendar" },
  { key: "nav.portfolios" },
  {
    key: "nav.admin",
    children: [
      { key: "nav.admin.users" },
      { key: "nav.admin.roles" },
      { key: "nav.admin.services" },
      { key: "nav.admin.statistics" },
      { key: "nav.admin.permissions" },
      { key: "nav.admin.sync" },
      { key: "nav.admin.database" },
    ],
  },
];

export const PERMISSION_LABELS: Record<PermissionKey, { de: string; en: string }> = {
  "samples.create": { de: "Proben anlegen", en: "Create samples" },
  "samples.view": { de: "Proben ansehen", en: "View samples" },
  "samples.edit": { de: "Proben bearbeiten", en: "Edit samples" },
  "measurements.enter": { de: "Aufgaben eintragen", en: "Enter tasks" },
  "measurements.view": { de: "Aufgaben ansehen", en: "View tasks" },
  "results.correct": { de: "Messergebnisse korrigieren", en: "Correct measurement results" },
  "priorities.edit": { de: "Prioritäten ändern", en: "Edit priorities" },
  "locations.edit": { de: "Lagerort ändern", en: "Edit locations" },
  "projects.assign": { de: "Projektzuordnung", en: "Assign projects" },
  "projects.create": { de: "Projekte erstellen", en: "Create projects" },
  "projects.view": { de: "Projekte ansehen", en: "View projects" },
  "projects.edit": { de: "Projekte bearbeiten", en: "Edit projects" },
  "reports.create": { de: "Berichte erstellen", en: "Create reports" },
  "reports.generate": { de: "Ergebnisbericht generieren", en: "Generate result report" },
  "reports.approve": { de: "Ergebnisbericht freigeben", en: "Approve result report" },
  "reports.delete": { de: "Ergebnisbericht löschen", en: "Delete result report" },
  "sds.manage": { de: "Sicherheitsdatenblätter verwalten", en: "Manage SDS" },
  "orders.create": { de: "Aufträge erstellen", en: "Create orders" },
  "orders.view": { de: "Aufträge ansehen", en: "View orders" },
  "orders.edit": { de: "Aufträge bearbeiten", en: "Edit orders" },
  "orders.delete": { de: "Aufträge löschen", en: "Delete orders" },
  "orders.drafts.manage": { de: "Auftragsentwürfe verwalten", en: "Manage order drafts" },
  "orders.use_as_template": { de: "Aufträge als Vorlage verwenden", en: "Use orders as template" },
  "raw_materials.manage": { de: "Rohstoffe verwalten", en: "Manage raw materials" },
  "raw_materials.batches.manage": { de: "LOT-Nummern & Gebinde anlegen/bearbeiten", en: "Create/edit LOTs & containers" },
  "consumables.manage": { de: "Verbrauchsmaterialien verwalten", en: "Manage consumables" },
  "mixtures.view": { de: "Knetungen & Lösungen anzeigen", en: "View kneadings & solutions" },
  "mixtures.create": { de: "Knetungen & Lösungen anlegen", en: "Create kneadings & solutions" },
  "mixtures.edit": { de: "Knetungen & Lösungen bearbeiten", en: "Edit kneadings & solutions" },
  "mixtures.delete": { de: "Knetungen & Lösungen löschen", en: "Delete kneadings & solutions" },
  "mixtures.produce": { de: "Knetungen & Lösungen herstellen", en: "Produce kneadings & solutions" },
  "users.manage": { de: "Benutzer verwalten", en: "Manage users" },
  "services.manage": { de: "Dienstleistungen verwalten", en: "Manage services" },
  "absences.manage_all": { de: "Alle Abwesenheiten verwalten", en: "Manage all absences" },
  "admin.system": { de: "Systemadministration", en: "System administration" },
  "admin.database": { de: "Datenbank-Administration", en: "Database administration" },
  "costs.manage": { de: "Kosten & Kostensätze verwalten", en: "Manage costs & rates" },
  "costs.view_personnel": { de: "Personenbezogene Kosten sehen", en: "View personnel costs" },
  "costs.view_hourly_rates": { de: "Stundensätze sehen", en: "View hourly rates" },
  "costs.edit_hourly_rates": { de: "Stundensätze bearbeiten", en: "Edit hourly rates" },
  "calendar.view_others_vacation": { de: "Urlaubstage anderer sehen", en: "View others' vacation days" },
  "notifications.measurement_completed": { de: "Benachrichtigung: Messung abgeschlossen", en: "Notification: Measurement completed" },
  "notifications.priority_violation": { de: "Benachrichtigung: Prioritätsverletzung", en: "Notification: Priority violation" },
  "activity_log.view_all": { de: "Gesamtes Aktivitätsprotokoll sehen", en: "View full activity log" },
  "hazard_notifications.manage": { de: "Gefahrstoff-Verteiler verwalten", en: "Manage hazard distribution list" },
  "weekly_reviews.manage_all": { de: "Weekly Reviews aller Projekte verwalten", en: "Manage weekly reviews across all projects" },
  "portfolios.view": { de: "Projektportfolio ansehen", en: "View project portfolios" },
  "portfolios.create": { de: "Projektportfolio anlegen", en: "Create project portfolios" },
  "portfolios.edit": { de: "Projektportfolio bearbeiten", en: "Edit project portfolios" },
  "portfolios.delete": { de: "Projektportfolio löschen", en: "Delete project portfolios" },
  "portfolios.assign_projects": { de: "Projekte einem Portfolio zuordnen", en: "Assign projects to portfolios" },
  "portfolios.remove_projects": { de: "Projekte aus Portfolio entfernen", en: "Remove projects from portfolios" },
  "portfolios.export": { de: "Portfolio-Berichte exportieren", en: "Export portfolio reports" },
  "portfolios.documents.manage": { de: "Portfolio-Dokumente verwalten", en: "Manage portfolio documents" },
  "portfolios.dashboard.view": { de: "Portfolio-Dashboard ansehen", en: "View portfolio dashboard" },
};

export const PERMISSION_GROUPS: { key: string; labelDe: string; labelEn: string; permissions: PermissionKey[] }[] = [
  { key: "samples", labelDe: "Proben", labelEn: "Samples", permissions: ["samples.create", "samples.view", "samples.edit"] },
  { key: "measurements", labelDe: "Aufgaben", labelEn: "Tasks", permissions: ["measurements.enter", "measurements.view", "results.correct"] },
  { key: "orders", labelDe: "Aufträge", labelEn: "Orders", permissions: ["orders.create", "orders.view", "orders.edit", "orders.delete", "orders.drafts.manage", "orders.use_as_template"] },
  { key: "projects", labelDe: "Projekte", labelEn: "Projects", permissions: ["projects.create", "projects.view", "projects.edit", "projects.assign", "weekly_reviews.manage_all"] },
  { key: "costs", labelDe: "Kosten", labelEn: "Costs", permissions: ["costs.manage", "costs.view_personnel", "costs.view_hourly_rates", "costs.edit_hourly_rates"] },
  { key: "general", labelDe: "Allgemein", labelEn: "General", permissions: ["priorities.edit", "locations.edit", "reports.create", "reports.generate", "reports.approve", "reports.delete", "sds.manage", "raw_materials.manage", "raw_materials.batches.manage", "consumables.manage"] },
  { key: "mixtures", labelDe: "Knetungen & Lösungen", labelEn: "Kneadings & Solutions", permissions: ["mixtures.view", "mixtures.create", "mixtures.edit", "mixtures.delete", "mixtures.produce"] },
  { key: "admin", labelDe: "Administration", labelEn: "Administration", permissions: ["users.manage", "services.manage", "absences.manage_all", "admin.system", "admin.database", "hazard_notifications.manage"] },
  { key: "calendar", labelDe: "Kalender & Urlaub", labelEn: "Calendar & Vacation", permissions: ["calendar.view_others_vacation"] },
  { key: "notifications", labelDe: "Benachrichtigungen & Audit", labelEn: "Notifications & Audit", permissions: ["notifications.measurement_completed", "notifications.priority_violation", "activity_log.view_all"] },
  { key: "portfolios", labelDe: "Projektportfolio", labelEn: "Project Portfolio", permissions: ["portfolios.view", "portfolios.create", "portfolios.edit", "portfolios.delete", "portfolios.assign_projects", "portfolios.remove_projects", "portfolios.export", "portfolios.documents.manage", "portfolios.dashboard.view"] },
];

export function usePermissions() {
  const { permissions } = useAuth();

  const hasPermission = useCallback(
    (key: PermissionKey) => permissions.includes(key),
    [permissions]
  );

  const hasAnyPermission = useCallback(
    (keys: PermissionKey[]) => keys.some((k) => permissions.includes(k)),
    [permissions]
  );

  const hasAllPermissions = useCallback(
    (keys: PermissionKey[]) => keys.every((k) => permissions.includes(k)),
    [permissions]
  );

  const hasNavPermission = useCallback(
    (key: NavPermissionKey) => {
      // If no nav permissions are set at all, default to showing everything (backward compatibility)
      const hasAnyNavPerm = permissions.some((p) => p.startsWith("nav."));
      if (!hasAnyNavPerm) return true;
      // For admin sub-items, check if parent "nav.admin" is set; if parent is set, children inherit unless overridden
      if (key.startsWith("nav.admin.")) {
        const parentSet = permissions.includes("nav.admin");
        const childSet = permissions.includes(key);
        // If child is explicitly set, use it; otherwise inherit from parent
        if (childSet) return true;
        if (parentSet && !permissions.some((p) => p.startsWith("nav.admin.") && p !== key)) return true;
        if (parentSet) return childSet;
        return false;
      }
      return permissions.includes(key);
    },
    [permissions]
  );

  return { permissions, hasPermission, hasAnyPermission, hasAllPermissions, hasNavPermission };
}
