---
name: Geometrievermessung – CSV-Import mit Mittelwertbildung
description: CSV-Importer für Geometrievermessungen; Gruppierung der Messelemente nach Messart (D, to, ti, d) und automatische Mittelwertbildung
type: feature
---

- Importer `src/lib/instrumentImport/geometry/index.ts` (`geometry_csv`) ist in der bestehenden Registry registriert; keine zweite Importlogik.
- Erkennung inhaltsbasiert über die Spalten „Messelemente“ und „Messwert“ (ANSI/UTF-8, `;`/Tab/`,`).
- Gruppierung dynamisch: Präfix + Nummer + optionaler Zusatz („ti1 Außen“ → Messart `ti`). Groß-/Kleinschreibung ist relevant: `D` ≠ `d`.
- Nur numerisch interpretierbare Messwerte gehen in den Mittelwert ein; leer/`Fehler`/`---`/Text werden ignoriert und NIEMALS als 0 gewertet. Ein gültiger Wert = Ergebnis dieses Werts. Ein Gesamtstatus „Fehler“ verhindert den Import nicht.
- Ergebnisse: Mittelwerte je Messart (`GEOMETRY_MEAN`) plus alle Einzelmesswerte (`GEOMETRY_SINGLE`, bleiben über die bestehende „nicht zugeordnet“-Logik erhalten).
- Einheit kommt aus der Spalte „Einheit“ und bleibt separates Attribut (Anzeige zentral via `formatResultLabel`). Keine Rundung beim Einlesen.
- Nachvollziehbarkeit in `headerMap`: „Mittelwert X“ = gültige Werte, nicht erkannte Werte, Mittelwert, Einzelwerte.
- Zuordnung zu Ergebnisfeldern ist NUR für Geometrievermessung case-sensitive (`mapImportedResults` in `src/lib/instrumentImport/index.ts`): Priorität 1 exakte Schreibweise (Profilmapping/field_key/display_name, Einheitensuffix wird ignoriert), Priorität 2 normalisierte Zuordnung – aber niemals, wenn im Import mehrere Schreibweisen desselben Namens (D/d) vorkommen oder die Zuordnung mehrdeutig wäre. Andere Importprofile (RFA, DIL, STA, Gasadsorption) behalten die globale normalisierte Logik.
- Nachkommastellen: Importierte Geometriewerte (Mittelwerte und Einzelwerte) werden auf die im Ergebnisfeld hinterlegte `decimal_places` (aktuell 4) kaufmännisch gerundet (`roundToField` in `src/lib/instrumentImport/index.ts`). Rohdaten/Datei bleiben unverändert; andere Importprofile runden weiterhin nicht.
- Reihenfolge: Geometrieergebnisse werden in der Reihenfolge der Ergebnisfelder des Formulars ausgegeben (Reihenfolge der `targets`, z. B. D → ti → to → d) – niemals alphabetisch; andere Profile behalten die Dateireihenfolge.
