# Gefundene Fehler (Aufgabe 021)

Fehler, die beim Schreiben der Tests auffallen, werden hier gesammelt und **nicht** nebenbei behoben (siehe `docs/tests.md`, Abschnitt „Bekannte Fehler“). Nach Durchsicht durch Daniel wird je Fehler ein GitHub-Issue mit Label `bug` angelegt (Vorlage `.github/ISSUE_TEMPLATE/bug.md`).

| Nr | Bereich | Kurzbeschreibung | Schweregrad | Test (Markierung) | Issue | Status |
|---|---|---|---|---|---|---|
| F-1 | Messungen/Ergebnisse | Rechenwert mit fehlender Eingabe gilt weiter als offizielles Ergebnis (klassisches Formular) | hoch | `src/test/officialResultsVerhalten.test.ts` › „liefert einen gespeicherten Rechenwert nicht mehr als offizielles Ergebnis, wenn eine Eingabe fehlt“ (`it.fails`) | – | offen |
| F-2 | Messungen/Ergebnisse | Leere Textwerte uneinheitlich: Aggregation liefert `""`, Ergebnisstruktur `null` | niedrig | kein Test (Verhalten bewusst nicht festgeschrieben) | – | offen |
| F-3 | Formulare / Formel-Engine | `ROUND(feld, n)` liefert bei leerem Feld den Wert `n` statt leer | hoch | `src/test/formulaEngineVerhalten.test.ts` › „ROUND eines leeren Feldes bleibt leer …“ (`it.fails`) | – | offen |
| F-4 | Formulare / Formel-Engine | Feldwert nur aus Leerzeichen zählt als 0 statt als leer | niedrig | `src/test/formulaEngineVerhalten.test.ts` › „behandelt einen Feldwert nur aus Leerzeichen wie einen leeren Wert statt als 0“ (`it.fails`) | – | offen |

## F-1: Rechenwert mit fehlender Eingabe gilt weiter als offizielles Ergebnis

- **Bereich:** Messungen/Ergebnisse (klassisches Dienstleistungsformular)
- **Datei:** `src/lib/officialResults.ts:509` (`buildServiceResultCandidates`, `if (result.value == null || result.error) continue;`)
- **Beschreibung:** Ist eine Eingabe eines Rechenfelds leer, liefert die Formel keinen Wert. Der Zweig überspringt dann nur das Rechenfeld, ein früher gespeicherter Wert in `taskValues` bleibt in `resolved` stehen. Er wird weiter als offizielles Ergebnis ohne Fehler geliefert. Bei verknüpften Formularen (`buildLinkedFormResultCandidates`) ergibt derselbe Fall `null`.
- **Schritte zum Nachstellen:**
  1. Felder `a`, `b` und Rechenfeld `produkt` mit Formel `a * b`, `is_result: true`
  2. `buildServiceResultCandidates(felder, { a: 2, produkt: 99 })` (`b` fehlt)
- **Erwartet:** wie bei verknüpften Formularen `value: null` bzw. kein offizielles Ergebnis
- **Tatsächlich:** `{ value: 99, official: true, error: null }`
- **Schweregrad:** hoch (veralteter Wert erscheint als offizielles Ergebnis)
- **Test:** `src/test/officialResultsVerhalten.test.ts` › „liefert einen gespeicherten Rechenwert nicht mehr als offizielles Ergebnis, wenn eine Eingabe fehlt“ (`it.fails`; Gegenprobe: mit probeweiser Korrektur wird der Test rot)
- **Issue:** –
- **Status:** offen

## F-2: Leere Textwerte uneinheitlich (`""` vs. `null`)

- **Bereich:** Messungen/Ergebnisse (Ergebnisanzeige im Auftrag)
- **Datei:** `src/lib/orderResultsAggregation.ts:112` gegenüber `src/lib/orderResultsStructure.ts:137`
- **Beschreibung:** Für ein Ergebnis mit `value: ""` setzt die Auftrags-Ergebnisaggregation `text: ""`, die Auftrags-Ergebnisstruktur `text: null` (dort wird `""` ausdrücklich ausgeschlossen). Je nach Ansicht erscheint ein leerer Wert also als leerer Text oder als „kein Wert“.
- **Schritte zum Nachstellen:**
  1. Offizielles Ergebnis mit `value: ""`
  2. `buildOrderResultGroups(...)` → Zelle `{ value: null, text: "" }`
  3. `buildOrderResultStructure(...)` → Wert `{ value: null, text: null }`
- **Erwartet:** einheitliche Darstellung eines leeren Werts (vermutlich `null`)
- **Tatsächlich:** `""` bzw. `null`
- **Schweregrad:** niedrig
- **Test:** keiner (Verhalten bewusst nicht festgeschrieben)
- **Issue:** –
- **Status:** offen

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
| `src/test/orderEditPage.test.tsx` › „3c: Häkchen wieder setzen nimmt das vorgemerkte Entfernen zurück“ | 2026-11-21, Volllauf auf `improve/tests-formulare` (2076/2077) | `Unable to find role="alert"` | 21/21 grün | Wie oben, Nachbartest in derselben Datei. Die ganze Datei `orderEditPage.test.tsx` scheint unter Last anfällig. |

## Hinweise fürs Aufräumen (keine Fehler)

| Datei | Hinweis |
|---|---|
| `src/lib/api/measurements.ts:47` (`listUnassignedQualified`) | Die Abfrage auf `order_measurements` wird auch ohne Kompetenz zusammengebaut und dann verworfen (`return []`). Harmlos, aber unnötig: die Prüfung `serviceIds.length === 0` gehört vor den Aufbau der Abfrage. |

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
