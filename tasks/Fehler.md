# Gefundene Fehler (Aufgabe 021)

Fehler, die beim Schreiben der Tests auffallen, werden hier gesammelt und **nicht** nebenbei behoben (siehe `docs/tests.md`, Abschnitt „Bekannte Fehler“). Nach Durchsicht durch Daniel wird je Fehler ein GitHub-Issue mit Label `bug` angelegt (Vorlage `.github/ISSUE_TEMPLATE/bug.md`). Für F-1 bis F-12 sind das die Issues #3 bis #14 (angelegt am 2026-11-21).

| Nr | Bereich | Kurzbeschreibung | Schweregrad | Test (Markierung) | Issue | Status |
|---|---|---|---|---|---|---|
| F-1 | Messungen/Ergebnisse | Rechenwert mit fehlender Eingabe gilt weiter als offizielles Ergebnis (klassisches Formular) | hoch | `src/test/officialResultsVerhalten.test.ts` › „liefert einen gespeicherten Rechenwert nicht mehr als offizielles Ergebnis, wenn eine Eingabe fehlt“ (normaler Test, vormals `it.fails`) | #3 | behoben (Branch fix/f1-rechenwert-fehlende-eingabe) |
| F-2 | Messungen/Ergebnisse | Leere Textwerte uneinheitlich: Aggregation liefert `""`, Ergebnisstruktur `null` | niedrig | kein Test (Verhalten bewusst nicht festgeschrieben) | #4 | Issue angelegt |
| F-3 | Formulare / Formel-Engine | `ROUND(feld, n)` liefert bei leerem Feld den Wert `n` statt leer | hoch | `src/test/formulaEngineVerhalten.test.ts` › „ROUND eines leeren Feldes bleibt leer …“ (`it.fails`) | #5 | Issue angelegt |
| F-4 | Formulare / Formel-Engine | Feldwert nur aus Leerzeichen zählt als 0 statt als leer | niedrig | `src/test/formulaEngineVerhalten.test.ts` › „behandelt einen Feldwert nur aus Leerzeichen wie einen leeren Wert statt als 0“ (`it.fails`) | #6 | Issue angelegt |
| F-5 | Formulare / Formel-Engine | `ROUND(a, n)` mit leerem `n` rundet still auf eine ganze Zahl | mittel | `src/test/formulaEngineVerhalten.test.ts` › „ROUND mit leerer Stellenzahl meldet einen Fehler …“ (`it.fails`) | #7 | Issue angelegt |
| F-6 | Formulare / Formel-Engine | `ROUND` rundet nicht wie Excel (negative Hälften, Gleitkomma) | mittel | `src/test/formulaEngineVerhalten.test.ts` › „ROUND rundet negative Hälften wie Excel …“, „ROUND rundet wie Excel ohne Gleitkomma-Abweichung …“ (2 × `it.fails`) | #8 | Issue angelegt |
| F-7 | Formulare / Formel-Engine | Feldwert im englischen Format `"1,234.5"` wird still als 1 gelesen | mittel | `src/test/formulaEngineVerhalten.test.ts` › „meldet einen Feldwert im englischen Format …“ (`it.fails`) | #9 | Issue angelegt |
| F-8 | Formulare / Formel-Engine | `1.2.3` in der Formel ergibt keinen Wert und keine Fehlermeldung | niedrig | `src/test/formulaEngineVerhalten.test.ts` › „meldet eine Zahl mit zwei Dezimalpunkten …“ (`it.fails`) | #10 | Issue angelegt |
| F-9 | Formulare / Bericht | Format „auto“ kürzt Zahlen auf 3 Nachkommastellen statt die Nachkommastellen des Feldes zu verwenden | niedrig | `src/test/reportPlaceholdersVerhalten.test.ts` › „zeigt den Wert eines Feldes mit 4 Nachkommastellen im Format „auto“ ungekürzt“ (`it.fails`) | #11 | Issue angelegt |
| F-10 | Formulare / Bericht | Ungültiges Datum erscheint als „Invalid Date“; reines Datum wird mit Uhrzeit und je nach Zeitzone mit Vortag angezeigt | mittel | `src/test/reportPlaceholdersVerhalten.test.ts` › „zeigt ein ungültiges Datum nicht als „Invalid Date“ …“, „zeigt ein reines Datum ohne Uhrzeit und ohne Tagesverschiebung (Platzhalter)“, „… (Feldkatalog, Format „auto“)“ (3 × `it.fails`) | #12 | Issue angelegt |
| F-11 | Formulare / Validierung | Pflichtregel akzeptiert Wert nur aus Leerzeichen; Bereichsprüfung übergeht `"1.234,5"` | mittel | `src/test/globalValidation.test.ts` › „meldet einen Wert nur aus Leerzeichen als fehlende Pflichtangabe“, „prüft auch Werte im deutschen Tausenderformat (1.234,5) gegen die Obergrenze“ (2 × `it.fails`) | #13 | Issue angelegt |
| F-12 | Formulare / Formulardesigner | `slugify` verliert ß und kann auf `_` enden | niedrig | `src/test/formFieldTypes.test.ts` › „ersetzt ß durch ss, statt es wegzulassen“, „endet auch nach dem Kürzen auf 60 Zeichen nicht auf einem Unterstrich“ (2 × `it.fails`) | #14 | Issue angelegt |

