# Pilot-Plant-Versuchsnummer – Vorprüfung und Stopp

## Verbindlicher Stopp vor Umsetzung
Das vorhandene Gebäudefeld der Desktop-App konnte im erreichbaren Quellcode und in der Web-Datenbank nicht identifiziert werden. Die vollständige fachliche Massetyp-Auswahl mit Heat Media ist ebenfalls nicht belegt. Deshalb keine Programmänderung vorgenommen und keine neue Datenstruktur eingeführt.

## Tatsächlich geprüft
- Repository einschließlich React-Quellcode, Desktop-Hülle, vorhandener Migrationen und Nummerierungslogik nur gelesen.
- Web-Datenbank nur mit SELECT-Abfragen geprüft.
- `measurement_orders`: `pp_experiment_number`, `pp_masse_type` und `shared_form_data` vorhanden, aber kein eigenes Gebäudefeld. Öffentliches Schema ohne entsprechend benannte Gebäudespalte.
- `form_fields` und `service_data_fields`: keine Treffer für Gebäude, Dieselkatgebäude, Kerngebäude oder Heat Media in Feldschlüsseln, Anzeigenamen und Optionen; moderne Felder zusätzlich in Metadaten geprüft.
- `shared_form_data`: kein entsprechender Texttreffer in vorhandenen Aufträgen. Dies schließt unbekannte technische Feldschlüssel nicht aus.
- Globale Stammdaten: „Heat Media“ nur als Beschreibung des Extruder-Eintrags NETZSCH gefunden. Das belegt keine Massetyp-Auswahl und darf nicht als Ersatzquelle dienen.
- Web-Bestand: fünf explizite Pilot-Plant-Aufträge, davon vier mit gespeicherter Versuchsnummer.
- `src/lib/api/orders.ts`: bestehende Versuchsnummer ist bereits im Laden enthalten und als optionales Create-/Update-Feld verfügbar. Einzelnes `pp_masse_type` kennt DK/GK/KK/MK/PK; eine vollständige Auswahl mit belastbarer Heat-Media-Zuordnung ist hier nicht belegt.
- `src/lib/orders/orderKind.ts`: zentrale Auftragsart-Klassifizierung vorhanden; unverändert.

## Kleinste sichere Fortsetzung
Zuerst datensparsam die tatsächlichen Desktop-Felddefinitionen liefern: Gebäudefeldname, Speicherort, gültige Werte/IDs und vorhandene Auswertungslogik; entsprechend die vollständige Massetyp-Auswahl und den stabilen Heat-Media-Schlüssel. Ein Feld-/Schemaexport oder relevante Quellcodestellen reichen; keine Zugangsdaten und keine Produktionsdatensätze erforderlich.

Wenn diese Werte bereits in einer vorhandenen JSON-Struktur liegen, kann nach bestätigter Zuordnung möglicherweise ausschließlich die bestehende Anzeige/Erfassung additiv angepasst werden. Liegt keine Web-Abbildung vor, muss deren konkrete minimale Lösung gesondert freigegeben werden; jetzt kein neues Feld und keine Migration erstellt.

Optional kann die führende Anzeige bereits gespeicherter Versuchsnummern ohne neue Präfix-/Gebäuderegel separat freigegeben werden. Diese Teilumsetzung wurde wegen der ausdrücklichen Stop-Regel nicht vorgezogen.

## Änderungen und Prüfstatus
Nur `roadmap.md`, dieser Befundbericht und Projektgedächtnis zum Auftrag aktualisiert. Keine Programmdateien, Datenbankwerte, Migrationen, technischen Auftragsnummern, UUIDs, m³-Berechnungen, Berechtigungen, Infrastruktur oder Konfiguration geändert.

Keine neuen Tests oder manuelle Abnahme einer Implementierung durchgeführt, da keine Implementierung erfolgt ist. Desktop-Anwendung und Firmen-Datenbank nicht erreichbar; keine Schema-Gleichheit behauptet.