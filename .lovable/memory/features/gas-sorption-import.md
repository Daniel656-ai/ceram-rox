---
name: Gasadsorptions-Import (BET/BJH)
description: Methodenorientierter Importer „Gasadsorption“; .SMP ist primäre Quelle, .REP nur optional
type: feature
---

## Micromeritics .REP/.SMP (validiert an Realdateien, 08/2026)
- **`.SMP` ist die primäre Importquelle und genügt allein.** Sie liefert Probenname, Einwaage
  (Double direkt hinter der Beschriftung „Bar Code:“, +32 Byte), Analysebedingungen aus dem
  Protokoll (Systemvolumen, Free Space warm/kalt, Manifold-Temperatur, Port, Seriennummer,
  Software) und – falls enthalten – Isothermenpunkte. Auswertung in
  `src/lib/instrumentImport/gasSorption/smp.ts`, Metadaten landen in `headerMap`.
- Eine `.REP` darf **nie** Voraussetzung sein; sie ist optionale Zusatzquelle für bereits
  ausgewertete Kennwerte (Labels/Werte in zwei gleich langen Datensatzgruppen, Gruppenkopf
  `00000000 01000000 <count>`, Records `E0 01 00 <len> <utf16le>`) – `micromeriticsRecords.ts`.
- Analysebedingungen (Einwaage, Badtemperatur, Free Space, Equilibrierintervall, Probendichte,
  Degas …) gelten als Metadaten, nie als Ergebniswerte.
- Isothermen werden als generischer `MeasurementDataset` (Kanäle `relative_pressure`,
  `quantity_adsorbed`) übernommen, damit Diagramm/Auswertung in ROX möglich bleiben.