## F-1: Rechenwert mit fehlender Eingabe gilt weiter als offizielles Ergebnis

- **Bereich:** Messungen/Ergebnisse (klassisches Dienstleistungsformular)
- **Datei:** `src/lib/officialResults.ts:512` (`buildServiceResultCandidates`, `if (result.value == null || result.error) continue;`)
- **Beschreibung:** Ist eine Eingabe eines Rechenfelds leer, liefert die Formel keinen Wert. Der Zweig überspringt dann nur das Rechenfeld, ein früher gespeicherter Wert in `taskValues` bleibt in `resolved` stehen. Er wird weiter als offizielles Ergebnis ohne Fehler geliefert. Bei verknüpften Formularen (`buildLinkedFormResultCandidates`) ergibt derselbe Fall `null`.
- **Schritte zum Nachstellen:**
  1. Felder `a`, `b` und Rechenfeld `produkt` mit Formel `a * b`, `is_result: true`
  2. `buildServiceResultCandidates(felder, { a: 2, produkt: 99 })` (`b` fehlt)
- **Erwartet:** wie bei verknüpften Formularen `value: null` bzw. kein offizielles Ergebnis
- **Tatsächlich:** `{ value: 99, official: true, error: null }`
- **Schweregrad:** hoch (veralteter Wert erscheint als offizielles Ergebnis)
- **Test:** `src/test/officialResultsVerhalten.test.ts` › „liefert einen gespeicherten Rechenwert nicht mehr als offizielles Ergebnis, wenn eine Eingabe fehlt“ (`it.fails`; Gegenprobe: mit probeweiser Korrektur wird der Test rot)
- **Issue:** #3
- **Status:** behoben (Branch `fix/f1-rechenwert-fehlende-eingabe`)
- **Behebung:** Fehlt eine Eingabe oder ist die Formel fehlerhaft, wird ein früher gespeicherter Wert des Rechenfelds verworfen (`officialResults.ts`). Das Rechenfeld liefert dann keinen Wert (leer), verknüpfte Formulare taten das schon. Test jetzt ein normaler Test, dazu 2 neue Tests und ein Absicherungstest für verknüpfte Formulare.

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
- **Issue:** #4
- **Status:** Issue angelegt

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
- **Issue:** #5
- **Status:** Issue angelegt

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
- **Issue:** #6
- **Status:** Issue angelegt

## F-5: `ROUND(a, n)` mit leerem `n` rundet still auf eine ganze Zahl

