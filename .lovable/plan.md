# NETZSCH DIL / STA-DSC – Bestandsaufnahme und Architekturvorschlag

Grundlage: zwei echte NETZSCH5-Exportdateien (DIL 402C und STA 449F3), binär geprüft.

## Formatbefund (verifiziert an den Realdateien)

Beide Dateien sind reine ASCII-Exporte („DATA ALL“) mit CRLF, Codierung **ISO-8859-1/ANSI** (`#FTYPE:ANSI`) – nicht UTF-8, sonst brechen `°C`, `µm`, „Fürpaß“. Aufbau: Kopfzeilen `#SCHLÜSSEL:Wert`, eine Leerzeile, dann eine Spaltenkopfzeile mit `##`-Präfix, dann der Datenblock.

Selbstbeschreibende Steuerzeilen, die der Parser auswerten muss statt zu raten:
- `#FORMAT:NETZSCH5` (Erkennungsmerkmal), `#MTYPE:DIL` bzw. `#MTYPE:DSC`
- `#DECIMAL:POINT` (Dezimaltrennzeichen), `#SEPARATOR:SEMICOLON` (Spaltentrenner)

Achtung: In den Kopfzeilen selbst wird trotzdem Komma verwendet (`#RANGE:30,0°C/5,0(K/min)/1520,0°C`) – Kopf und Datenblock brauchen unterschiedliche Zahlenbehandlung.

DIL-Datei (112 Zeilen): `#INSTRUMENT:NETZSCH DIL 402C`, `#IDENTITY`, `#DATE/TIME`, `#CORR. FILE`, `#TEMPCAL`, `#LABORATORY`, `#OPERATOR`, `#SAMPLE`, `#SAMPLE LENGTH /mm:24.948`, `#MEASMODE`, `#PURGE GAS 1`, `#FLOW RATE 1`, `#M.RANGE /µm`, `#CORR. CODE`, `#RANGE`, `#SEGMENT`, `#SEG. 1`.
Spaltenkopf: `##Temp./°C;Time/min;dL/Lo` — **nur drei Kanäle**. `T. Alpha` und `Alpha` sind in diesem Export **nicht enthalten** und müssen von ROX aus `dL/Lo` und `#SAMPLE LENGTH` berechnet werden (technischer/physikalischer Ausdehnungskoeffizient). Sind sie in anderen Exporten vorhanden, werden sie dynamisch übernommen.

STA/DSC-Datei (225 Zeilen): `#INSTRUMENT:NETZSCH STA 449F3`, zusätzlich `#SENSITIVITY`, `#SAMPLE MASS /mg:22.160`, `#REFERENCE`, `#REFERENCE MASS`, `#TYPE OF CRUCIBLE`, `#SAMPLE CRUCIBLE MASS`, `#DSC RANGE /µV`, `#TG RANGE /mg`, `#TAU-R`, `#EXO:-1` (Vorzeichenkonvention der DSC-Kurve!), `#RANGE`, `#SEGMENT`.
Spaltenkopf: `##Temp./°C;Time/min;DSC/(mW/mg);Mass/%;Gas Flow(purge1)/(ml/min);Gas Flow(protective)/(ml/min);Sensit./(uV/mW)` — sieben Kanäle, Einheit steht nach dem letzten `/`, Klammerzusätze gehören zum Kanalnamen.

Fazit: Die Typerkennung über `#FORMAT`/`#MTYPE` ist zuverlässig und rein inhaltsbasiert – die Endung `.txt` ist unbrauchbar und wird nicht verwendet.

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

Bereits möglich: nichts spezifisch — der Copy-&-Paste-Parser könnte einzelne Kopfzeilen als Key/Value lesen, aber keine Messkurven.

Fehlt:
- Importer `netzsch5` (ANSI-Dekodierung, Kopfzeilen, `#DECIMAL`/`#SEPARATOR`, `##`-Spaltenkopf, Datenblock).
- Dynamische Kanalerkennung inkl. Trennung Name/Einheit (`Temp./°C` → „Temp.“ + „°C“).
- Ableitung von `T. Alpha` und `Alpha` aus `dL/Lo` + Probenlänge, wenn nicht exportiert.
- Persistenz der Messpunkte.

## C. NETZSCH STA / DSC

Bereits möglich: nichts spezifisch.

Fehlt: derselbe Importer-Pfad plus DSC-spezifische Kopffelder (Einwaage, Tiegel, Gase, `#EXO`) und die sieben Kanäle – alles dynamisch aus dem Spaltenkopf, ohne feste Spaltenliste im Frontend.


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
