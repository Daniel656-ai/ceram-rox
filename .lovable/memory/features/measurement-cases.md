---
name: Messfall / Analyseschema
description: Messfälle sind eine fachliche Konfigurationsebene der Messblock-Felder im Formulardesigner – kein eigener Formular-/Tabellenbaustein und kein eigener Tab im Prozessdesigner
type: feature
---

- Architekturtrennung: **Prozessdesigner** = fachlicher Ablauf/Abhängigkeiten (z. B. Geometrievermessung → Probenvorbereitung → Messung), **Formulardesigner** = Auswahl, Konfiguration und Layout aller Bausteine, **Messfall** = Konfigurationsebene innerhalb eines Messblock-Feldes.
- Es gibt **keinen** Tab „Messfälle“ im Prozess-/Service-Designer (entfernt, da er als eigenständige Tabellen-/Bausteinebene fachlich falsch war und durch fehlende Tab-Registrierung ohnehin nicht anwählbar war).
- Verwaltung erfolgt ausschließlich am Messblock-Feld im Feldeditor („Messfall-Steuerung“): Anlegen („+“) und Bearbeiten („✎“) über `MeasurementCaseEditorDialog`, dazu vorgegebener Messfall, erlaubte Messfälle und Sperre gegen manuelles Hinzufügen/Löschen.
- Tabellen `measurement_cases` / `measurement_case_instances` (Bezeichnung, Methode, Importprofil, `context`, `curve_config`). Lesen: alle angemeldeten Benutzer; Pflege: `can_manage_designer`.
- Laufzeit (`FormLayoutRenderer` → `MeasurementBlockField`): Messungen werden aus dem Messfall erzeugt (`buildEntriesFromCase`), je Messung eine Karte mit Bezeichnung, Kontext-Badges und Importstatus. Interne Schlüssel: `__case_id`, `__case_instance_id`, `__import_profile_id`.
- Messfälle ersetzen niemals die Bausteinauswahl des Formulardesigners (Text, Zahl, Berechnung, Ergebnis, Messwerttabelle, Geometrie, globale Felder usw.).
