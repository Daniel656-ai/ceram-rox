---
name: Platten-Geometrievermessung (BENCH NOx / BENCH SOx)
description: Gemeinsame Plattengeometrie je Probe, getrennt von der Wabenkörper-Geometrie
type: feature
---

- Geometriedaten liegen je Probe + Geometrieart in `sample_geometry_datasets` (unique `sample_id, geometry_kind`). Arten: `wabenkoerper` (bestehend, Mikroskop-Import, unverändert) und `platte`.
- Regel: gleiche Probe + gleiche Geometrieart → gemeinsamer Datensatz (BENCH NOx + BENCH SOx teilen sich eine Plattengeometrie); gleiche Probe + andere Geometrieart → getrennt (NOx-Wabenkörper wird nie überschrieben).
- Zuordnung Dienstleistung → Geometrieart zentral in `src/lib/geometry/kinds.ts` (BENCH-Präfix = Platte).
- Formeln zentral in `src/lib/geometry/plate.ts` (`PLATE_GEOMETRY_CALCULATIONS`, Formel-Engine): Modulbreite, Modulvolumen (Reaktorquerschnitt aus Stammdaten), Oberfläche, Ap, ε. Mittelwerte ignorieren fehlende Werte, nie 0.
- UI: `src/components/geometry/SampleGeometryCard.tsx` + `PlateGeometrySection.tsx`, eingebunden in `TaskExecutionPage`. Zeilenanzahl folgt der Plattenanzahl.
- Tests: `src/test/plateGeometry.test.ts`.
