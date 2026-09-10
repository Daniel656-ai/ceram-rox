---
name: Messdatenimport → offizielle Ergebnisse (eine Datenquelle)
description: Importierte Messwerte werden gebündelt in die Messung geschrieben und sofort über persistResults() in measurement_results gespeichert
type: feature
---

- Es gibt genau EINE Ergebnispersistenz: `measurement_results`, befüllt durch `persistResults()` in `TaskExecutionPage.tsx` über `buildServiceResultCandidates` / `buildLinkedFormResultCandidates`. Keine parallele RFA-Ergebnisstruktur.
- Messblock-/Repeater-Einträge dürfen NIE mit mehreren Einzelaufrufen von `scope.set` beschrieben werden: jeder Aufruf merged in denselben veralteten Eintrag, nur der letzte Wert überlebt. Für Mehrfachschreibvorgänge `setMany` / `useScopeBatchWriter` verwenden (Import schreibt Messwerte + Importprotokoll gemeinsam).
- Nach `onApply` des Importdialogs und nach manuellem „Zuordnen…“ ruft der Import `RuntimeMeasurementContext.persistResults?.()` auf; die Ergebnisse sind damit ohne zusätzlichen Speichern-Klick im Auftrag und in der Ergebnisdatenbank sichtbar. Der Callback wird nur bei bearbeitbarer, nicht abgeschlossener Messung bereitgestellt.
- Wert 0 bleibt erhalten (definierte Messfall-Elemente); nur zusätzliche dynamische Elemente brauchen Wert > 0.
