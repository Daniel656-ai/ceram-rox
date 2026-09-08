---
name: RFA-Zuordnung über Messfall-Ergebniselemente
description: Messfall-Ergebnisliste (measurement_case_elements) + optionaler Elementbereich sind die führende Zielliste des Imports; Elemente ohne Formularfeld werden als element:<Key> in der Messung gespeichert
type: feature
---

- Ablauf: Messfall → `measurement_case_elements` (Auswahl, Reihenfolge, offiziell) → Zielliste (`buildCaseTargets`) → Import erkennt ALLE Spalten → Zuordnung über Element-Key → Wert in Messung → `buildLinkedFormResultCandidates` → `measurement_results` (Upsert per result_name, keine Duplikate).
- Der Import besitzt keine eigene Elementliste. Ändert der Benutzer die Ergebnis-Elemente im Messfall, folgt der Import automatisch (Sync-Effekt in FormLayoutRenderer schreibt Spec/Range in bestehende Messungen).
- Messfall-Element ohne passendes Formularfeld → virtuelles Ziel `element:<Key>` (Speicherung direkt im Messblock-Eintrag). Formular-Elementfelder außerhalb der Messfall-Liste sind keine Ziele und nie offiziell.
- Fehlendes Element im Import: leere Ergebnisposition bleibt (kein Abbruch), UI zeigt „Kein Messwert importiert für: …“. Zusätzliche Importelemente: Status „nicht benötigt“, bleiben im Import-JSON erhalten.
- Elementbereich (`measurement_cases.element_range`, z. B. „B-U“, Standardlos): erkannte Elemente, deren Leitelement (erstes Nicht-O/H-Symbol) in der Ordnungszahl-Spanne liegt, werden dynamisch als `element:<Key>` übernommen und nach Ordnungszahl als offizielle Ergebnisse geführt. „LOI“ ist kein Element.
- Spaltenüberschriften werden vor dem Matching normalisiert (Einheit in Klammern/angehängt, Groß-/Kleinschreibung, Tiefstellung). Diagnose: `mappingReport`.
- Akzeptanztests A–E: `src/test/rfaCaseImportFlow.test.ts`.
