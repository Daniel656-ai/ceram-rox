# Berechtigungs-Audit Bericht
_Stand: 2026-06-17 · Scope: kompletter Frontend + Supabase RLS + Edge Functions_

## 1. Architektur (Ist-Zustand)

- **Basisrollen** (DB-Enum `app_role`): `master`, `auftraggeber`, `durchfuehrer` – gespeichert in `user_roles.role`.
- **Custom-Rollen** (`custom_roles` + `role_permissions`): erweitern jede Basisrolle um granulare Permission-Keys.
  - System-Rollen-IDs:
    - `…0001` = Administrator (master)
    - `…0002` = Auftraggeber
    - `…0003` = Messdienstleister
- **Frontend-Check**: `usePermissions().hasPermission(key)` – arbeitet ausschließlich auf den vom Backend gelieferten Keys.
- **Backend-Check**: SQL-Funktionen `has_role(uid, role)` und `has_permission(uid, key)` (SECURITY DEFINER, RLS-recursion-safe), eingesetzt in allen RLS-Policies und in Manager-RPCs.

## 2. Gefundene Lücken (vor diesem Audit)

| Schwere | Ort | Befund |
|---|---|---|
| 🔴 HIGH | `activity_log` INSERT-Policy | `WITH CHECK (auth.uid() IS NOT NULL)` → jeder eingeloggte User konnte beliebige Audit-Einträge fälschen. |
| 🔴 HIGH | `notifications` INSERT-Policy | Jeder User konnte Benachrichtigungen an fremde `user_id` schreiben. |
| 🔴 HIGH | `hazard_notification_log` INSERT-Policy | `WITH CHECK (true)` – komplett offen, sogar für anon. |
| 🟡 MED | `company_settings` SELECT-Policy | `roles: public` → anon konnte Firmenlogo/-name lesen. |
| 🟡 MED | `sample_documents` DELETE-Policy | Jeder User konnte fremde Probendokumente löschen. |
| 🟡 MED | DB-Keys ohne UI | `notifications.measurement_completed`, `notifications.priority_violation`, `activity_log.view_all`, `hazard_notifications.manage`, `admin.database` waren in RLS verwendet, aber im Frontend nicht in `ALL_PERMISSIONS` enthalten – konnten also nur direkt in der DB gepflegt werden. |
| 🟡 MED | `consumables` Mutationen | RLS erlaubt `auftraggeber` Anlegen/Ändern/Löschen des globalen Katalogs. → neuer Key `consumables.manage` ist registriert; die RLS-Verschärfung wird im Backlog (Phase 2) durchgeführt, sobald die Rollenvergabe migriert ist, um keine Auftraggeber sofort zu sperren. |
| 🟢 LOW | Mehrere Admin-Seiten ohne Frontend-Guard | `AdminHazardNotificationsPage`, `AdminStatsPage`, `AdminSyncPage`, `AdminUsersPage`, `AdminWorkstationsPage` haben keine `usePermissions`-Prüfung – RLS schützt die Daten, aber leere UI verwirrt. Sichtbarkeit ist über die Sidebar (`AppSidebar.tsx`) bereits korrekt gegated. (Route-Guard bewusst nicht eingeführt – Entscheidung des Users.) |
| 🟢 LOW | 97 SECURITY DEFINER Funktionen | Vom Supabase-Linter als "anon-executable" gemeldet. Alle prüfen intern via `has_role`/`has_permission`; das Risiko ist niedrig, aber für eine vollständige Härtung sollten `REVOKE EXECUTE … FROM anon` Migrationen folgen. |

## 3. Durchgeführte Korrekturen (Migration vom 2026-06-17)

1. `activity_log.INSERT` → `WITH CHECK (false)`; Inserts laufen ausschließlich über SECURITY-DEFINER-Trigger.
2. `notifications.INSERT` → `WITH CHECK (false)` (gleiches Prinzip).
3. `hazard_notification_log.INSERT` → `WITH CHECK (false)`.
4. `company_settings.SELECT` jetzt `TO authenticated`.
5. `sample_documents.DELETE` jetzt `uploaded_by = auth.uid() OR has_role('master')`.
6. `activity_log.SELECT`-Policy explizit auf `TO authenticated` reduziert.
7. Neue Permission-Keys der Administrator-Rolle zugewiesen:
   - `notifications.measurement_completed`
   - `notifications.priority_violation`
   - `activity_log.view_all`
   - `hazard_notifications.manage`
   - `admin.database`
   - `consumables.manage`
