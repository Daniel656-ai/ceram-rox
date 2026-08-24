---
name: Messfall / Analyseschema
description: Konfigurierbare Messfälle erzeugen automatisch die erforderlichen Messungsinstanzen eines Messdatenblocks (ersetzt Excel-/Makro-Logik)
type: feature
---

- Tabellen `measurement_cases` (Vorlage: Name, Schlüssel, Methode) und `measurement_case_instances` (Bezeichnung, Methode, Importprofil, `context` als frei definierbare Eigenschaften wie Probenvorbereitung/Analyseart). Lesen: alle angemeldeten Benutzer; Pflege: `can_manage_designer`.
- Verwaltung: Service Designer → Tab „Messfälle“ (`MeasurementCasesSection`). Keine Messfälle im Frontend hartcodiert.
- Aktivierung je Messblock im Feldeditor („Messfall-Steuerung“): vorgegebener Messfall, erlaubte Messfälle, Sperre gegen manuelles Hinzufügen/Löschen.
- Laufzeit (`FormLayoutRenderer` → `MeasurementBlockField`): ROX erzeugt die Messungen automatisch (`buildEntriesFromCase`), zeigt je Messung eine Karte mit Bezeichnung, Kontext-Badges und Importstatus („Noch nicht importiert“ / „✓ Import abgeschlossen“). Bezeichnungs-/Kontextfelder werden ausgeblendet – nur Messwerte und Messdatenimport sind sichtbar.
- Jede Instanz hat eigenes Importprofil (`__import_profile_id`) und eigene Ergebnisse; Interne Schlüssel: `__case_id`, `__case_instance_id`.
