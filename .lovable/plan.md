# Domain-API-Architektur

## Ziel

Aktuell rufen Hooks/Pages/Components die zentrale Facade direkt auf (`api.from("projects").select(...)`). Das soll durch echte Domain-Funktionen ersetzt werden:

```
Hooks / Pages / Components
   ↓
api.projects.list() / api.samples.get(id) / api.measurementResults.create(data) ...
   ↓
src/lib/api/<domain>.ts   ← einzige Schicht, die noch Supabase kennt
   ↓
Backend (heute Supabase, später z. B. Node/PostgreSQL)
```

Die bestehende `api`-Facade (`api.from`, `api.rpc`, `api.auth`, `api.storage`, `api.functions`, `api.channel`) bleibt **intern** in `src/lib/api/*` weiterhin nutzbar, ist aber außerhalb tabu — durchgesetzt per ESLint.

## Wichtige Realität (bitte vorab lesen)

Die Beispiel-Signaturen `list / get / create / update / delete` reichen für die meisten Tabellen, aber der Code enthält viele **spezialisierte Queries** (komplexe Joins, gefilterte Listen, Sortierungen, RPCs, Realtime-Channels, Storage-Uploads). Beispiele:

- `useMyMeasurements`: zwei separate Queries (assigned_to + workstation responsible), Merge, Sortierung, Creator-Profile-Lookup
- `useProjectDetail`: `projects` + `measurement_orders` + `order_measurements` + `samples` + Profile in einem Aufruf
- `useEstimatedCompletion`: RPC-Call
- `OrderDetailPage`: Realtime-Subscription auf `order_measurements`
- `MeasurementDocuments`: `api.storage.from("...").upload(...)` + signed URLs

Diese Logik wird **nicht in ein generisches `list()` gepresst**. Stattdessen exportiert jedes Domain-Modul genau die Funktionen, die der Aufrufer braucht — z. B. `api.measurements.listMine(userId)`, `api.projects.getDetail(id)`, `api.measurements.estimateCompletion(...)`, `api.documents.uploadMeasurementDocument(...)`, `api.realtime.onMeasurementsForOrder(orderId, cb)`. Das ist der eigentliche Wert: nach dem Refactor kann jede dieser Funktionen 1:1 gegen ein Node/PostgreSQL-Backend ausgetauscht werden, ohne dass der Aufrufer es merkt.

## Domain-Module (in `src/lib/api/`)

| Modul | Inhalt |
|---|---|
| `projects.ts` | list, get, getDetail (mit Orders/Measurements), create, update, delete, listMembers, addMember, removeMember, updateMember |
| `projectMilestones.ts` | list, create, update, delete |
| `projectWorkPackages.ts` | list, create, update, delete, listAssignees, addAssignee, removeAssignee |
| `projectTimeEntries.ts` | list, create, update, delete |
| `projectMaterials.ts` | listConsumables, addConsumable, listKnetung, addKnetung, delete… |
| `orders.ts` | list, get (mit Joins), create, update, delete, audit log |
| `measurements.ts` | listMine, listForOrder, create, updateStatus, updateRanking, assign, addWorkLog, estimateCompletion (RPC) |
| `measurementResults.ts` | list, create, update, delete |
| `measurementServices.ts` | list, listAll, create, update, listParameters, upsertParameter, listPermissions, grant, revoke |
| `samples.ts` | list, get, create, update, listDocuments, addDocument, listHistory, addHistory |
| `consumables.ts` | list, create, update, delete |
| `rawMaterials.ts` | list, get, create, update, batches, analyses, documents, movements |
| `templates.ts` | list, get, create, update, delete, listItems, upsertItems |
| `workstations.ts` | list, get, create, update, delete |
| `workSchedules.ts` | listForUser, upsert, delete |
| `absences.ts` | list, create, update, delete |
| `downtimes.ts` | list, create, update, delete |
| `utilization.ts` | listMeasurementsForUtilization, listWorkLogs |
| `users.ts` | list, listProfiles, getProfile, updateProfile, invokeAdmin (Edge Function) |
| `roles.ts` | listCustomRoles, listUserRoles, listRolePermissions, assign, revoke |
| `permissions.ts` | list, hasPermission, navVisibility |
| `activityLog.ts` | list, listForProject, listForOrder |
| `syncSettings.ts` | get, upsert |
| `documents.ts` + `storage.ts` | listMeasurementDocuments, uploadMeasurementDocument, getSignedUrl, delete |
| `realtime.ts` | `onMeasurementsForOrder(orderId, cb)`, `onOrderChanges(orderId, cb)` etc. — gibt unsubscribe-Funktion zurück |
| `auth.ts` (optional) | signIn, signUp, signOut, onAuthStateChange — falls AuthContext umgestellt wird |

