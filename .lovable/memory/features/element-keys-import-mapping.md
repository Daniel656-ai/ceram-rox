---
name: Element-Keys für Messdatenimport
description: Stabile chemische Element-/Verbindungsschlüssel verbinden Importdaten mit den Ergebnisfeldern des Messfalls; nicht benötigte Elemente bleiben erhalten
type: feature
---

- Drei getrennte Ebenen: **Importdaten** (alles, was das Gerät liefert) ≠ **Formularfelder** ≠ **Ergebnisfelder des Messfalls**. Formulare werden NIE automatisch um alle möglichen Elemente erweitert.
- `src/lib/elementKeys.ts`: `elementKey(name)` liefert einen stabilen Schlüssel (`SiO2`, `Al2O3`, `Pb`) aus Formel (`SiO₂`, `sio2`), Trivialname (`Silica`, `Tonerde`, `Glühverlust` → `LOI`) und Element-Klartextnamen DE/EN (`Blei` → `Pb`). `formatElementKey` erzeugt die Anzeige mit tiefgestellten Zahlen.
- `canonicalParameter` (measurementClassification) nutzt zuerst den Element-Key; damit erfolgt die automatische Zuordnung nie nur über die sichtbare Bezeichnung.
- `src/lib/measurementImport.ts`: `rowStatus()` → `assigned` | `not_needed` | `unreadable`; `openTargets(rows, targets)` liefert die Ergebnisfelder des Messfalls, die der Import nicht befüllt hat – nur diese verlangen eine manuelle Aktion.
- Importierte Werte ohne Ergebnisfeld erhalten den Status „importiert – für Messfall nicht benötigt“, werden im Importfeld-JSON (`unassigned`, inkl. `element_key`) gespeichert und können später zugeordnet werden. Sie sind kein Fehler.
- Generisch: kein hartkodierter Messfall-Elementsatz; der Messfall/das Formular definiert die benötigten Ergebnisfelder.
