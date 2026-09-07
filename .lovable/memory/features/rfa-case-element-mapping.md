---
name: RFA-Zuordnung über Messkontext-Schlüssel
description: Messfall-Messkontext liefert die benötigten Element-Schlüssel; Importspalten werden ohne Einheit darüber den Ergebnisfeldern zugeordnet
type: feature
---

- Ablauf: Auftrag → Messfall → Messkontext („Vorgabewerte“) → Schlüssel (`V2O5`, `WO3`, `As`) → RFA-Spalte → Ergebnisfeld → Messwert. Keine zweite Datenstruktur, keine hartkodierten Elemente.
- `caseElementKeys(context)` in `src/lib/measurementBlocks.ts` liest die Element-Schlüssel aus den Messkontext-Schlüsseln; sie werden als `CASE_ELEMENTS_KEY` im Messblock-Eintrag mitgeführt und im `FormLayoutRenderer` an den Importdialog gereicht.
- `mapReadings(..., { caseElementKeys })`: ist die Liste gefüllt, werden nur diese Elemente übernommen; alle anderen Spalten werden ignoriert (kein Fehler).
- Spaltenüberschriften werden vor dem Matching normalisiert: Einheit in Klammern/angehängt (`(%)`, `(PPM)`, `mg/kg`), Leerzeichen, Groß-/Kleinschreibung. `V2O5 (%)` → `V2O5`, `As (PPM)` → `As` (`stripUnitSuffix` in `elementKeys.ts`).
- Diagnose: `mappingReport(rows, targets)` liefert je Spalte „Überschrift → Element → Messkontext → Ergebnisfeld → Wert“; im Importdialog als aufklappbares Zuordnungsprotokoll sichtbar.
