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