`src/lib/api/index.ts` re-exportiert alles als `api.projects`, `api.samples`, …  
Die bestehende Low-Level-Facade (`api.from`, `api.rpc`, `api.storage`, `api.functions`, `api.channel`, `api.auth`) bleibt verfügbar, wird aber **nur noch innerhalb von `src/lib/api/`** genutzt.

## Umsetzung in Wellen (jede Welle einzeln getestet)

1. **Welle 1 — Foundation**: `projects`, `samples`, `consumables`, `measurementResults`, `projectMilestones`, `projectTimeEntries`, `projectMaterials` (kleine, klar abgegrenzte Hooks).
2. **Welle 2 — Kern**: `orders`, `measurements`, `measurementServices`, `templates`, `rawMaterials`, `workstations`.
3. **Welle 3 — Admin & Querschnitt**: `users`, `roles`, `permissions`, `workSchedules`, `absences`, `downtimes`, `activityLog`, `syncSettings`, `utilization`.
4. **Welle 4 — Pages & Components**: alle direkten Aufrufe in `src/pages/*` und `src/components/*` ersetzen (CreateOrderPage, OrderDetailPage, ProjectDetailPage, MeasurementDocuments, BulkSamplePage, ImportOrderPage, AdminServicesPage, AdminDatabasePage, SamplesPage, SampleDetailPage, WorkPlanPage, RawMaterialDetailPage, DynamicParameterForm, MeasurementDataEntry, ServiceStatistics).
5. **Welle 5 — Storage, Realtime, Edge Functions**: `documents.ts`, `storage.ts`, `realtime.ts`. Hier wird die API bewusst minimal und backend-agnostisch gehalten (Realtime → Callback-API; Storage → `uploadFile`/`getSignedUrl`).
6. **Welle 6 — ESLint-Lockdown**: `no-restricted-imports`/`no-restricted-syntax` verbietet außerhalb `src/lib/api/**` jede Nutzung von `api.from`, `api.rpc`, `api.storage`, `api.functions`, `api.channel`. `AuthContext` ggf. via `api.auth`-Wrapper umstellen oder explizit whitelisten.

Pro Welle: betroffene Files lesen → Domain-Funktionen schreiben → Aufrufer umstellen → Typecheck.

## Was sich am Verhalten **nicht** ändert

- Keine UI-Änderungen.
- Keine Query-Logik-Änderungen (Sortierung, Filter, Joins bleiben 1:1).
- React Query Keys / Invalidation bleiben in den Hooks.
- Supabase bleibt das Backend; nur die Aufrufstelle wandert.

## Was sich ändert

- ~30 neue Module unter `src/lib/api/`.
- Jeder Hook/Component-Aufruf wird zu einer Funktion umgebogen.
- ESLint-Regel verschärft: `api.from` etc. außerhalb `src/lib/api/**` verboten.
- README in `src/lib/api/` aktualisiert.

## Aufwand & Risiko

Großer mechanischer Refactor. Es gibt ~30 Hooks, ~12 Pages und ~6 Components mit Supabase-Aufrufen, viele davon mehrfach. Ich gehe wellenweise vor und committe nach jeder Welle einen typ-checkbaren Zwischenstand, damit Probleme früh sichtbar werden. Realtime und Storage sind die heikelsten Punkte (API-Design backend-agnostisch halten), Rest ist Fleißarbeit.

## Frage vor Start

Soll ich **direkt mit Welle 1 starten** und mich danach durch die Wellen arbeiten (jede Welle ein klarer Commit), oder möchtest du erst eine kleinere **Pilot-Welle** sehen (nur `projects` + `consumables` + `measurementResults`), um das API-Design zu beurteilen, bevor die restlichen 25+ Module folgen?
