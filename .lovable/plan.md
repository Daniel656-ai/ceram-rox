# NETZSCH DIL / STA-DSC – Bestandsaufnahme und Architekturvorschlag

Hinweis: In den bereitgestellten Uploads liegen aktuell **nur Micromeritics-Dateien** (`0000-8579/8689/8702` als `.REP`/`.SMP`). Es sind **keine NETZSCH-Dateien** (`#FORMAT:NETZSCH5`) vorhanden. Die Formatanalyse unten beruht daher auf dem dokumentierten NETZSCH5-ASCII-Aufbau und muss vor der Umsetzung an echten Dateien verifiziert werden.

## A. Bestehender Messdatenimport — vorhanden

- Copy-&-Paste-Import: `src/lib/measurementImport.ts` (Key/Value, Tabellen, DE/EN-Zahlen, Einheiten, Nachweisgrenzen) + `MeasurementImportDialog`.
- Datei-Import über Registry `src/lib/instrumentImport/index.ts` mit Schnittstelle `FileImporter { id, label, extensions, detect(buffer), parse(buffer) }` — inhaltsbasierte Erkennung ist bereits vorgesehen (`detectImporter`).
- Aktuell registriert: nur `gasSorptionImporter` (BET/BJH/Langmuir/t-Plot, Micromeritics-Binärstruktur).
- Datenmodell `ImportedMeasurement` enthält bereits `analyses[].series: ImportedSeries[]` (x/y-Punkte, Labels, Einheiten) — **wird heute nirgends befüllt, gespeichert oder dargestellt**.
- Klassifizierung Messwert vs. Metadaten: `src/lib/measurementClassification.ts`; nicht zuordenbare Messwerte bleiben als `unassigned` im Import-Feld-JSON erhalten.
- Messblock + Messfall: `src/lib/measurementBlocks.ts`, `measurement_cases` / `measurement_case_instances`, Instanzschlüssel `instance_key`/`instance_context`.
- Ergebnisse: `measurement_results` (mit `is_official`, `display_label`, `instance_*`), Korrektur-Audit `measurement_result_corrections` + RPC `correct_measurement_result`.
- Dateiablage: Bucket `order-uploads` / Tabelle `order_upload_files`.

## B. NETZSCH DIL

Bereits möglich: nichts spezifisch — als ASCII-Datei könnte der generische Copy-&-Paste-Parser einzelne Kopfzeilen als Key/Value lesen, aber keine Messkurven.

Fehlt:
- Importer `netzsch5` (Header `#FORMAT:NETZSCH5`, `#MTYPE:DIL`, `#IDENTITY`, `#SAMPLE`, `#DATE/TIME`, `#RANGE`, `#RATE`, `#SAMPLE LENGTH`, `#CORR.`, `##` Spaltenkopf, danach CSV-Datenblock).
- Dynamische Kanalerkennung aus dem Spaltenkopf (`Temp./°C`, `Time/min`, `dL/Lo`, `T. Alpha/(1/K)`, `Alpha/(1/K)`) inkl. Trennung Name/Einheit.
- Persistenz der Messpunkte.

## C. NETZSCH STA / DSC

Bereits möglich: nichts spezifisch.

Fehlt: identischer Importer-Pfad, `#MTYPE:DSC`, zusätzliche Kopffelder (Gase, Tiegel, Einwaage) und Kanäle `DSC/(mW/mg)`, `Mass/%`, `Gas Flow`, `DTG` usw. — ebenfalls rein dynamisch aus dem Spaltenkopf.

## D. Grafische Darstellung

Vorhanden: recharts (`src/components/ui/chart.tsx`), Ergebnisdatenbank-Diagramme (`src/lib/resultsChartData.ts`, `AxisScaleControls`) — jedoch ausschließlich für **aggregierte Ergebniswerte über Proben**, nicht für Messreihen mit tausenden Punkten.

Neu: Kurvenviewer für Messreihen (Achsenauswahl X / Y / Y2, Kurven ein-/ausblenden, Einheiten aus den Kanaldaten, Zoom, Downsampling für die Anzeige, zwei ziehbare Bereichsgrenzen / Brush).

## E. Kurvenauswertung

Nutzbar: `parseNumericValue`, `formulaEngine`/`localCalculations` (für spätere Formelbindung), Messfall-Steuerung als Ort für „erlaubte Auswertungen“.

Neu: Auswertungs-Registry mit reinen Funktionen über einem Kurvenausschnitt (Interpolation an Grenztemperaturen, technischer Ausdehnungskoeffizient, ΔL/L0, Alpha-Mittelwert, Extremwert, Massenverlust, Peak-Temperatur/-Höhe/-Fläche mit Basislinie).

## F. Ergebnisübernahme

Keine zweite Ergebnisdatenbank. Eine bestätigte Auswertung wird als Zeile in `measurement_results` geschrieben (`result_name`, `display_label`, `value`, `unit`, `instance_key`/`instance_label`/`instance_context` aus dem Messfall, `is_official` erst nach Bestätigung durch den Benutzer). Die Berechnungsherkunft (Kurve, X/Y, Start/Ende, Methode, Formel, Rohdatenreferenz) wird als strukturierte Provenienz mitgespeichert. Spätere Änderungen laufen unverändert über `correct_measurement_result`.

