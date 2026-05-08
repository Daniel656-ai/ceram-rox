## Ziel
Die Tabelle "Meine Aufgaben" (Rolle Messdienstleister) nach den vier vorgegebenen Regeln sortieren.

## Sortier-Reihenfolge (Priorität von oben nach unten)

1. **Status "abgeschlossen" nach unten** – `completed` immer ans Tabellenende, unabhängig von allen anderen Regeln.
2. **Überfällige Messungen ganz nach oben** – alle Messungen mit `due_date < heute` (und nicht abgeschlossen) werden vor allen nicht-überfälligen einsortiert. Innerhalb der Überfälligen: ältestes Datum zuerst (am längsten überfällig oben).
3. **Priorität (ranking)** – `1` vor `2` vor `3`, kein Ranking zuletzt.
4. **Auftragstyp** – `Produktionsauftrag` vor `Kundenauftrag` und `F&E-Auftrag`.
5. **Fälligkeit** – je näher am heutigen Datum, desto weiter oben (aufsteigend nach `due_date`); Messungen ohne Fälligkeitsdatum ans Ende dieser Gruppe.

## Technische Umsetzung

- Anpassung in `src/hooks/useMeasurements.ts` in `useMyMeasurements` → `merged.sort(...)`.
- `order_type` ist bereits über `measurement_orders(*)` im Select enthalten, keine zusätzliche Query nötig.
- Vergleichsfunktion in der Reihenfolge: completed-Flag → overdue-Flag → ranking → order_type-Gewicht (Produktion=0, sonst=1) → due_date asc.
- Heutiges Datum als `YYYY-MM-DD` String, Vergleich per `localeCompare` konsistent zur bestehenden Logik.

## Nicht betroffen
- UI / Spaltenlayout der Tabelle bleibt unverändert.
- Andere Rollen/Tabellen werden nicht verändert.
