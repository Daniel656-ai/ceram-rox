
## Ziel
Pilot-Plant-Aufträge werden nicht mehr aus einzelnen Dienstleistungsformularen zusammengesetzt, sondern durchlaufen einen fest verdrahteten 9-stufigen Prozess-Workflow. Alle Bausteine schreiben in **einen** Auftrag. Nach der Probenentnahme werden automatisch Laborproben + Labor-Aufträge erzeugt.

## 1. Datenmodell (Migration)

**Enum `pilot_plant_block_key`**
`stammdaten, rezeptur, knetung, extrusion, trocknung, brennen, probenentnahme, uebergabe, abschluss`

**`measurement_orders` erweitern**
- `is_pilot_plant_process boolean not null default false`
- (bestehendes `shared_form_data jsonb` wird als gemeinsamer Auftragsdatensatz wiederverwendet)

**Neue Tabelle `pilot_plant_blocks`**
Spalten: `id, order_id, block_key, order_index, status (pending|in_progress|completed|skipped), assigned_role, assigned_to, data jsonb, started_at, completed_at, completed_by, notes`.
Ein Eintrag je Baustein je Auftrag (unique auf `order_id + block_key`).

**Neue Tabelle `pilot_plant_produced_samples`**
`id, order_id, block_id, label, quantity, marking, notes, created_sample_id (fk samples)`.
Wird im Probenentnahme-Baustein befüllt und beim Abschluss materialisiert.

**Trigger / Funktionen**
- `trg_pp_block_after_complete`:
  1. Merge `data` in `measurement_orders.shared_form_data` unter Key `pp.<block_key>`.
  2. `project_time_entries` aus `started_at → completed_at` (auf 15 Min gerundet) für `completed_by` anlegen.
  3. Nächsten Block auf `pending` setzen und Benachrichtigung an `assigned_to` bzw. Rolle senden.
  4. Bei `block_key = probenentnahme`: für jede Zeile in `pilot_plant_produced_samples` einen `samples`-Datensatz erzeugen (Projekt, Versuchsnr., Rezeptur, PP-Daten aus shared_form_data) und **je Probe** eine `measurement_orders` mit den in Stammdaten gewählten Labor-Dienstleistungen anlegen. Verknüpfung über neue Spalte `samples.pilot_plant_order_id`.
  5. Bei `block_key = abschluss`: Auftrag auf `completed` setzen (nutzt bestehende Auto-Close-Logik).
- RPC `pp_start_block(_block_id)` / `pp_complete_block(_block_id, _data)` inkl. Berechtigungscheck (assigned_to = auth.uid() ODER Rolle passt).

**RLS**
- Lesen: alle mit Zugriff auf den Auftrag.
- Schreiben (Block): nur `assigned_to = auth.uid()` oder passende Rolle; Auftraggeber darf Stammdaten und Zuweisungen bearbeiten.
- `produced_samples`: Schreibrecht nur Bearbeiter des Probenentnahme-Blocks.

## 2. API (`src/lib/api/pilotPlantProcess.ts`)
- `blocks.listForOrder`, `blocks.get`, `blocks.assign`, `blocks.start`, `blocks.saveDraft`, `blocks.complete`
- `producedSamples.list/upsert/remove`
- `orders.createPilotPlantProcess({ project_id, versuchsnummer, versuchsart, previous_experiments, requested_samples, requested_lab_service_ids, date })` — legt Auftrag mit `is_pilot_plant_process=true` an und seedet alle 9 Blocks.

## 3. UI

**`CreateOrderPage.tsx`**
- Wenn Kategorie „Pilot Plant" gewählt → neuer, deutlich schlankerer Modus. Statt der bisherigen Pilot-Plant-Felder nur noch die Stammdaten:
  Projekt, Versuchsnummer, Auftraggeber (auto), Datum, Frühere Versuche, Versuchsart, gewünschte Proben (Freitext-Liste), gewünschte Labor-Dienstleistungen (Multi-Select aus Katalog).
- Optional: pro Baustein Bearbeiter festlegen (aufklappbarer Bereich „Zuweisungen"). Leer = Rolle.
- Bestehende Mixture-Rezeptur-Auswahl bleibt für den Rezeptur-Baustein zugänglich, aber nicht mehr auf der Order-Erstellung.

**Neue Komponente `src/components/pilotplant/PilotPlantProcessPanel.tsx`**
- Vertikaler Stepper der 9 Bausteine mit Status-Badges.
- Jeder Block: Briefing-Karte (aggregierte `shared_form_data` aus Vorgänger-Blocks read-only) + baustein-spezifisches Formular (fest verdrahtete Felder laut Spezifikation).
- Bedienelemente: „Bearbeitung starten" → `pp_start_block`, „Speichern (Entwurf)", „Abschließen" → `pp_complete_block`.
- Probenentnahme-Block: Repeater für erzeugte Proben (Bezeichnung, Anzahl, Kennzeichnung, Bemerkung).
- Sperre bei `measurement_orders.locked_at`.

**`OrderWorkflowTabs.tsx`**
- Wenn `is_pilot_plant_process` → nur die Tabs „Übersicht", „Pilot-Plant-Prozess" (neu, ersetzt Workflow-Tab), „Dokumente", „Bericht", „Abschluss". Labor-Tabs erscheinen an den automatisch erzeugten Sample-Aufträgen.

**`OrdersPage.tsx` / „Meine Aufgaben"**
- Zusätzlich zu Workflow-Tasks werden offene Pilot-Plant-Blöcke gelistet (assigned_to = ich ODER Rolle passt und nicht zugewiesen). Klick öffnet den Auftrag mit direktem Sprung auf den Block.

## 4. Bausteinfelder (fest verdrahtet)
```
stammdaten:     nur Anzeige (aus Auftragserstellung)
rezeptur:       recipe_version_id (aus mixtures), rohstoff_hinweise
knetung:        knetzeit_min, wasserzugabe_l, drehzahl_rpm, bediener, bemerkung
extrusion:      mundstueck, extruder, druck_bar, drehzahl_rpm, bemerkung
trocknung:      temperatur_c, dauer_h, bediener, bemerkung
brennen:        brennkurve, ofen, temperatur_c, haltezeit_min, bemerkung
probenentnahme: produced_samples[], gesamt_anzahl, bemerkung
uebergabe:      auto (zeigt erzeugte Proben + Labor-Order-Links), Bestätigung
abschluss:      qualitative Bewertung, freigabe boolean
```

## 5. Nicht-Ziele
- Kein digitaler Laufzettel-Nachbau (PDF-Generierung kann später aus `shared_form_data` erfolgen).
- Kein Umbau bestehender Labor-Aufträge.
- Bestehende `order_analysis_requests`-Struktur bleibt vorerst unangetastet, wird aber im Pilot-Plant-Prozess-Modus nicht mehr befüllt.

## 6. Ausführungsreihenfolge
1. Migration (Enum, Tabellen, Trigger, RLS, RPCs)
2. API-Modul
3. `CreateOrderPage` Pilot-Plant-Modus umstellen
4. `PilotPlantProcessPanel` + Integration in `OrderWorkflowTabs`
5. „Meine Aufgaben" um PP-Blöcke erweitern
6. Manuelle Verifikation: Auftrag erstellen → alle 9 Blöcke durchlaufen → prüfen, dass Samples + Labor-Orders korrekt entstehen.