## G. Empfohlene Architektur

```text
Datei (.dl4/.txt/.csv, ASCII NETZSCH5)
  -> FileImporter "netzsch5"  (detect: Inhalt "#FORMAT:NETZSCH5", mtype aus "#MTYPE:")
  -> ImportedMeasurement { sampleInformation, results (Kopfwerte), analyses[].series (Kanaele) }
  -> Rohdaten-Persistenz: measurement_raw_datasets + measurement_raw_series
       (Auftrag, Probe, Messung, Dienstleistung, Messfall/instance_key, order_upload_files.id)
  -> CurveViewer (Achsenwahl, Kurven, Bereichsgrenzen)
  -> Evaluation-Registry (generisch: Kanal + Range -> Wert + Einheit + Provenienz)
  -> Bestaetigung durch Benutzer
  -> measurement_results (is_official = true) + Korrekturlogik
```

Generisches Kanalmodell (verfahrensunabhängig, gilt später auch für RFA/BET/Gasadsorption):

```ts
interface MeasurementChannel { key: string; label: string; unit: string | null; role?: "x" | "y"; }
interface MeasurementDataset { channels: MeasurementChannel[]; rows: number[][]; }
```

Neue Dateien (Vorschlag):
- `src/lib/instrumentImport/netzsch/netzsch5.ts` — Header-/Spalten-/Datenparser, `mtype`-Erkennung.
- `src/lib/instrumentImport/netzsch/index.ts` — Registrierung eines Importers `netzsch5` in der bestehenden Registry (kein Ersatz bestehender Importer).
- `src/lib/curves/dataset.ts` — Kanalmodell, Interpolation, Bereichsschnitt, Downsampling.
- `src/lib/curves/evaluations.ts` — Registry der Auswertungen (`id`, `label`, benötigte Kanäle, `run(range) => { value, unit, details }`).
- `src/components/curves/CurveViewer.tsx` + `CurveEvaluationPanel.tsx`.
- `src/lib/api/measurementRawData.ts` — Domainfunktionen (API-Layer-Pflicht).

Backend (eine Migration, additiv):
- `measurement_raw_datasets` (order_measurement_id, sample_id, service_id, case_instance_key, source_file_id, importer_id, mtype, channels jsonb, point_count, metadata jsonb)
- `measurement_raw_series` (dataset_id, points jsonb oder komprimierte Spaltenarrays) — je nach Punktanzahl ein Datensatz pro Kanal.
- `measurement_curve_evaluations` (dataset_id, method, x_channel, y_channel, x_from, x_to, value, unit, formula, created_by, created_at, measurement_result_id) als Provenienz zur offiziellen Ergebniszeile.
- Jeweils GRANTs + RLS analog zu `measurement_results`.

Messfall-Integration: `measurement_case_instances.context` bzw. Konfiguration am Messblock erhält optionale Schlüssel `expected_mtype`, `default_x`, `default_y`, `default_y2`, `allowed_evaluations` — keine Änderung an bestehenden Messfällen.

## H. Testfälle (Vitest, mit echten Referenzdateien)

DIL: Erkennung `#MTYPE:DIL`, Kanal-/Einheitenerkennung, Punktanzahl, Temp vs. dL/Lo, Temp vs. Alpha, Bereich 30–800 °C, technischer Ausdehnungskoeffizient, Übernahme als offizielles Ergebnis inkl. Provenienz.

STA: Erkennung `#MTYPE:DSC`, Kanäle DSC/Mass/Gas Flow, Bereichsauswahl, Massenverlust absolut und in %, Peak-Temperatur/-Fläche, Übernahme als offizielles Ergebnis.

Querschnitt: Datei ohne NETZSCH-Header wird nicht erkannt; bestehende Gasadsorptions-Tests bleiben grün.

## Status-Übersicht

- Bereits vorhanden: Importer-Registry mit Inhaltserkennung, Metadaten-/Messwert-Klassifizierung, Messblock + Messfall, `measurement_results` inkl. `is_official` und Korrektur-Audit, Dateiablage, recharts.
- Teilweise vorhanden: Serien-Datenmodell (`ImportedSeries` definiert, aber nie gefüllt/gespeichert), Diagrammbausteine (nur für Ergebnisaggregation), Berechnungsengine (nur formularbasiert).
- Neu zu entwickeln: NETZSCH5-Parser, Rohdaten-Persistenz, Kurvenviewer mit Bereichsauswahl, generische Auswertungs-Registry, Provenienz-Tabelle, Messfall-Erweiterung.

## Nächster Schritt

Echte NETZSCH-Dateien (je eine DIL- und eine DSC-Messung) bereitstellen; danach Umsetzung in Etappen: (1) Parser + Tests, (2) Rohdaten-Persistenz, (3) Kurvenviewer, (4) Auswertungen + Ergebnisübernahme.
