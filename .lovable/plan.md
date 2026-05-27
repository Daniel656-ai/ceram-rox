# Zentraler Repository-Layer über Supabase

## Ziel
Alle direkten `supabase.from(...)`, `supabase.rpc(...)`, `supabase.storage(...)` und `supabase.functions.invoke(...)` Aufrufe aus Hooks, Components und Pages werden in eine zentrale API-Schicht unter `src/lib/api/` verschoben. Components und Hooks importieren ausschließlich aus dieser Schicht.

## Architektur

```text
src/lib/api/
  index.ts              // Re-Export: export const api = { orders, samples, projects, ... }
  client.ts             // Re-Export von supabase Client (einzige Stelle die ihn kennt)
  orders.ts             // listOrders, getOrder, createOrder, updateOrder, deleteOrder ...
  measurements.ts
  samples.ts
  projects.ts
  projectMembers.ts
  projectMaterials.ts
  projectMilestones.ts
  projectTimeEntries.ts
  projectWorkPackages.ts
  consumables.ts
  rawMaterials.ts
  measurementResults.ts
  measurementParameters.ts
  measurementServices.ts
  templates.ts
  users.ts
  profiles.ts
  roles.ts              // user_roles, custom_roles, role_permissions
  permissions.ts        // mdl_service_permissions, audit log
  workstations.ts
  workSchedules.ts
  absences.ts
  downtimes.ts
  activityLog.ts
  notifications.ts
  syncSettings.ts
  documents.ts          // sample_documents, raw_material_documents, measurement docs
  storage.ts            // Upload/Download/Signed URLs
  edgeFunctions.ts      // admin-users, db-integrity-check, absence-ics-feed
  realtime.ts           // Channels für Live-Updates
```

Jedes Modul exportiert reine Funktionen, die ein Promise zurückgeben. Hooks (React Query) rufen nur diese Funktionen auf — sie kennen Supabase nicht mehr.

## Vorgehen (iterativ)

1. **Grundgerüst** anlegen: `src/lib/api/client.ts`, `index.ts`, README-Kommentar mit Konventionen.
2. **Hooks-Migration in Wellen** (jede Welle = ein Commit-fähiger Stand):
   - Welle A: Orders, Measurements, Samples, Projects
   - Welle B: Project-Sub-Ressourcen (Members, Milestones, Materials, Time Entries, Work Packages)
   - Welle C: Stammdaten (Services, Templates, Workstations, Raw Materials, Consumables, Schedules)
   - Welle D: Users, Profiles, Roles, Permissions, Notifications, Activity Log, Sync Settings
   - Welle E: Storage, Documents, Edge Functions, Realtime-Channels
3. **Components/Pages** die noch direkt `supabase` importieren auf die API umstellen (z. B. `AuthContext`, `OrderDetailPage`, `MeasurementDocuments`, `SampleScanner` usw.).
4. **Lint-Guard**: ESLint-Regel `no-restricted-imports`, die `@/integrations/supabase/client` außerhalb von `src/lib/api/**` und `src/contexts/AuthContext.tsx` verbietet (Auth bleibt Sonderfall, da `onAuthStateChange` zwingend Client-Objekt braucht — alternativ via `api.auth` exposen).
5. **README** in `src/lib/api/README.md` mit Konvention: "Niemals supabase direkt importieren, immer `import { api } from '@/lib/api'`".

## Hinweise zur Realität

- **`VITE_API_URL` als einziger Schalter** ist nicht möglich, solange Supabase-Protokoll genutzt wird. Die `.env` enthält weiterhin `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`. Diese werden in `src/integrations/supabase/client.ts` (auto-generiert) verwendet. Ein Wechsel auf "irgendein Backend" erfordert später, die Funktionen in `src/lib/api/*` neu zu implementieren — der Aufrufcode (Hooks/Components) bleibt aber unverändert. Das ist genau der Mehrwert dieser Schicht.
- **Auth (`onAuthStateChange`)**: Wird über `api.auth.onAuthStateChange(...)` exportiert, damit `AuthContext` ebenfalls keinen direkten Supabase-Import braucht.
- **Realtime**: Channels werden als Factory `api.realtime.channel(name)` bereitgestellt; Subscribe-Callbacks bleiben in den Hooks.
- **Auto-generierte Typen** aus `src/integrations/supabase/types.ts` werden in den API-Modulen wiederverwendet — keine Duplikation.

## Umfang

~30+ Hooks, ~15 Pages/Components mit direkten Supabase-Imports, plus neuer API-Layer. Erste PR ist groß, danach sind weitere Änderungen klein und lokal.

## Bestätigung

Bitte bestätigen, dass:
1. Du mit der oben genannten Realität bzgl. `VITE_API_URL` einverstanden bist (Supabase-Client bleibt, Wechsel-Punkt ist die API-Schicht, nicht eine Env-Variable).
2. Der große Refactor jetzt durchgezogen werden soll, oder ob ich in einzelnen PRs Welle für Welle vorgehen soll.