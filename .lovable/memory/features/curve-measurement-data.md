---
name: Kurvenbasierte Messdaten (NETZSCH DIL/STA & generisch)
description: NETZSCH5-Import, generisches Kurvenmodell, Rohdatenspeicherung, interaktive Kurvenansicht und Auswertung als offizielles Ergebnis
type: feature
---

## Architektur

Datei → Importer → `MeasurementDataset` (Kanäle + Messpunkte) → Kurve → Bereichsauswahl → Auswertung → offizielles Ergebnis.

- `src/lib/curves/dataset.ts`: generisches Kurvenmodell (`MeasurementChannel`, `MeasurementDataset`), Header-/Einheitentrennung, Slicing, Interpolation, Downsampling, Trapezfläche.
- `src/lib/curves/evaluations.ts`: verfahrensunabhängige Auswertungsregistry (technischer Ausdehnungskoeffizient, Differenz, relativer Verlust, Mittelwert, Max/Min, Peak-X, Peak-Fläche, Wert an Stelle). Eignung ergibt sich aus Kanälen/Einheiten, nicht aus dem Gerät.
- `src/lib/instrumentImport/netzsch/`: NETZSCH5-Parser (`#FORMAT:NETZSCH5`, `#MTYPE:DIL|DSC`), ANSI-Dekodierung, dynamische Kanäle. Fehlende Alpha-Kanäle werden bei DIL aus `dL/Lo` abgeleitet und als `derived` gekennzeichnet.
- Erkennung erfolgt inhaltsbasiert, nie über die Dateiendung.

## Persistenz

- `measurement_raw_datasets`: Kopf (Messung, Probe, Dienstleistung, Messblock-Instanz, Messfall-Instanz, Datei, Kanäle, Metadaten).
- `measurement_raw_series`: Messpunkte blockweise (2000 Zeilen je Block).
- `measurement_curve_evaluations`: Methode, Kurve, Bereich, Ergebnis, Formel, Zwischenwerte, Benutzer, Verknüpfung zum `measurement_results`-Eintrag.
- Zugriff über `api.measurementRawData` – keine direkten Supabase-Aufrufe außerhalb der API-Schicht.

## UI

- `CurveViewer`: X-/Y-Auswahl, zweite Y-Achse, Kurven ein-/ausblenden, Einheiten aus den Kanälen, Bereichsauswahl per Ziehen oder Zahleneingabe.
- `CurveEvaluationPanel`: Berechnung mit vollständiger Provenienz; Übernahme erst nach Prüfung per „Als offizielles Ergebnis übernehmen“.
- Rohdaten werden nur gespeichert, wenn ein Messungskontext existiert (`MeasurementContextProvider`, gesetzt in `TaskExecutionPage`). Im Designer bleibt alles Vorschau.
- `MeasurementCurvesCard` zeigt gespeicherte Kurven und dokumentierte Auswertungen erneut an.

## Regeln

- Keine zweite Ergebnisdatenbank: berechnete Werte gehen als `measurement_results` mit `is_official` ein; Änderungen laufen über die bestehende Korrekturlogik.
- Keine fest verdrahteten Spaltenlisten im Frontend.
