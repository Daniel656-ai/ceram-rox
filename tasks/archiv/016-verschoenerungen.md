# Aufgabe 016: Verschönerungen Ergebnisdatenbank

Branch: `improve/verschoenerungen-ergebnisdb`. Regeln: `docs/gestaltungsregeln.md`. Keine neuen Umschalter, keine Änderung an Rechten/RLS/Datenbank.

## Stand

| # | Punkt | Stand |
|---|---|---|
| 1 | Auftragsübersicht: Spalte „Proben“ entfernen (Angabe neben der Auftragsnummer bleibt) | umgesetzt |
| 2 | Probendetail: Reiter „Formular“ und Reiterleiste entfernen, Werte direkt zeigen | umgesetzt |
| 3 | Status-Badges auf Deutsch („completed“ → „abgeschlossen“ usw.) | umgesetzt (`src/lib/results/statusLabels.ts`) |
| 4 | BET nur als Ergebnis (Probe \| BET [m²/g]), keine Hilfswerte; Erkennung über Messart + Feldzuordnung; Excel nur BET-Wert; Regel „BET“ in `docs/gestaltungsregeln.md` | wartet auf `tasks/016-bet-varianten.csv` |

## Zu Punkt 4 (BET)
- Abfrage für die Dev-DB: `tasks/archiv/016-bet-varianten.sql` (nur SELECT, eine Abfrage, alle Feldnamen/Beschriftungen/Einheiten je Formularversion).
- Ergebnis als `tasks/016-bet-varianten.csv` ablegen (ohne Zeilenlimit). Danach: Varianten erklären, Zuordnung umsetzen, Tests, Reviewer, Vorschau.
- Hilfswerte (Tara, Brutto, Probengewicht, Rohr-Nr., SMP-Nummer …) bleiben in der Datenbank gespeichert – sie werden nur nicht angezeigt.

## Nachtrag
- Punkte 1–3: gemergt (`improve/verschoenerungen-ergebnisdb`).
- Punkt 4 BET: umgesetzt auf `improve/bet-darstellung` (Erkennung `src/lib/results/betMeasurement.ts`, Regel „BET“ in `docs/gestaltungsregeln.md`). Formular „BET (v1)“: Ergebnisfeld `spezifische_oberflache_bet` (m²/g); Hilfswerte `ges_gewicht_brutto`, `leergewicht_tara`, `probengewicht_netto`, `rohr_nr`, `smp_nummer`; Importinfo im Block `messdatenimport`.
