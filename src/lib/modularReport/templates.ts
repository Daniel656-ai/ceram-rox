/**
 * Persönliche Berichtsvorlagen – benutzerbezogen im localStorage
 * (Muster wie `src/lib/tasks/taskServiceFilter.ts`). Geräte-/browsergebunden.
 *
 * Eine Vorlage enthält ausschließlich das bereinigte Layout (Struktur,
 * Reihenfolge, Sichtbarkeit, Überschriften, zweisprachige Standardtexte).
 * Auftragsspezifische Texte, Titel, Bearbeiter oder Daten werden nie gespeichert.
 */
import { sanitizeLayout, type ReportLayout } from "./config";

export interface PersonalReportTemplate {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  layout: ReportLayout;
}

export const templateStorageKey = (userId: string) => `rox.modularReport.templates.v1.${userId}`;

function sanitizeTemplate(t: unknown): PersonalReportTemplate | null {
  if (!t || typeof t !== "object") return null;
  const o = t as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string" || !o.name.trim()) return null;
  return {
    id: o.id,
    name: o.name.trim(),
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date(0).toISOString(),
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date(0).toISOString(),
    layout: sanitizeLayout(o.layout),
  };
}

export function loadTemplates(userId: string | null | undefined): PersonalReportTemplate[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(templateStorageKey(userId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr.map(sanitizeTemplate).filter(Boolean) as PersonalReportTemplate[]) : [];
  } catch {
    return [];
  }
}

function persist(userId: string, list: PersonalReportTemplate[]) {
  try {
    localStorage.setItem(templateStorageKey(userId), JSON.stringify(list));
  } catch {
    /* Speicherfehler dürfen die Ansicht nicht blockieren */
  }
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `t${Date.now()}${Math.random().toString(36).slice(2)}`;

export function saveTemplate(userId: string, name: string, layout: ReportLayout, existingId?: string): PersonalReportTemplate[] {
  const list = loadTemplates(userId);
  const now = new Date().toISOString();
  const clean = sanitizeLayout(layout);
  const idx = existingId ? list.findIndex((t) => t.id === existingId) : -1;
  if (idx >= 0) list[idx] = { ...list[idx], name: name.trim() || list[idx].name, layout: clean, updatedAt: now };
  else list.push({ id: newId(), name: name.trim(), createdAt: now, updatedAt: now, layout: clean });
  persist(userId, list);
  return list;
}

export function renameTemplate(userId: string, id: string, name: string): PersonalReportTemplate[] {
  const list = loadTemplates(userId).map((t) => (t.id === id && name.trim() ? { ...t, name: name.trim(), updatedAt: new Date().toISOString() } : t));
  persist(userId, list);
  return list;
}

export function deleteTemplate(userId: string, id: string): PersonalReportTemplate[] {
  const list = loadTemplates(userId).filter((t) => t.id !== id);
  persist(userId, list);
  return list;
}
