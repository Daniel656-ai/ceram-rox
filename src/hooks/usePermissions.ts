import { useAuth } from "@/contexts/AuthContext";
import { useCallback } from "react";

// All available permission keys in the system
export const ALL_PERMISSIONS = [
  "samples.create",
  "samples.view",
  "samples.edit",
  "measurements.enter",
  "measurements.view",
  "priorities.edit",
  "locations.edit",
  "projects.assign",
  "projects.create",
  "projects.view",
  "projects.edit",
  "reports.create",
  "sds.manage",
  "orders.create",
  "orders.view",
  "orders.edit",
  "orders.delete",
  "raw_materials.manage",
  "workstations.manage",
  "users.manage",
  "services.manage",
  "absences.manage_all",
  "admin.system",
  "costs.manage",
  "costs.view_personnel",
  "costs.view_hourly_rates",
  "costs.edit_hourly_rates",
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
  "nav.consumables",
  "nav.work_planning",
  "nav.lab_planning",
  "nav.calendar",
  "nav.admin",
  "nav.admin.users",
  "nav.admin.roles",
  "nav.admin.services",
  "nav.admin.workstations",
  "nav.admin.statistics",
  "nav.admin.permissions",
  "nav.admin.sync",
  "nav.admin.database",
] as const;

export type NavPermissionKey = (typeof NAV_PERMISSIONS)[number];

export const NAV_PERMISSION_LABELS: Record<NavPermissionKey, { de: string; en: string }> = {
  "nav.dashboard": { de: "Dashboard", en: "Dashboard" },
  "nav.orders": { de: "Messaufträge", en: "Measurement Orders" },
  "nav.projects": { de: "Projekte", en: "Projects" },
  "nav.samples": { de: "Proben", en: "Samples" },
  "nav.results_database": { de: "Ergebnisdatenbank", en: "Results Database" },
  "nav.raw_materials": { de: "Rohstoffe", en: "Raw Materials" },
  "nav.consumables": { de: "Verbrauchsmaterialien", en: "Consumables" },
  "nav.work_planning": { de: "Arbeitsplanung", en: "Work Planning" },
  "nav.lab_planning": { de: "Laborplanung", en: "Lab Planning" },
  "nav.calendar": { de: "Kalender", en: "Calendar" },
  "nav.admin": { de: "Administration (Hauptordner)", en: "Administration (Main)" },
  "nav.admin.users": { de: "Benutzer", en: "Users" },
  "nav.admin.roles": { de: "Rollen", en: "Roles" },
  "nav.admin.services": { de: "Messdienstleistungen", en: "Measurement Services" },
  "nav.admin.workstations": { de: "Arbeitsplätze", en: "Workstations" },
  "nav.admin.statistics": { de: "Statistiken", en: "Statistics" },
  "nav.admin.permissions": { de: "Kompetenzmatrix", en: "Competency Matrix" },
  "nav.admin.sync": { de: "Synchronisation", en: "Synchronization" },
  "nav.admin.database": { de: "Datenbank", en: "Database" },
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
  { key: "nav.consumables" },
  { key: "nav.work_planning" },
  { key: "nav.lab_planning" },
  { key: "nav.calendar" },
  {
    key: "nav.admin",
    children: [
      { key: "nav.admin.users" },
      { key: "nav.admin.roles" },
      { key: "nav.admin.services" },
      { key: "nav.admin.workstations" },
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
  "measurements.enter": { de: "Messungen eintragen", en: "Enter measurements" },
  "measurements.view": { de: "Messungen ansehen", en: "View measurements" },
  "priorities.edit": { de: "Prioritäten ändern", en: "Edit priorities" },
  "locations.edit": { de: "Lagerort ändern", en: "Edit locations" },
  "projects.assign": { de: "Projektzuordnung", en: "Assign projects" },
  "projects.create": { de: "Projekte erstellen", en: "Create projects" },
  "projects.view": { de: "Projekte ansehen", en: "View projects" },
  "projects.edit": { de: "Projekte bearbeiten", en: "Edit projects" },
  "reports.create": { de: "Berichte erstellen", en: "Create reports" },
  "sds.manage": { de: "Sicherheitsdatenblätter verwalten", en: "Manage SDS" },
  "orders.create": { de: "Aufträge erstellen", en: "Create orders" },
  "orders.view": { de: "Aufträge ansehen", en: "View orders" },
  "orders.edit": { de: "Aufträge bearbeiten", en: "Edit orders" },
  "orders.delete": { de: "Aufträge löschen", en: "Delete orders" },
  "raw_materials.manage": { de: "Rohstoffe verwalten", en: "Manage raw materials" },
  "workstations.manage": { de: "Arbeitsplätze verwalten", en: "Manage workstations" },
  "users.manage": { de: "Benutzer verwalten", en: "Manage users" },
  "services.manage": { de: "Messdienstleistungen verwalten", en: "Manage services" },
  "absences.manage_all": { de: "Alle Abwesenheiten verwalten", en: "Manage all absences" },
  "admin.system": { de: "Systemadministration", en: "System administration" },
  "costs.manage": { de: "Kosten & Kostensätze verwalten", en: "Manage costs & rates" },
  "costs.view_personnel": { de: "Personenbezogene Kosten sehen", en: "View personnel costs" },
  "costs.view_hourly_rates": { de: "Stundensätze sehen", en: "View hourly rates" },
  "costs.edit_hourly_rates": { de: "Stundensätze bearbeiten", en: "Edit hourly rates" },
};

export const PERMISSION_GROUPS: { key: string; labelDe: string; labelEn: string; permissions: PermissionKey[] }[] = [
  { key: "samples", labelDe: "Proben", labelEn: "Samples", permissions: ["samples.create", "samples.view", "samples.edit"] },
  { key: "measurements", labelDe: "Messungen", labelEn: "Measurements", permissions: ["measurements.enter", "measurements.view"] },
  { key: "orders", labelDe: "Aufträge", labelEn: "Orders", permissions: ["orders.create", "orders.view", "orders.edit", "orders.delete"] },
  { key: "projects", labelDe: "Projekte", labelEn: "Projects", permissions: ["projects.create", "projects.view", "projects.edit", "projects.assign"] },
  { key: "costs", labelDe: "Kosten", labelEn: "Costs", permissions: ["costs.manage", "costs.view_personnel", "costs.view_hourly_rates", "costs.edit_hourly_rates"] },
  { key: "general", labelDe: "Allgemein", labelEn: "General", permissions: ["priorities.edit", "locations.edit", "reports.create", "sds.manage", "raw_materials.manage"] },
  { key: "admin", labelDe: "Administration", labelEn: "Administration", permissions: ["workstations.manage", "users.manage", "services.manage", "absences.manage_all", "admin.system"] },
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
