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

## Auswertungsebenen (strikt getrennt)

1. **Rohdaten** – `measurement_raw_datasets` + `measurement_raw_series`, unveränderlich, CSV-Export.
2. **Gespeicherte Auswertung** – `measurement_curve_evaluations` mit `kind` (`point`/`range`),
   `x_at`, `group_id` (klammert alle Kurvenwerte einer Stelle), `comment`,
   `include_in_report`, `x_label`/`y_label`, `revision`, `updated_by`/`updated_at`
   (Trigger `trg_mce_touch`). Beliebig viele Punkte, jederzeit erweiterbar.
3. **Ergebnisbericht** – `generate-order-report` liest die als `include_in_report`
   markierten Auswertungen (`snapshot.curve_evaluation`).

- `CurvePointEvaluations.tsx`: „Wert an definierter Stelle" für mehrere Kurven gleichzeitig,
  Interpolation über `interpolateAt`, Kommentar, Bericht-Schalter, Löschen.
- `CurveViewer` zeichnet gespeicherte Punkte über `markers` (ReferenceLine + ReferenceDot).
- `src/lib/curves/export.ts`: `rawDataCsv`, `evaluationCsv`, `exportEvaluationPdf` (Tabelle + Graph).
- X-Achse bleibt generisch (keine Temperatur-Fixierung); weitere Methoden kommen über
  `src/lib/curves/evaluations.ts` dazu.