- **Bereich:** Formulare / Formel-Engine
- **Datei:** `src/lib/formulaEngine.ts:75` (`ROUND`, zusammen mit `flat()` in Zeile 25)
- **Beschreibung:** `flat()` entfernt die leere Stellenzahl; `ROUND` nimmt dann `n = 0` an und rundet auf eine ganze Zahl. Grundsatz (Entscheidung Daniel): nie stillschweigend einen falschen Wert liefern – lieber leer oder Fehlermeldung.
- **Schritte zum Nachstellen:**
  1. `evaluateFormula("ROUND(a, n)", { a: 2.567, n: "" })`
- **Erwartet:** Fehlermeldung (z. B. „Stellenzahl fehlt“), kein Wert
- **Tatsächlich:** `{ value: 3, error: null }`
- **Schweregrad:** mittel
- **Test:** `src/test/formulaEngineVerhalten.test.ts` › „ROUND mit leerer Stellenzahl meldet einen Fehler statt still auf eine ganze Zahl zu runden“ (`it.fails`)
- **Issue:** #7
- **Status:** Issue angelegt

## F-6: `ROUND` rundet nicht wie Excel (kaufmännisch)

- **Bereich:** Formulare / Formel-Engine
- **Datei:** `src/lib/formulaEngine.ts:79` (`Math.round(x * p) / p`)
- **Beschreibung:** `Math.round` rundet Hälften Richtung +∞, und `x * 10^n` hat Gleitkomma-Fehler. Gewünscht ist kaufmännisches Runden wie in Excel (Hälften von der Null weg, ohne Gleitkomma-Abweichung).
- **Schritte zum Nachstellen:**
  1. `evaluateFormula("ROUND(-2.5)", {})`
  2. `evaluateFormula("ROUND(1.005; 2)", {})`
- **Erwartet:** −3 bzw. 1,01
- **Tatsächlich:** −2 bzw. 1
- **Schweregrad:** mittel
- **Test:** `src/test/formulaEngineVerhalten.test.ts` › „ROUND rundet negative Hälften wie Excel von der Null weg: ROUND(-2.5) = -3“ und „ROUND rundet wie Excel ohne Gleitkomma-Abweichung: ROUND(1.005; 2) = 1,01“ (2 × `it.fails`)
- **Issue:** #8
- **Status:** Issue angelegt

## F-7: Feldwert im englischen Format wird still als 1 gelesen

- **Bereich:** Formulare / Formel-Engine
- **Datei:** `src/lib/formulaEngine.ts:217` (`toNumber`)
- **Beschreibung:** Bei `"1,234.5"` steht das Komma vor dem Punkt, daher wird nicht normalisiert; `Number()` scheitert und der Rückfall „führende Zahl“ nimmt `1`. Die Berechnung läuft mit einem falschen Wert weiter.
- **Schritte zum Nachstellen:**
  1. `evaluateFormula("a + 0", { a: "1,234.5" })`
- **Erwartet:** Fehlermeldung (Zahlenformat nicht eindeutig), kein Wert
- **Tatsächlich:** `{ value: 1, error: null }`
- **Schweregrad:** mittel
- **Test:** `src/test/formulaEngineVerhalten.test.ts` › „meldet einen Feldwert im englischen Format (1,234.5) als Fehler statt still mit 1 zu rechnen“ (`it.fails`)
- **Issue:** #9
- **Status:** Issue angelegt

## F-8: `1.2.3` in der Formel ohne Fehlermeldung

- **Bereich:** Formulare / Formel-Engine
- **Datei:** `src/lib/formulaEngine.ts:285-290` (Tokenizer, Zahlen)
- **Beschreibung:** Der Tokenizer liest `1.2.3` als eine Zahl, `Number("1.2.3")` ist NaN. Das Ergebnis ist leer wie bei einer unvollständigen Eingabe; der Tippfehler in der Formel wird nicht gemeldet.
- **Schritte zum Nachstellen:**
  1. `evaluateFormula("1.2.3 + 1", {})`
