

## Messauftraege pro Arbeitsplatz anzeigen

### Problem
Die Arbeitsplaetze-Seite zeigt nur manuell erstellte Aufgaben (`workstation_tasks`). Messungen aus Messauftraegen (`order_measurements`), die ueber das Feld `workstation_id` einem Arbeitsplatz zugewiesen sind, werden nicht abgefragt und daher nicht angezeigt.

### Loesung
Einen neuen Abschnitt pro Arbeitsplatz hinzufuegen, der alle zugewiesenen Messauftrags-Messungen anzeigt.

### Aenderungen

**1. Neuer Hook in `src/hooks/useWorkstations.ts`**
- `useWorkstationMeasurements(workstationId)` -- laedt alle `order_measurements` mit `workstation_id` gleich dem gegebenen Arbeitsplatz
- Inkludiert per Join: Messdienstleistung (`measurement_services`), Auftrag (`measurement_orders` mit `projects`), und zugewiesener Benutzer (`profiles` ueber `assigned_to`)

**2. Neue Komponente in `src/pages/AdminWorkstationsPage.tsx`**
- `WorkstationMeasurementsList` -- zeigt eine Tabelle mit:
  - Messungsname (aus `measurement_services.service_name`)
  - Projekt (aus `measurement_orders.projects.project_number` / `project_name`)
  - Zugewiesen an (Name des Durchfuehrers)
  - Status (offen / in Bearbeitung / abgeschlossen)
  - Faelligkeitsdatum
- Statusfilter analog zu den bestehenden Aufgaben
- Wird im Accordion-Inhalt jedes Arbeitsplatzes oberhalb der bestehenden Aufgaben-Liste angezeigt

**3. Keine Datenbank-Aenderung noetig**
- Die Tabelle `order_measurements` hat bereits das Feld `workstation_id`
- Die bestehenden RLS-Policies erlauben Master-Benutzern den Lesezugriff

### Technische Details

```text
Accordion pro Arbeitsplatz:
+-- Beschreibung
+-- [NEU] Zugewiesene Messungen (order_measurements WHERE workstation_id = ...)
|     Tabelle: Messung | Projekt | Zugewiesen an | Faellig | Status
+-- Aufgaben (workstation_tasks) -- wie bisher
```

Hook-Query:
```typescript
supabase
  .from("order_measurements")
  .select(`*, measurement_services(service_name, category),
    measurement_orders(*, projects(project_number, project_name))`)
  .eq("workstation_id", workstationId)
  .order("due_date")
```

