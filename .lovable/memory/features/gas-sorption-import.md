
## Micromeritics .REP/.SMP (validiert an Realdateien, 08/2026)
- `.REP` (Reportdatei) ist der **Ergebnisträger**: Labels und Werte stehen in zwei aufeinanderfolgenden,
  gleich langen Datensatzgruppen (Gruppenkopf `00000000 01000000 <count>`, Records `E0 01 00 <len> <utf16le>`).
  Ausgewertet in `src/lib/instrumentImport/gasSorption/micromeriticsRecords.ts`.
- `.SMP` (Messdatei) enthält nur Geräte-/Analyseeinstellungen und Probenangaben (Wertblock steht VOR dem
  Labelblock) – **keine** Ergebnisse und keine Isothermenpunkte. Der Import weist darauf hin, zusätzlich die
  `.REP` zu laden.
- Analysebedingungen (Einwaage, Badtemperatur, Free Space, Equilibrierintervall, Probendichte, Degas …)
  gelten als Metadaten, nie als Ergebniswerte.
