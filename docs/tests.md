# Tests

## Tests starten

| Zweck | Befehl | Dauer (ca.) |
|---|---|---|
| Volllauf aller Tests | `npm test` | 5 min |
| Typprüfung | `npm run typecheck` | 2 min |
| eine Datei | `npx vitest run src/test/orderEdit.test.ts` | Sekunden |
| nach Testname filtern | `npx vitest run -t "Auftrag löschen"` | |
| Beobachtungsmodus beim Schreiben | `npm run test:watch` | |

- Voraussetzung: `npm ci` (Node LTS wie in `.github/workflows/dev-web.yml`).
- Konfiguration: `vitest.config.ts` (jsdom, `globals`, Zeitlimit 20 s), Setup: `src/test/setup.ts`.
- Testdateien: `src/**/*.test.ts(x)`. Neue Tests liegen in `src/test/` oder neben dem Code in einem `__tests__`-Ordner.
- Vor jedem Merge führt der Subagent `test-runner` den Volllauf und die Typprüfung aus (siehe `CLAUDE.md`). Die GitHub-Action `.github/workflows/tests.yml` macht dasselbe bei jedem Push und PR auf `main`.
- Überblick, welche Funktionalität durch welche Tests abgesichert ist: `tasks/Tests.md`.

## Qualitätsstandards

Jeder Test erfüllt alle Punkte:

1. **Verhalten statt Interna.** Der Test prüft, was ein Benutzer oder Aufrufer sieht: Rückgabewerte, gerenderter Text, ausgelöste Aufrufe an die API-Schicht. Er prüft keine privaten Hilfsfunktionen, internen Zustände oder CSS-Klassen. So bricht er beim Aufräumen nur, wenn sich das Verhalten wirklich ändert.
2. **Eindeutiger deutscher Name.** Am Namen erkennt man, was geprüft wird und welches Ergebnis erwartet wird, z. B. `it("lehnt das Löschen ab, wenn der Auftrag schon Messergebnisse hat")`. Das `describe` nennt die Funktionalität.
3. **Unabhängig und deterministisch.**
   - Keine echte Uhrzeit: `vi.useFakeTimers()` und `vi.setSystemTime(...)`.
   - Kein Zufall: feste Werte, `Math.random`/`crypto.randomUUID` bei Bedarf stubben.
   - Keine Reihenfolge-Abhängigkeit: jeder Test baut seine Daten selbst auf und räumt auf (`afterEach`: `cleanup()`, `localStorage.clear()`, `vi.restoreAllMocks()`).
   - Kein Netzwerk und keine echte Datenbank: Der Datenzugriff läuft über `src/lib/api/*` und wird per `vi.mock` ersetzt (Beispiel: `src/lib/api/__tests__/orderDeletion.test.ts`).
4. **Grenz- und Fehlerfälle.** Neben dem Normalfall immer die passenden Ränder prüfen: leer, ungültig, fehlende Rechte, vorläufig/offiziell, Grenzwerte, doppelte Einträge, Fehler der API.
5. **Kein Test, der immer grün ist.** Jeder neue Test muss nachweislich fehlschlagen, wenn die geprüfte Logik kaputt ist. Kurz gegenprüfen: die Logik lokal absichtlich verändern (z. B. Bedingung umdrehen), den Test rot sehen, die Änderung zurücknehmen. Diese Änderung wird nie committet.
6. **DB-Logik nur gegen die Testdatenbank.** Funktionen, Trigger und RLS werden gegen eine lokale PGlite-Datenbank geprüft, die alle Migrationen aus `supabase/migrations` und `drizzle/migrations` abspielt. Nie gegen die Dev- oder Produktions-DB.

## Bekannte Fehler

Zeigt ein Test einen echten Fehler in der Anwendung, wird der Fehler nicht nebenbei behoben. Stattdessen:

1. Den Fehler in `tasks/Fehler.md` eintragen (Nummer `F-<nr>`, Bereich, Beschreibung, Schritte zum Nachstellen, erwartet/tatsächlich, Schweregrad, Datei) und daraus ein GitHub-Issue mit Label `bug` anlegen (Vorlage `.github/ISSUE_TEMPLATE/bug.md`).
2. Den Test so markieren, dass der Lauf grün bleibt und der Fehler sichtbar ist:
   ```ts
   // Bekannter Fehler: tasks/Fehler.md#F-3 (Issue #12)
   it.fails("übernimmt die Priorität auch bei Legacy-Werten", () => { … });
   ```
   - `it.fails` verwenden, wenn der Test zuverlässig fehlschlägt. Er wird dann rot, sobald der Fehler behoben ist, und erinnert daran, die Markierung zu entfernen.
   - `it.skip` nur, wenn `fails` nicht geht (z. B. Absturz oder Zeitüberschreitung).
3. Nach der Behebung die Markierung entfernen und den Eintrag in `tasks/Fehler.md` auf „behoben“ setzen.

## Was nicht in einen Test gehört

- Echte Zugangsdaten, URLs der Dev- oder Produktions-DB, personenbezogene Echtdaten. Testdaten sind erfunden oder anonymisiert.
- Snapshots ganzer Seiten. Sie brechen bei jeder Gestaltungsänderung und prüfen kein Verhalten.
