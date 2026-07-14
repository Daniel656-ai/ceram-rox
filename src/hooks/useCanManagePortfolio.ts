import { useAuth } from "@/contexts/AuthContext";

/**
 * Schreibrechte auf die Portfolio-Struktur (APs, Tasks, Kategorien).
 * Erlaubt für Master-Rolle oder Benutzer mit Custom-Rolle "PMO".
 * Projektleiter erhalten hierüber KEINE Schreibrechte.
 */
export function useCanManagePortfolio(): boolean {
  const { role, customRoleName } = useAuth();
  if (role === "master") return true;
  const normalized = (customRoleName ?? "").trim().toLowerCase();
  return normalized === "pmo";
}
