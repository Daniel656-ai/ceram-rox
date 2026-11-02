# Roadmap

## Erledigt
1. **Versuchsnummern historische Pilot-Plant-Aufträge** – zentrale Fallback-Auflösung implementiert (orderIdentity.resolveExperimentNumber, Priorität Spalte > Legacy > Template, Konflikterkennung + Hinweis in Detailansicht, Ergebnis-DB-Select erweitert). 939 Tests, tsgo, Build OK. Web-Abnahme (Cloud-Daten) bestanden. 15 Aufträge geprüft: Cloud überall „Fehlt". Bericht: /mnt/documents/ROX-Versuchsnummern-historische-Auftraege-Abschlussbericht.md
2. **m³-PDF-Layout-Ursachenanalyse** – abgeschlossen, keine Implementierung. Ursache: HTML-Druckweg (printM3Html) blieb einspaltig; Test prüft nur Text, nicht Geometrie. Bericht: /mnt/documents/ROX-m3-Liste-PDF-Layout-Ursachenanalyse.md

## Offen (blockiert durch externe Faktoren)
- Desktop-/Tauri-Abnahme beider Themen – produktive Desktop-App/Firmen-Backend von hier nicht erreichbar.
- m³-HTML-Druck-Korrektur – wartet auf ausdrückliche Freigabe (Analyseauftrag war bewusst ohne Umsetzung).
