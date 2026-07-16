# Rollenbasierte Formularansichten im Workflow Designer

## Ziel
Formulare erhalten wieder **rollenspezifische Ansichten** (Auftraggeber, Messdienstleister, Labor, Administrator) mit eigenen Layouts und Feldberechtigungen (sichtbar / lesbar / bearbeitbar / pflicht). Ein Workflow-Schritt legt fest, welche Rolle welche Ansicht dieses Formulars sieht und welche Felder er sperrt.

Alle Rollen arbeiten weiterhin auf **derselben Formularinstanz** (`shared_form_data` am Auftrag) – gefiltert wird nur die Darstellung.

## Bausteine

### 1. Datenmodell (Migration)
- Neue Tabelle `form_role_views` (`id`, `form_definition_id`, `role_key`, `label`, `layout jsonb`, timestamps, unique (form_definition_id, role_key)). Ersetzt/ergänzt das alte `service_form_layouts`-Konzept auf Basis der neuen `form_definitions`.
- Neue Tabelle `form_field_permissions` (`id`, `form_definition_id`, `role_key`, `field_id`, `visibility` ∈ {hidden, read, write}, `required boolean`, unique (form_definition_id, role_key, field_id)).
- `process_steps`: neue Spalte `role_view_key text` (welche Ansicht der Schritt öffnet) und `locked_field_ids jsonb default '[]'` (nach Abschluss gesperrte Felder).
- Rolle = frei wählbarer Text-Key (`auftraggeber`, `messdienstleister`, `labor`, `admin`, plus custom). Presets in Frontend-Konstante.
- GRANTs + RLS: lesbar für `authenticated`, mutierbar für Master (analog `form_definitions`).

### 2. API-Layer (`src/lib/api/`)
- `formRoleViews.ts`: list/get/upsert/remove pro Formular; `getEffectiveLayout(formId, roleKey)` mit Fallback auf Default-Layout aus `form_definitions.layout`.
- `formFieldPermissions.ts`: list pro Formular; bulk-upsert (Matrix-Speicherung); `getEffectivePermissions(formId, roleKey, fieldIds)` → normalisierte Map.
- `processSteps.ts`: `role_view_key`, `locked_field_ids` in Interface + Update.

### 3. Designer-UI
- In `AdminServiceDesignerPage` beim ausgewählten Formular neuer Tab **„Rollenansichten"** neben *Felder / Formular-Designer / Vorschau*.
- Komponente `RoleViewsDesigner.tsx`:
  - Linke Spalte: Liste der Rollen (Add/Remove/Rename), Aktive Ansicht.
  - Rechte Spalte: eingebetteter `FormLayoutDesigner` – pro Rolle eigenes Layout (fällt beim Anlegen auf Kopie des Default zurück).
  - Zweite Registerkarte innerhalb: **Feldberechtigungsmatrix** (Tabelle Felder × Rollen: Sichtbarkeit Radio + Pflicht-Checkbox).
- `WorkflowStepsDesigner.tsx`: pro Schritt zusätzliches Feld „Formularansicht (Rolle)" + Multi-Select „Felder nach Abschluss sperren" (Optionen aus `form_fields` des gewählten Formulars).

### 4. Runtime
- `FormLayoutRenderer` erhält Prop `permissions: Map<field_id, { visibility, required, locked }>` und rendert Felder entsprechend (hidden, disabled, required-Marker).
- `ProcessRuntimePanel` / `WorkflowRuntimePanel`:
  - Ermittelt aktive Rolle des Users (via `useAuth`).
  - Lädt `role_view_key` vom Schritt → Layout via `formRoleViews.getEffectiveLayout`.
  - Merged `form_field_permissions` + `locked_field_ids` bereits abgeschlossener Schritte.
  - Speichert weiter in `shared_form_data` (unverändert – nur Darstellung ist rollenspezifisch).
- Client-seitige Validierung erzwingt `required` je Rolle vor Complete; Server-Trigger bleibt für `locked_field_ids` verantwortlich (Update dieser Felder nach Abschluss blockieren).

### 5. Migration Altbestand
- Bestehende Einträge in `service_form_layouts` (customer/employee) werden per Migration in `form_role_views` überführt, sofern die Formulare bereits als `form_definitions` existieren (Best-Effort, sonst leer lassen). Kein Datenverlust – Alt-Tabelle bleibt bis manuelle Bestätigung erhalten.

## Nicht enthalten
- Kein neues UI für Runtime-Umschalter zwischen Rollen (Rolle des angemeldeten Users bestimmt Ansicht; Admin sieht Admin-Ansicht bzw. Fallback).
- Keine Änderungen an Prozess-Runtime-Logik außer Darstellung/Permissions.

## Technische Notizen
- Rollen-Key-Format: `snake_case`, max 40 Zeichen, System-Presets nicht löschbar.
- Fallback-Kaskade Layout: `form_role_views(role_key)` → `form_role_views('default')` → `form_definitions.layout`.
- Fallback-Kaskade Permissions: explizit gesetzt → sonst `write`, nicht required.

Nach Freigabe implementiere ich Migration, API-Module, Designer-Tab, Runtime-Anpassungen in dieser Reihenfolge.