- **Erwartet:** Fehlermeldung (ungültige Zahl, mit Position)
- **Tatsächlich:** `{ value: null, error: null }`
- **Schweregrad:** niedrig
- **Test:** `src/test/formulaEngineVerhalten.test.ts` › „meldet eine Zahl mit zwei Dezimalpunkten in der Formel (1.2.3) als Fehler“ (`it.fails`)
- **Issue:** #10
- **Status:** Issue angelegt

## F-9: Bericht kürzt Zahlen im Format „auto“ auf 3 Nachkommastellen

- **Bereich:** Formulare / Bericht (Feldblock im Berichtsdesigner)
- **Datei:** `src/lib/reportFieldCatalog.ts:122-125` (`formatReportValue`, `n.toLocaleString("de-DE")` ohne Stellenangabe)
- **Beschreibung:** `toLocaleString` rundet standardmäßig auf höchstens 3 Nachkommastellen. Ein Messwert eines Feldes mit 4 Nachkommastellen erscheint im Bericht still gerundet. Gewünscht (Entscheidung Daniel): die Nachkommastellen des Feldes verwenden. Hinweis: Die Feldinformation fehlt heute auf dem Weg zum Bericht – `ReportFieldItem` und `ReportFieldFormatting` kennen keine Nachkommastellen, `src/hooks/useReportFieldCatalog.ts` gibt `decimal_places` (Formularfeld) bzw. `decimals` (globale Berechnung) nicht weiter.
- **Schritte zum Nachstellen:**
  1. Formularfeld `dichte` mit `decimal_places: 4`, Wert `2.6125`, Feldblock im Format „auto“
  2. `formatReportValue(2.6125, { unit: "g/cm³" })`
- **Erwartet:** `"2,6125 g/cm³"`
- **Tatsächlich:** `"2,613 g/cm³"`
- **Schweregrad:** niedrig
- **Test:** `src/test/reportPlaceholdersVerhalten.test.ts` › „zeigt den Wert eines Feldes mit 4 Nachkommastellen im Format „auto“ ungekürzt“ (`it.fails`)
- **Issue:** #11
- **Status:** Issue angelegt

## F-10: Datumsanzeige im Bericht: „Invalid Date“ und reines Datum mit Uhrzeit/Vortag

- **Bereich:** Formulare / Bericht (Platzhalter und Feldblöcke)
- **Datei:** `src/lib/reportPlaceholders.ts:178-179` (`formatPlaceholderValue`), `src/lib/reportFieldCatalog.ts:129-131` (`formatReportValue`, Format „auto“)
- **Beschreibung:**
  - `formatPlaceholderValue` prüft das Datum nicht auf Gültigkeit; `toLocaleString` wirft nicht, sondern liefert „Invalid Date“, der `catch`-Rückfall greift daher nie.
  - Ein reines Datum `"2025-11-04"` wird als UTC-Mitternacht gelesen und mit Uhrzeit angezeigt (Europe/Vienna „4.11.2025, 01:00:00“, UTC „4.11.2025, 00:00:00“); westlich von UTC erscheint der Vortag („3.11.2025, 19:00:00“ in America/New_York).
- **Schritte zum Nachstellen:**
  1. `formatPlaceholderValue("2025-13-45")`
  2. `formatPlaceholderValue("2025-11-04")` bzw. `formatReportValue("2025-11-04")`
- **Erwartet:** 1. der Text selbst oder „—“; 2. „4.11.2025“ in jeder Zeitzone, ohne Uhrzeit
- **Tatsächlich:** 1. „Invalid Date“; 2. „4.11.2025, 01:00:00“ (Vienna) bzw. „3.11.2025, 19:00:00“ (New York)
- **Schweregrad:** mittel
- **Test:** `src/test/reportPlaceholdersVerhalten.test.ts` › „zeigt ein ungültiges Datum nicht als „Invalid Date“, sondern als Text oder leer“, „zeigt ein reines Datum ohne Uhrzeit und ohne Tagesverschiebung (Platzhalter)“, „zeigt ein reines Datum ohne Uhrzeit und ohne Tagesverschiebung (Feldkatalog, Format „auto“)“ (3 × `it.fails`; geprüft in Europe/Vienna, UTC und America/New_York)
- **Issue:** #12
- **Status:** Issue angelegt

