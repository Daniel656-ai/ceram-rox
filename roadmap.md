# Roadmap

## Aktuell: Erweiterte Auftragssuche und persönliche Filter
- Vorhandene Proben-/Projektfilter, Speicherung und tatsächliche Zuordnungen untersuchen.
- Suche/Filter in Alle Aufträge additiv erweitern und vorhandene persönliche Speicherung wiederverwenden; bei notwendiger Strukturänderung stoppen.
- Fachliche Tests und Web-Prüfung durchführen; Desktop-Abnahme separat und Einschränkungen im Bericht benennen.

## Erledigt
1. **Versuchsnummern historische Pilot-Plant-Aufträge** – zentrale Fallback-Auflösung implementiert (orderIdentity.resolveExperimentNumber, Priorität Spalte > Legacy > Template, Konflikterkennung + Hinweis in Detailansicht, Ergebnis-DB-Select erweitert). 939 Tests, tsgo, Build OK. Web-Abnahme (Cloud-Daten) bestanden. 15 Aufträge geprüft: Cloud überall „Fehlt". Bericht: /mnt/documents/ROX-Versuchsnummern-historische-Auftraege-Abschlussbericht.md
2. **m³-PDF-Layout-Ursachenanalyse** – abgeschlossen, keine Implementierung. Ursache: HTML-Druckweg (printM3Html) blieb einspaltig; Test prüft nur Text, nicht Geometrie. Bericht: /mnt/documents/ROX-m3-Liste-PDF-Layout-Ursachenanalyse.md

## Offen (blockiert durch externe Faktoren)
- Desktop-/Tauri-Abnahme beider Themen – produktive Desktop-App/Firmen-Backend von hier nicht erreichbar.
## Neu erledigt
- m³-HTML-Druckkopf zweispaltig angeglichen; DOM-Strukturtests und echte jsPDF-X/Y-Tests für beide längeren Spalten ergänzt. 941 Tests bestanden, automatischer Web-Build OK.
- Beide Ausgabeaktionen mit lokalen Prüfdaten ausgeführt; A4-Dateien getrennt visuell geprüft, 120/120 Zeilen je Ausgabe nachgewiesen. Bericht: /mnt/documents/ROX-m3-HTML-Druck-Abschlussbericht.md.

## Weitere externe Abnahme offen
- Nativer Druckdialog „Als PDF speichern“: nicht automatisiert bedienbar; Chromium-A4-Druck-PDF und iframe-Aufruf geprüft.
- Neuer Desktop-Build und Installation: Desktop-/Firmenumgebung hier nicht verfügbar; keine nativen Änderungen.
