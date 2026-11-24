# Eigene Aufträge bearbeiten und löschen (Auftraggeber)

## Ausgangslage (geprüft, nur lesend)
- **Löschen existiert bereits** serverseitig: `cancel_or_delete_order` erlaubt Master oder Ersteller (Rolle Auftraggeber) und lehnt ab bei Ergebnissen, Rohdaten, Arbeitszeiten, Work-Logs, abgeschlossenen/begonnenen Aufgaben. Übersicht und Detailseite bieten „Löschen“ an, die Anzeige hängt aber nur am Feld `status = open`.
- **Bearbeiten gibt es nicht**: Das Erstellungsformular kennt nur Neuanlage und Entwürfe (`?draft=`), keinen Bearbeitungsmodus für bestehende Aufträge.
- **Serverseitige Lücken** (Web-Datenbank):
  1. Ersteller dürfen `measurement_orders` jederzeit ändern – auch nach Arbeitsbeginn. Die verlangte Sperre ist serverseitig nicht abgesichert.
  2. Vorgaben (`measurement_parameters`) dürfen Ersteller ebenfalls ohne Statusprüfung ändern.
  3. Eine abgewählte Dienstleistung zu entfernen geht nur über `delete_order_measurement` – das ist **nur für Master** erlaubt. Auftraggeber könnten beim Bearbeiten also keine Dienstleistung entfernen.

Deshalb ist eine Datenbankänderung nötig. Laut Vorgabe halte ich vor der Umsetzung an und lege sie zur Freigabe vor.

## Vorgeschlagene Datenbankänderung (Web-Migration, Firmen-SQL getrennt und nicht ausgeführt)
1. `order_requester_edit_state(order_id)` (SECURITY DEFINER, nur lesend): liefert „bearbeitbar ja/nein + Grund“ mit **denselben Kriterien wie die vorhandene Löschfunktion** (Aufgabenstatus, Ergebnisse, Rohdaten, Zeiten, Work-Logs, Sperre). Eine einzige Regel für Bearbeiten, Löschen und Anzeige.
2. Trigger auf `measurement_orders` (UPDATE) und `measurement_parameters` (INSERT/UPDATE/DELETE): Nicht-Master-Ersteller werden abgelehnt, sobald Punkt 1 „begonnen“ meldet. Automatische Status-Synchronisation durch Messdienstleister bleibt unberührt (betrifft nur den Ersteller).
3. `requester_remove_order_measurement(om_id, reason)` (SECURITY DEFINER): Ersteller dürfen eine **noch völlig unbearbeitete** Dienstleistung ihres Auftrags entfernen; gleiche Schutzprüfungen und Audit-Eintrag wie `delete_order_measurement`. Die Master-Funktion bleibt unverändert.
4. Keine Änderung an Auth, Rollen, bestehenden Policies, Daten oder anderen Funktionen.

## Frontend
- `CreateOrderPage` erhält Modus `?edit=<auftrags-id>`: lädt Auftrag, Pilot-Plant-Blöcke (Knetung, Extrusion, PPP_Masse, PPP_Produkt), `shared_form_data`/Versuchsnummer, Dienstleistungen, Vorgaben und Formularwerte über die bestehende Entwurfs-Wiederherstellung in **dasselbe Formular** inkl. Dienstleistungsreitern und Validierung.
- Speichern aktualisiert den bestehenden Auftrag (Nummer, Ersteller, Datum, Proben bleiben); neue Dienstleistungen werden ergänzt, abgewählte über RPC 3 entfernt, unveränderte Aufgaben und Messdaten nicht angefasst.
- „Bearbeiten“/„Löschen“ in Übersicht und Detail nur bei Punkt-1-Freigabe; sonst der vorgegebene Sperrhinweis. Sicherheitsabfrage mit dem vorgegebenen Text.
- DE/EN-Texte, Tests für die Freigaberegel und den Änderungsabgleich, Abschlussbericht.

## Offen / Grenzen
- Native Tauri-Abnahme kann ich nicht durchführen; Firmen-SQL muss der Administrator ausführen, bis dahin ist die Bearbeitung in der Desktop-App serverseitig ungesichert bzw. das Entfernen von Dienstleistungen nicht möglich.
