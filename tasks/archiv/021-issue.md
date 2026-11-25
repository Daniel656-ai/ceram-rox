# Sicherheitsnetz aus Tests vor dem Aufräumen

> Angelegt als https://github.com/danielgass95-sketch/ceram-rox-dev/issues/1

## Ziel

Die Software funktioniert, aber die Codebasis ist unaufgeräumt. Bevor wir umbauen, soll jede Funktionalität durch Tests abgesichert sein, und jeder künftige Umbau wird vor dem Merge automatisch geprüft.

## Ausgangslage (Stand 2026-11-21, `main` @ `5e52dc3c`)

- 188 Testdateien mit 1807 Tests (Vitest, jsdom). Überwiegend reine Logik, das Backend ist gemockt. Dazu einige Komponenten-/Seitentests.
- Für die Datenbank gibt es keine automatischen Tests: Funktionen, Trigger und RLS sind ungetestet. 206 Migrationen in `supabase/migrations` plus 48 in `drizzle/migrations`, ca. 560 Policies (inkl. überschriebener Fassungen). Nur zwei manuelle SQL-Skripte unter `scripts/`.
- Keine E2E-Tests.
- Volllauf auf `main` ist **nicht grün**: 4 Dateien / 35 Tests rot, alle wegen `localStorage` unter Node ≥ 25.
- Typprüfung (`tsc -p tsconfig.app.json --noEmit`) läuft ohne Fehler.
- Kein CI-Lauf für Tests. `dev-web.yml` baut nach dem Merge nur die Web-Vorschau.

Details: `tasks/Tests.md` (Abschnitt „Bestand und Lücken“).

## Qualitätsstandards für jeden Test

- [ ] Prüft Verhalten aus Sicht des Benutzers bzw. der Funktion, keine internen Details. So brechen Tests beim Aufräumen nicht unnötig.
- [ ] Eindeutiger deutscher Name: was wird geprüft, was ist das erwartete Ergebnis.
- [ ] Unabhängig und deterministisch: keine echte Uhrzeit, kein Zufall, keine Abhängigkeit von der Reihenfolge, kein Netzwerk, keine echte Datenbank.
- [ ] Deckt Grenz- und Fehlerfälle ab: leer, ungültig, keine Rechte, vorläufig/offiziell usw.
- [ ] Kein Test, der immer grün ist: jeder neue Test schlägt nachweislich fehl, wenn die geprüfte Logik kaputt ist (kurz gegengeprüft).
- [ ] DB-Logik (Funktionen, Trigger, RLS) wird nur gegen eine lokale Testdatenbank geprüft (z. B. PGlite).

## Regeln

- Vor jedem Merge läuft der test-runner (Tests und Typprüfung). Bei Rot wird nicht gemergt.
- Neue oder geänderte Funktionalität braucht passende Tests (Standards in `docs/tests.md`).
- Beim Schreiben der Tests werden nur Testdateien, Test-Helfer und Test-Konfiguration geändert. Kein Anwendungscode, keine Migration, keine Daten, keine Rechte.
- Gefundene Fehler werden nicht nebenbei behoben. Sie werden in `tasks/Fehler.md` gesammelt, der Test wird als „bekannter Fehler“ markiert (`test.fails` bzw. `skip` mit Verweis), und je Fehler gibt es ein Issue mit Label `bug`.
- Je Bereich ein Branch `improve/tests-<bereich>`. Jeder Bereich braucht mindestens zwei grüne Läufe hintereinander und das APPROVED des Reviewers. Merges werden gebündelt (mehrere Bereiche pro Merge).
- Nur das Dev-Repo. Nie Ceram-Repo, Lovable oder Prod.

## Infrastruktur

- [x] Volllauf auf `main` grün (Basis für „durch Änderung kaputt“ vs. „bekannter Fehler“)
- [x] Subagent `.claude/agents/test-runner.md`
- [x] Regel in `CLAUDE.md`
- [x] `docs/tests.md` (Standards, Tests starten)
- [x] GitHub-Action: Tests und Typprüfung bei Push und PR auf `main`
- [x] Issue-Vorlage `.github/ISSUE_TEMPLATE/bug.md`
- [ ] Lokale Testdatenbank PGlite (spielt `supabase/migrations` und `drizzle/migrations` ab)

## Checkliste je Bereich (Reihenfolge nach Risiko)

- [ ] **Messungen/Ergebnisse:** vorläufig vs. offiziell (`officialResults`), Auftrags-Ergebnisaggregation, Kurven-Datensatz/Export, Messungs-API
- [ ] **Formulare:** Formel-Engine, Rechen-Bindings, Berichts-Platzhalter/Bindings, Validierung, Feldtypen, Repeater-Aggregation
- [ ] **Projekte:** Kostenaufstellung, gebuchte Leistungen/Stunden, Controlling-Export
- [ ] **Benutzer/Rechte:** Passwort-Richtlinie, Rollen, Permission-Keys Client ↔ SQL, externe Kunden, Login-Ablauf
- [ ] **Fertigungsfreigaben:** Anforderungsprüfung Fertigungsunterlagen, Statusfluss/Feldkoerzierung, Spezifikationswerte, PDF-Import-Pipeline, Freigabe-API
- [ ] **Aufträge:** Excel-Import, Workflow/Status (Client), Auftrags-API, Anlegen (Smoke-Test)
- [ ] **Lager/Rohstoffe:** Gefahrstoffklassen, Etikettenfelder/-symbole, Gebinde-API, Mischungen/Chargen-API
- [ ] **Pilot Plant:** Prozess-Engine, Step-Runs, Prozessvorlagen, Guided Stepper (alter Prozess `pilot_plant_blocks` wird nicht getestet)
- [ ] **Proben:** Etikettendruck, Proben-API, Ersatzprobe/Umhängen
- [ ] **m³-Liste:** Konstanten-Erkennung, Template, PDF-Export vertiefen
- [ ] **Sonstiges:** Feiertage, ISO-Woche, Übersetzungs-Schlüssel, Diagramm-Export
- [ ] **Datenbank** (nach Aufbau der Testdatenbank): RLS je Rolle inkl. externer Kunden, Nummernkreise, Auftragssperre/Workflow-Trigger, Auftrag bearbeiten/löschen, Bestandsbuchung, Chargen-RPCs, Ergebnis-/Korrektur-RPCs

## Fertig, wenn

- jeder Bereich oben abgehakt ist und in `tasks/Tests.md` jeder Funktionalität eine Testdatei mit Status zugeordnet ist,
- der Volllauf auf `main` grün ist (bekannte Fehler markiert und als `bug`-Issue erfasst),
- die GitHub-Action jeden Push und PR auf `main` prüft.
