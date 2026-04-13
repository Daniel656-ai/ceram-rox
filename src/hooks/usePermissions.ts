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
] as const;

export type PermissionKey = (typeof ALL_PERMISSIONS)[number];

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
};

export const PERMISSION_GROUPS: { key: string; labelDe: string; labelEn: string; permissions: PermissionKey[] }[] = [
  { key: "samples", labelDe: "Proben", labelEn: "Samples", permissions: ["samples.create", "samples.view", "samples.edit"] },
  { key: "measurements", labelDe: "Messungen", labelEn: "Measurements", permissions: ["measurements.enter", "measurements.view"] },
  { key: "orders", labelDe: "Aufträge", labelEn: "Orders", permissions: ["orders.create", "orders.view", "orders.edit", "orders.delete"] },
  { key: "projects", labelDe: "Projekte", labelEn: "Projects", permissions: ["projects.create", "projects.view", "projects.edit", "projects.assign"] },
  { key: "costs", labelDe: "Kosten", labelEn: "Costs", permissions: ["costs.manage", "costs.view_personnel"] },
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

  return { permissions, hasPermission, hasAnyPermission, hasAllPermissions };
}
