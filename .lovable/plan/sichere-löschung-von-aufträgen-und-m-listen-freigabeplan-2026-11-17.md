# Sichere Löschung von Aufträgen und m³-Listen – Freigabeplan

Laut Auftrag (Abschnitt 2) halte ich vor jeder Migration an. Beide Funktionen brauchen neue Serverfunktionen, eine reine Oberflächenänderung reicht nicht aus.

## Warum Serveränderungen nötig sind
- **Aufträge:** `cancel_or_delete_order` (0034/0035) lehnt alles ab, was nicht völlig unbearbeitet ist (Ergebnisse, Proben, Dokumente, Zeiten …). Die geforderte Löschung „trotz Verknüpfungen“ geht daher nur über eine neue Funktion. Die bestehende bleibt unverändert, weil der Auftraggeberweg sie weiter nutzt.
- **m³-Listen:** Auf `production_document_requests` darf derzeit jeder angemeldete Benutzer löschen (Policy `USING (true)`). Die Master-Prüfung gibt es nur in der Oberfläche. Das verlangt Abschnitt 8 ausdrücklich anders.

## Teil A – Aufträge (neue Web-Migration 0041)
1. `preview_force_delete_order(order_id)` (SECURITY DEFINER, nur lesend): liefert die tatsächlichen Zahlen je Verknüpfungsart (Proben, Positionen, Zuweisungen/Aufgaben, offizielle bzw. vorläufige Ergebnisse, Rohdaten, Korrekturen, Importe, Arbeitszeiten, Material, Dokumente/Uploads, Berichte, Projekt, Fertigungsfreigaben, Fertigungsunterlagen, Folgemessungen) und dazu einen Prüfschlüssel (Hash über die gezählten IDs).
2. `force_delete_order(order_id, expected_hash, reason)`: Advisory-Lock und `FOR UPDATE`. Berechtigt sind Master für jeden Auftrag sowie Auftraggeber nur für eigene Aufträge nach den bestehenden 0034-Regeln. Messdienstleister und externe Kunden dürfen das nicht. Interne Prüfmittelaufträge werden abgelehnt (dafür gibt es eigene Abbruch-RPCs). Ändert sich der Hash, bricht die Funktion ab und meldet „Verknüpfungen haben sich geändert“.
3. Verhalten je Art, alles in einer Transaktion:
   - **Proben:** Eigenständige Proben bleiben erhalten, nur `order_id` wird auf NULL gesetzt. m³-Beprobungsproben (Tag `m3_beprobung`) werden ebenfalls nur entkoppelt.
   - **Projekt (PM) und Fertigungsfreigaben:** bleiben erhalten. `production_releases.order_id` und `production_document_requests.order_id` werden auf NULL gesetzt.
   - **Positionen, Aufgaben, Workflow, Parameter:** werden gelöscht, damit nichts mehr in den Messdienstleister-Listen auftaucht.
   - **Ergebnisse, Korrekturen, Rohdaten:** Vor dem Löschen wird ein vollständiger JSON-Snapshot in `activity_log` (`order_force_deleted`) geschrieben. Siehe Frage 1.
   - **Dateien:** Die Funktion gibt nur Speicherpfade zurück, die von keinem anderen Datensatz referenziert werden. Die Oberfläche entfernt danach nur diese. Gemeinsam genutzte Dateien bleiben.
4. Oberfläche: Der bestehende Mülleimer (Liste und Detail) öffnet einen neuen Dialog mit Warnung, Verknüpfungsliste („Keine Verknüpfungen“, wenn leer) und den Buttons „Abbrechen“ / „Auftrag endgültig löschen“. Während der Ausführung ist der Button gesperrt. Danach werden die Auftrags-, Aufgaben- und Probenansichten neu geladen.

## Teil B – m³-Listen (gleiche Migration)
1. `preview_delete_m3_list(id)`: zeigt Fertigungsfreigabe/Revision, Fertigungsprojekt (Projektname/Kunde aus der Freigabe, nicht PM), Beprobungsauftrag, Proben und Formularinhalt an.
2. `delete_m3_list(id, expected_hash)`: nur Master. Löscht ausschließlich die Zeile der m³-Liste. Freigabe, Proben, Auftrag und PM-Projekt bleiben erhalten. Dazu kommt ein Audit-Eintrag mit Snapshot der Formularwerte.
3. Policy: DELETE auf `production_document_requests` nur für Master, SELECT/INSERT/UPDATE bleiben unverändert. Der bisherige Duplikat-Mülleimer verschwindet für Nicht-Master.
4. Oberfläche: Mülleimer für Master in der m³-Tabelle mit Dialog „m³-Liste endgültig löschen“.

## Firmen-DB / Tauri
Tauri nutzt dasselbe Frontend, entscheidend ist nur die Firmen-DB. Ich bereite ein separates Admin-SQL mit Vorabprüfung (Abbruch ohne Änderung, wenn Tabellen oder Spalten fehlen) vor und führe es nicht aus. Die v3-Prüffassung 0037+0040 bleibt unberührt. Die neue Funktion ist unabhängig davon und ändert `cancel_or_delete_order` nicht.

## Tests
SQL-Szenarien A1–A10 und B1–B7 in einer Transaktion mit Rollback auf der Web-DB, dazu Vitest für die Dialoglogik und eine Browserprüfung mit Testauftrag. Die Tauri-Abnahme bleibt beim Nutzer, nachdem das Firmen-SQL ausgeführt wurde.
