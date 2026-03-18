

## Plan: SampleSelector-Dialog an SamplesPage-Dialog angleichen

### Problem
Der Dialog "Neue Probe erstellen" im `SampleSelector` (beim Anlegen eines Messauftrags) hat nur 3 Felder (Name, Projekt, Beschreibung), während der Dialog auf der Proben-Seite deutlich mehr Optionen bietet: Nachverwendung, Lagerung, Entsorgung, Lagerort, Gefahrstoffe und Tags.

### Lösungsansatz
Den `SampleSelector`-Dialog (`src/components/SampleSelector.tsx`) erweitern, sodass er dieselben Felder und Abschnitte wie der Dialog in `SamplesPage.tsx` (Zeilen 336-466) enthält:

1. **Erweiterten Form-State** hinzufügen (gleiche Struktur wie SamplesPage):
   - `post_measurement_action`, `post_measurement_action_text`
   - `storage_min_duration`, `storage_hints`, `storage_expiry_date`
   - `disposal_method`, `disposal_hints`, `disposal_category`
   - `hazard_categories`, `is_hazardous`, `location_id`, `tags`

2. **Fehlende Daten laden**: `useStorageLocations` importieren für Lagerort-Dropdown.

3. **Dialog-UI erweitern** mit denselben Abschnitten:
   - Name + Projekt (2-spaltig)
   - Beschreibung
   - Nachverwendung (aufbewahren/entsorgen/zurück/andere) mit konditionalen Unterfeldern
   - Lagerort-Auswahl
   - Gefahrstoff-Checkboxen
   - Tags mit Enter-Eingabe
   - `max-w-2xl max-h-[90vh] overflow-y-auto` für konsistente Dialoggröße

4. **handleCreate erweitern**: Alle neuen Felder an `createSample.mutateAsync` übergeben (wie in SamplesPage).

5. **i18n**: Translations aus dem `samples`-Namespace verwenden (bereits vorhanden).

### Betroffene Datei
- `src/components/SampleSelector.tsx` -- Dialog-Inhalt und Form-State erweitern

