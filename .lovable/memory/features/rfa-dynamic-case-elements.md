---
name: RFA Standardlos/Oberfläche – dynamische Elementliste
description: Bereichs-Messfälle zeigen immer die 17 festen Elemente, danach nur importierte Elemente mit numerischem Wert > 0
type: feature
---

- Zentral in `src/lib/rfaFixedElements.ts`: `RFA_FIXED_ELEMENTS` (17 Elemente in Reihenfolge von „Kalibrierte Elemente“, As/Pb mit Einheit ppm), `isPositiveMeasurement`, `withFixedRfaElements`.
- Gilt für jeden Messfall mit `element_range` (z. B. „B-U“ → Standardlos, Oberfläche): Ergebnisfelder = 17 feste Elemente (immer vorhanden, auch ohne Importwert) + dynamisch importierte Elemente mit numerischem Wert > 0, sortiert nach Ordnungszahl, ohne Duplikate.
- Prüfung immer auf dem Zahlenwert (0, „0,000“, leer, null → nicht übernehmen), nie auf dem Anzeigetext.
- Messfälle ohne `element_range` („Qualitätskontrolle“, „Kalibrierte Elemente“) bleiben unverändert.
- Verwendet in `buildCaseTargets` (`measurementImport.ts`) und `buildLinkedFormResultCandidates` (`officialResults.ts`). Tests: `src/test/rfaCaseImportFlow.test.ts`.
