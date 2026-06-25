## Ziel
Neuer Admin-Bereich, in dem GHS- (Gefahrgut) und PSA-Symbole hochgeladen, bearbeitet und gelöscht werden können – analog zur bestehenden Firmenlogo-Verwaltung. Hochgeladene Symbole stehen automatisch überall zur Auswahl, wo bisher die statischen Assets verwendet werden.

## Umfang

### 1. Datenbank
Neue Tabelle `custom_symbols`:
- `id`, `category` (`'ghs' | 'psa'`), `code` (slug, eindeutig pro Kategorie), `name`, `description`, `storage_path`, `public_url`, `mime_type`, `file_size`, `sort_order`, `is_active`, `created_at/by`, `updated_at`
- RLS: Lesen für `authenticated`, Schreiben nur mit Permission `admin.company_settings` (gleiche Berechtigung wie Logo) oder Rolle `master`
- GRANTs wie üblich

### 2. Storage
Bucket `company-assets` (bereits für Logo vorhanden) wird wiederverwendet, Unterordner `symbols/ghs/` und `symbols/psa/`. Falls Bucket fehlt, anlegen (öffentlich, da Symbole auch in Druckansichten/Etiketten geladen werden).

### 3. API-Layer
`src/lib/api/customSymbols.ts` mit `list`, `listByCategory`, `upload`, `update`, `remove`. Hook `useCustomSymbols(category?)`.

### 4. Admin-UI
Neue Seite `src/pages/AdminSymbolsPage.tsx` unter Route `/admin/symbole`:
- Zwei Tabs: „Gefahrgutzeichen (GHS)" und „PSA-Symbole"
- Thumbnail-Grid mit Name, Code, Beschreibung
- Upload-Dialog mit Drag&Drop (PNG/JPG/SVG, max. 2 MB), Validierung, Preview
- Edit-Dialog (Name, Beschreibung, Code, sort_order, aktiv/inaktiv)
- Delete-Bestätigung
- Eintrag in `AppSidebar` unter Admin

### 5. Integration in Auswahl-Komponenten
- `HazardClassSelector` / `GhsPictogram`: zusätzlich zu den fest gebündelten 9 GHS-Symbolen die Custom-GHS-Symbole anzeigen (Merge nach `code`, Custom überschreibt Standard wenn gleicher Code)
- PSA-Auswahl (in Hazard-Bereich): analog – Custom-PSA-Symbole erscheinen automatisch im Picker
- Label-Designer (`LabelDesigner`): Symbol-Picker zieht die Custom-Symbole mit ein, sodass Etiketten sie verwenden können

## Technische Details
- Wiederverwendung des Upload-Patterns aus `AdminCompanySettingsPage` / `companySettings.ts`
- Public URL über `supabase.storage.from('company-assets').getPublicUrl(path)`
- Eindeutigkeit: Unique-Index `(category, code)` – beim Upload Vorschlag aus Dateiname
- i18n-Strings in `de/admin.json` und `en/admin.json`
- Permission-Key `admin.symbols.manage` (oder Wiederverwendung `admin.company_settings` – Default: neuer Key, zur Rollen-Matrix hinzufügen)
- Responsive Grid (Tailwind `grid-cols-2 md:grid-cols-4 lg:grid-cols-6`)

## Out of Scope
- Keine Migration der bestehenden gebündelten SVGs in die DB – sie bleiben als Fallback erhalten
- Keine Bildbearbeitung im Browser (nur Upload as-is)

Soll ich so umsetzen?
