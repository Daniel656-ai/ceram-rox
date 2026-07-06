## Ziel

Ein wiederverwendbarer Upload-Feldtyp für den Service Designer. Konfigurierbar pro Feld (Label, Hilfetext, Pflicht, Mehrfach, Dateitypen, Größe, Anzahl). Rendering im Auftragsformular mit Drag&Drop, Vorschau, Löschen/Ersetzen. Generische Vorlagen-Bibliothek pro Upload-Feld (z. B. Brennkurven, Prüfprotokolle). Speicherung mit dem Auftrag.

## Umfang

### 1. Backend (Migration + Bucket)

**Storage-Bucket** `order-uploads` (privat) via `storage_create_bucket`.

**Tabellen (public):**

- `service_field_templates` — Vorlagen-Bibliothek pro Upload-Feld
  - `service_data_field_id` (FK service_data_fields, ON DELETE CASCADE)
  - `name`, `description`
  - `storage_path` (Bucket `order-uploads`, Präfix `templates/<field_id>/…`)
  - `file_name`, `file_type`, `file_size_bytes`
  - `sort_order`, `is_active`
  - Standard-Timestamps

- `order_upload_files` — hochgeladene Auftragsdateien
  - `measurement_id` (FK order_measurements, ON DELETE CASCADE)
  - `field_key` (Feldschlüssel aus service_data_fields)
  - `entry_index` (nullable, für Repeater-Sections)
  - `template_id` (FK service_field_templates, nullable — falls Vorlage gewählt)
  - `storage_path` (Bucket `order-uploads`, Präfix `orders/<measurement_id>/…`)
  - `file_name`, `file_type`, `file_size_bytes`
  - `uploaded_by`, `created_at`

- RLS + GRANTs nach Projekt-Konvention (authenticated: CRUD; service_role: ALL). Templates: Lesen für authenticated, Schreiben nur Master (analog anderer Admin-Tabellen via `has_role`).

**Storage-Policies auf `storage.objects` für Bucket `order-uploads`:**
- Lesen: authenticated
- Schreiben/Löschen im Ordner `orders/…`: authenticated (auf eigene Aufträge via measurement-Join oder simpel authenticated + auf Applikationslogik)
- Schreiben/Löschen im Ordner `templates/…`: nur Master

### 2. Feldkonfiguration erweitern

`service_data_fields` besitzt bereits `field_type = 'file' | 'image'` und `validation jsonb`. Wir nutzen `validation` als Container für Upload-Config:

```json
{
  "upload": {
    "multiple": false,
    "max_files": 1,
    "max_size_mb": 20,
    "accepted_types": ["image/*", "application/pdf"],
    "templates_enabled": false
  }
}
```

Keine Schema-Änderung nötig, nur TypeScript-Typen in `serviceDesigner.ts`.

### 3. Frontend — Service Designer

**FormDesigner / Feld-Konfigurationspanel** (in `FormDesigner.tsx` bzw. dem Field-Editor, der `service_data_fields` bearbeitet):
- Bei `field_type` ∈ {`file`, `image`} zusätzliches Panel „Upload-Einstellungen": Mehrfach, max. Anzahl, max. Größe (MB), zulässige Dateitypen (Multiselect: JPG, PNG, PDF, XLSX, DOCX, …), Vorlagen-Bibliothek aktivieren.
- Bei aktivierten Vorlagen: Unter-Sektion „Vorlagen verwalten" (Liste + Upload-Button + Löschen + Reihenfolge + aktiv-Toggle). CRUD über neue API `serviceFieldTemplates`.

### 4. Frontend — Auftragsformular

Neue Komponente `src/components/upload/UploadField.tsx`:
- Drag&Drop-Zone + Datei-Picker
- Client-seitige Validierung gegen `upload`-Config
- Vorschau: Bilder als Thumbnail, PDF/andere als Icon + Dateiname + Größe
- Datei entfernen / ersetzen
- Optional Vorlagen-Auswahl (Select) wenn `templates_enabled`

Integration in `ServiceBookingForm.tsx` — neuer Case in `renderInput` für `file`/`image`. Werte werden im Form-State als Liste von Uploads (mit `storage_path`, `file_name`, `template_id?`) gehalten. Bei Absenden des Auftrags werden Dateien in `order-uploads` unter `orders/<measurement_id>/<field_key>/…` verschoben (temporär → final) und `order_upload_files`-Rows angelegt.

Alternative Vereinfachung (empfohlen für MVP): Upload passiert erst nach Auftragserstellung, sobald `measurementId` bekannt ist. Bei Neuanlage: Dateien im Browser-Memory halten, nach `createOrder` sequenziell hochladen.

### 5. Auftragsansicht (Bearbeiter)

- Neue Sektion „Hochgeladene Dateien" in `OrderDetailPage.tsx` (oder in bestehender Dokumenten-Liste anzeigen): Liste aller `order_upload_files`, gruppiert nach Feld. Vorschau via bestehendem `DocumentPreviewDialog` (unterstützt bereits PDF/Bilder). Download.

### 6. API-Layer

Neue Dateien in `src/lib/api/`:
- `serviceFieldTemplates.ts` — list/create/update/delete + signedUrl
- `orderUploads.ts` — upload/list/delete + signedUrl (Bucket `order-uploads`)

Export in `src/lib/api/index.ts`.

### 7. i18n

DE/EN-Strings für Designer-Panel, Upload-Zone, Vorlagen, Fehlermeldungen (in `orders.json` und neuem Namespace `upload.json` oder in `common.json`).

## Nicht enthalten

- Bildannotation (Markieren von Bereichen auf Bildern) — als Folge-Feature.
- Migration bestehender „Brennkurven"-Uploads (falls vorhanden) — separat.

## Technische Details

**Reihenfolge der Migrations:**
1. `storage_create_bucket("order-uploads", public=false)`
2. Migration: Tabellen + GRANTs + RLS + Policies + Storage-Policies.

**Storage-Pfade:**
- Vorlagen: `templates/<service_data_field_id>/<timestamp>_<name>`
- Auftrag: `orders/<measurement_id>/<field_key>/<timestamp>_<name>`

**Validierung** (client + server-lite):
- Client: react-dropzone-artig eigenes Handling mit `<input type=file>` + drag events (keine neue Dep nötig).
- Server: RLS + Storage-Policies verhindern fremden Zugriff; Größenlimit via Bucket-Config (falls unterstützt) oder Client-only.

**Typerweiterung** `ServiceDataField.validation`:
```ts
export interface UploadValidation {
  multiple?: boolean;
  max_files?: number;
  max_size_mb?: number;
  accepted_types?: string[];
  templates_enabled?: boolean;
}
```

## Reihenfolge der Umsetzung

1. Bucket erstellen.
2. Migration (Tabellen, RLS, GRANTs, Storage-Policies).
3. API-Layer (`serviceFieldTemplates`, `orderUploads`).
4. `UploadField`-Komponente + Integration in `ServiceBookingForm`.
5. Designer-Erweiterung (Upload-Config-Panel + Vorlagen-Verwaltung).
6. Anzeige in `OrderDetailPage` (Preview + Download).
7. i18n-Strings.
