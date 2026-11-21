# Gefundene Fehler (Aufgabe 021)

Fehler, die beim Schreiben der Tests auffallen, werden hier gesammelt und **nicht** nebenbei behoben (siehe `docs/tests.md`, Abschnitt „Bekannte Fehler“). Nach Durchsicht durch Daniel wird je Fehler ein GitHub-Issue mit Label `bug` angelegt (Vorlage `.github/ISSUE_TEMPLATE/bug.md`).

| Nr | Bereich | Kurzbeschreibung | Schweregrad | Test (Markierung) | Issue | Status |
|---|---|---|---|---|---|---|
| – | – | bisher keine | – | – | – | – |

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
