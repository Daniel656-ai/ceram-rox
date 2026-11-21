# Gefundene Fehler (Aufgabe 021)

Fehler, die beim Schreiben der Tests auffallen, werden hier gesammelt und **nicht** nebenbei behoben (siehe `docs/tests.md`, Abschnitt „Bekannte Fehler“). Nach Durchsicht durch Daniel wird je Fehler ein GitHub-Issue mit Label `bug` angelegt (Vorlage `.github/ISSUE_TEMPLATE/bug.md`).

| Nr | Bereich | Kurzbeschreibung | Schweregrad | Test (Markierung) | Issue | Status |
|---|---|---|---|---|---|---|
| F-3 | Formulare / Formel-Engine | `ROUND(feld, n)` liefert bei leerem Feld den Wert `n` statt leer | hoch | `src/test/formulaEngineVerhalten.test.ts` › „ROUND eines leeren Feldes bleibt leer …“ (`it.fails`) | – | offen |
| F-4 | Formulare / Formel-Engine | Feldwert nur aus Leerzeichen zählt als 0 statt als leer | niedrig | `src/test/formulaEngineVerhalten.test.ts` › „behandelt einen Feldwert nur aus Leerzeichen wie einen leeren Wert statt als 0“ (`it.fails`) | – | offen |

## F-3: `ROUND(feld, n)` liefert bei leerem Feld den Wert `n` statt leer

- **Bereich:** Formulare / Formel-Engine
- **Datei:** `src/lib/formulaEngine.ts:75` (`ROUND`, zusammen mit `flat()` in Zeile 25)
- **Beschreibung:** `flat()` entfernt fehlende Werte (NaN) aus der Argumentliste. Bei `ROUND(a, 2)` mit leerem `a` bleibt nur `[2]` übrig; `ROUND` liest das als `x = 2`, `n = 0` und liefert `2`. Ein fehlender Messwert erscheint so als scheinbar gültiges Ergebnis. Laut Kommentar (Zeile 41) sollen fehlende Werte „unvollständig“ bleiben.
- **Schritte zum Nachstellen:**
  1. `evaluateFormula("ROUND(a, 2)", { a: "" })` (gleich mit `a: null`)
- **Erwartet:** `{ value: null, error: null }` (Berechnung unvollständig)
- **Tatsächlich:** `{ value: 2, error: null }`
- **Schweregrad:** hoch (falscher Zahlenwert statt leerem Ergebnis, betrifft jede Rundungsformel auf ein noch leeres Feld)
- **Test:** `src/test/formulaEngineVerhalten.test.ts` › „ROUND eines leeren Feldes bleibt leer, statt die Nachkommastellen als Wert zu liefern“ (`it.fails`)
- **Issue:** –
- **Status:** offen

## F-4: Feldwert nur aus Leerzeichen zählt als 0 statt als leer

- **Bereich:** Formulare / Formel-Engine
- **Datei:** `src/lib/formulaEngine.ts:217` (`toNumber`)
- **Beschreibung:** `toNumber` behandelt `""` als fehlenden Wert, entfernt aber bei `"   "` erst danach die Leerzeichen; `Number("")` ergibt `0`. Ein Feld, das nur Leerzeichen enthält, rechnet daher mit 0 statt als leer zu gelten.
- **Schritte zum Nachstellen:**
  1. `evaluateFormula("a + 1", { a: "   " })`
- **Erwartet:** `{ value: null, error: null }` wie bei `a: ""`
- **Tatsächlich:** `{ value: 1, error: null }`
- **Schweregrad:** niedrig
- **Test:** `src/test/formulaEngineVerhalten.test.ts` › „behandelt einen Feldwert nur aus Leerzeichen wie einen leeren Wert statt als 0“ (`it.fails`)
- **Issue:** –
- **Status:** offen

## Flackernde Tests (beobachtet, kein Anwendungsfehler nachgewiesen)

Tests, die im Volllauf gelegentlich rot und einzeln grün sind. Sie werden nicht markiert, solange kein Fehler in der Anwendung nachgewiesen ist. Jedes Auftreten wird hier vermerkt.

| Test | Auftreten | Fehlerbild | Einzellauf | Vermutung |
|---|---|---|---|---|
| `src/test/orderEditPage.test.tsx` › „3c: Häkchen entfernen -> Dienstleistung zum Entfernen vorgemerkt (mit Begründung), Formularwert und Entfernen gehen gemeinsam“ | 2026-11-21, Volllauf auf `improve/tests-ergebnisse` (1928/1929) | Text „Dienstleistung(en) entfernt: BET (1 Aufgabe)“ nicht gefunden | 21/21 grün | Zeitverhalten unter Last im parallelen Volllauf (schwere Seite `CreateOrderPage`). Vermutlich derselbe Test wie der einmalige Fehlschlag im Review von PR #2 (dort nicht benannt). |

<!--
Vorlage je Fehler:

## F-<nr>: <Kurzbeschreibung>

- **Bereich:**
- **Datei:** `pfad:zeile`
- **Beschreibung:**
- **Schritte zum Nachstellen:**
  1.
- **Erwartet:**
- **Tatsächlich:**
- **Schweregrad:** kritisch | hoch | mittel | niedrig
- **Test:** `datei › testname` (`it.fails` / `skip`)
- **Issue:** #
- **Status:** offen | Issue angelegt | behoben
-->