## F-11: Globale Validierung: Leerzeichen als Pflichtangabe, deutsches Tausenderformat ungeprüft

- **Bereich:** Formulare / Validierung
- **Datei:** `src/lib/globalValidation.ts:27` (`isEmpty`), `src/lib/globalValidation.ts:57` (Zahlumwandlung)
- **Beschreibung:**
  - `isEmpty` prüft nur auf `""`; ein Wert nur aus Leerzeichen erfüllt daher die Pflichtregel.
  - Die Zahlumwandlung ersetzt nur das erste Komma: `"1.234,5"` wird zu `"1.234.5"` und damit NaN. Nicht numerische Werte werden toleriert, die Grenze wird also gar nicht geprüft.
- **Schritte zum Nachstellen:**
  1. `evaluateValidation("   ", { rule_type: "required", … })`
  2. `evaluateValidation("1.234,5", { rule_type: "range", min_value: 0, max_value: 1000, … })`
- **Erwartet:** 1. Verstoß „Pflichtangabe.“; 2. Verstoß „Wert muss zwischen 0 und 1000 liegen.“
- **Tatsächlich:** jeweils `null` (kein Verstoß)
- **Schweregrad:** mittel
- **Test:** `src/test/globalValidation.test.ts` › „meldet einen Wert nur aus Leerzeichen als fehlende Pflichtangabe“, „prüft auch Werte im deutschen Tausenderformat (1.234,5) gegen die Obergrenze“ (2 × `it.fails`)
- **Issue:** #13
- **Status:** Issue angelegt

## F-12: `slugify` verliert ß und kann auf `_` enden

- **Bereich:** Formulare / Formulardesigner (Feldschlüssel aus Bezeichnung, `FieldEditDialog`)
- **Datei:** `src/lib/formFieldTypes.ts:50-52` (`slugify`)
- **Beschreibung:**
  - ß wird von `normalize("NFD")` nicht zerlegt und fällt als Sonderzeichen weg: „Größe“ wird zu `gro_e`.
  - Die Kürzung auf 60 Zeichen erfolgt nach dem Entfernen der Randunterstriche, ein Schlüssel kann daher auf `_` enden.
  - **Hinweis von Daniel:** Eine Korrektur darf nur neue Schlüssel betreffen, bestehende Feldschlüssel nie ändern.
- **Schritte zum Nachstellen:**
  1. `slugify("Größe")`
  2. `slugify("a".repeat(59) + " b")`
- **Erwartet:** 1. `grosse` (ß → ss, wie Umlaute ohne Punkte); 2. Schlüssel endet auf Buchstabe/Ziffer
- **Tatsächlich:** 1. `gro_e`; 2. 59 × `a` gefolgt von `_`
- **Schweregrad:** niedrig
- **Test:** `src/test/formFieldTypes.test.ts` › „ersetzt ß durch ss, statt es wegzulassen“, „endet auch nach dem Kürzen auf 60 Zeichen nicht auf einem Unterstrich“ (2 × `it.fails`)
- **Issue:** #14
- **Status:** Issue angelegt

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
| `src/lib/formulaEngine.ts:468` (`ifCall`) | Die Meldung „Zwischen den Parametern von IF() fehlt ein Komma“ ist nicht erreichbar: `captureArg` liest bis zum nächsten Komma bzw. zur Klammer, danach folgt nie ein anderes Token. Bei `IF(1 2, 3)` kommt die allgemeine Meldung „Unerwartete Eingabe nach dem Ausdruck“. Zweig entfernen oder die IF-spezifische Meldung im Teilausdruck erzeugen. |

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