8. Zentrale Registry in `src/hooks/usePermissions.ts` um o. g. Keys erweitert – damit erscheinen sie in der Rollen-Berechtigungsmatrix (`/admin/rollen`) und können dort den Custom-Rollen zugewiesen werden.

## 4. Rollen-Berechtigungs-Matrix (Soll-Zustand)

**Legende:** ● erlaubt · ○ nicht erlaubt

| Permission | Administrator (master) | Auftraggeber | Messdienstleister (durchfuehrer) |
|---|---|---|---|
| samples.* (create/view/edit) | ● | ● | view+create |
| measurements.enter | ● | ○ | ● |
| measurements.view | ● | ● | ● |
| orders.create/view | ● | ● | view |
| orders.edit | ● | own | ○ |
| orders.delete | ● | ○ | ○ |
| projects.create/view/edit/assign | ● | ● | view |
| raw_materials.manage | ● | ● | optional |
| consumables.manage | ● | optional | ○ |
| priorities.edit | ● | ○ | ○ |
| locations.edit | ● | ● | optional |
| reports.create | ● | ● | ● |
| sds.manage | ● | ○ | ○ |
| workstations.manage | ● | ○ | ○ |
| services.manage | ● | ○ | ○ |
| users.manage | ● | ○ | ○ |
| admin.system | ● | ○ | ○ |
| admin.database | ● | ○ | ○ |
| absences.manage_all | ● | ○ | ○ |
| costs.manage / view_personnel / *_hourly_rates | ● | ○ | ○ |
| calendar.view_others_vacation | ● | optional | optional |
| hazard_notifications.manage | ● | ○ | ○ |
| activity_log.view_all | ● | ○ | ○ |
| notifications.measurement_completed | ● | ● | ● |
| notifications.priority_violation | ● | ○ | ○ |

Sichtbare Menüpunkte folgen direkt aus den `nav.*` Keys – siehe `NAV_TREE` in `src/hooks/usePermissions.ts` und Gating in `src/components/AppSidebar.tsx`.

## 5. Sicherheitsanforderungen – Status

| Anforderung | Status |
|---|---|
| Server-seitige Prüfung jeder geschützten Aktion | ✅ Über RLS + SECURITY-DEFINER-RPCs |
| Direkte URL-Aufrufe umgehen Berechtigungen nicht | ✅ Daten werden via RLS gefiltert; UI ohne Daten ist kein Sicherheitsrisiko |
| API-Aufrufe erzwingen dieselben Regeln wie die UI | ✅ Alle Schreibzugriffe gehen über RLS oder geprüfte RPCs |
| Rechteeskalation durch manipulierte Requests verhindert | ✅ `user_roles`-Tabelle separat, Rolle wird DB-seitig validiert |

## 6. Empfehlungen (Backlog)

1. **Phase 2 RLS-Härtung**: `consumables` Mutationen von `auftraggeber` auf `has_permission('consumables.manage')` umstellen, nachdem alle aktiven Auftraggeber-Custom-Roles mit dem neuen Key versorgt sind.
2. **SECURITY-DEFINER-Funktionen**: `REVOKE EXECUTE … FROM anon` auf allen 97 Funktionen ausführen (eigene Migration). Reduziert Linter-Findings auf 0.
3. **Edge Function Audit-Log**: `admin-users` und `db-integrity-check` zusätzlich JSON-loggen, wer welche Aktion ausgeführt hat.
4. **Route-Guards** (vom User aktuell nicht gewünscht): Falls später erwünscht, `<ProtectedRoute requiredPermission="…">` in `App.tsx`.
5. **CI-Audit** (siehe Abschnitt 7): bei jedem Commit ausführen und im Pull-Request blockierend machen.

## 7. Automatisiertes Permission-Audit (CI)

Skript: `scripts/audit-permissions.ts`
Aufruf: `bun run scripts/audit-permissions.ts` (oder via `npm run audit:permissions`).

Was es prüft:
- Alle in `src/pages/**` und `src/hooks/**` referenzierten Permission-Keys existieren in `ALL_PERMISSIONS`.
- Alle in `src/components/AppSidebar.tsx` referenzierten `nav.*` Keys existieren in `NAV_PERMISSIONS`.
- Jede Datei in `src/pages/Admin*.tsx` enthält entweder `usePermissions`, `useAuth().role` oder einen Verweis auf `admin.system` (Hinweis – kein Hard-Fail).
- Jeder `permission_key`-String in `supabase/migrations/**.sql` existiert in `ALL_PERMISSIONS`.

Exit-Code ≠ 0 ⇒ Build fehlschlagen lassen. Damit können neue Seiten oder Migrationen mit unbekannten Permission-Keys nicht mehr unbemerkt deployt werden.
