# PR-Text für Stefan (Prod-Repo, Draft-PR)

Zum Einfügen in GitHub. Branch: `uebernahme-dev-2026-11` (Stand `84a96927`, gepusht), Ziel: `main`. Alle Prüfpunkte sind ausgefüllt; als **Draft** öffnen.

**Titel:** Übernahme Dev-Stand (ceram-rox-dev) – Löschen, Bearbeiten, Ergebnisdatenbank, Auftragserstellung, Pilot Plant, BET, Aktivitätsmessung

---

## Worum geht es?

Dieser PR bringt den kompletten Stand aus `ceram-rox-dev` (main, 23.11.2026) nach Prod. Gemeinsame Basis war `c75a539b` (v0.1.543, 13.11.). Lovable hat seitdem 27 Commits gemacht (bis v0.1.552, 17.11.), wir 227.

**Regel bei Überschneidungen:** Unsere Dev-Lösung gilt bei Löschen, Bearbeiten, Ergebnisdatenbank, Auftragserstellung, Pilot Plant, BET und Aktivitätsmessung. Alle übrigen Lovable-Änderungen bleiben erhalten.

## Was kommt neu (Dev)

- **Auftrag löschen:** Master und Ersteller dürfen immer löschen (auch mit Messdaten; dann wird die Auftragsnummer als Bestätigung getippt, Sicherung im Löschprotokoll). Aufträge mit Anhängen, Berichten, Fertigungsunterlagen sind löschbar; gespeicherte Dateien werden mit entfernt. Fertigungsfreigaben und m³-Listen werden nur gelöst, nie gelöscht.
- **m³-Liste löschen:** Ersteller und Master, optional mit Auftrag und eigenen, unbenutzten Proben.
- **Auftrag bearbeiten:** eigene Seite `/auftraege/:id/bearbeiten` (Kopfdaten, Proben, Auftragsformular, Vorgaben je Aufgabe mit Begründung, Dienstleistungen hinzufügen/entfernen, Sperren je Gruppe), Benachrichtigung der zugewiesenen Messdienstleister.
- **Ergebnisdatenbank:** kompakte Liste, Seitenleiste, Matrix je Messart, Auftrag/Probe-Umschalter, Messarten-Übersicht, Excel-Export je Auftrag.
- **Auftragserstellung und Pilot Plant:** ruhigere Oberfläche (volle Breite, 2:3-Aufteilung), Pilot Plant ausgedünnt ("Klassisch", "Pilot Plant").
- **BET** (nur das Ergebnis) und **Aktivitätsmessung** (einheitliche Darstellung, Gasnamen mit in/out).
- **m³-Liste:** "Proben aus m³-Liste ergänzen" für bestehende Beprobungsaufträge (siehe unten, mit Lovables Probennummern).
- Tests und Typprüfung: neue Tests (u. a. Formeln, Ergebnisse, Formulare), Skript `npm run typecheck`, Workflow `tests.yml`, `docs/`.

## Was bleibt von Lovable

- **m³-Probenanlage** mit Probennummer Artikelpräfix-Elementnummer und TEST-Markierung (Migration 0036_preserve_explicit_sample_number).
- **m³-Nachrüstung** ("Proben-Nachprüfung", nur Master) mit Migrationen 0038/0039.
- Versionsnummern (v0.1.552), `bun.lock`, `@lovable.dev/vite-plugin-hmr-gate` 1.8.3, `.lovable/`.
- `release.yml`, `package-lock.json`, `.gitignore`, `tauri.conf.json` bleiben **unverändert** (Prod-Fassung).

## Was entfällt (durch die Dev-Lösung ersetzt)

- Lovables "Auftraggeber bearbeitet eigene Aufträge im Originalformular" und die Aktionsspalte in der Auftragsliste.
- Lovables Löschdialog mit Vorschau/Prüfschlüssel (`OrderDeleteDialog`, `deleteLinks`, Master-only-Löschen der m³-Liste).
- Entfernt als eigener Commit (`85bc1183`): `OrderDeleteDialog.tsx`, `RequesterOrderRowActions.tsx`, `requesterEdit.ts`, `deleteLinks.ts` und ihre Tests.
- In der Datenbank bleiben die Lovable-Objekte bestehen; Migration 0048 sperrt/entfernt sie (siehe unten).

## Nicht enthalten

`tasks/`, `scripts/dev-db`, `scripts/dev-web`, `dev-web.yml`, Dev-Fassung von `release.yml`, `package-lock.json`, `.claude/`, `CLAUDE.md`, Issue-Vorlage, Test-Skripte für Dev-Benutzer.

## Datenbank-Migrationen (`drizzle/migrations`)

Neue Dateien in dieser Reihenfolge (entspricht dem erfolgreichen Dev-Lauf; Lovables 0000–0040 sind in Prod schon eingespielt). **Reihenfolge nach Journal-Nummer, nicht nach Dateiname** (Journal: Prod-Einträge 0–40 unverändert, unsere als idx 41–55):

| # | Datei | Inhalt |
|---|---|---|
| 1 | `0036_order_delete_creator_and_form_versions_guard` | Löschen: Ersteller, Formularversionen |
| 2 | `0037_order_delete_with_attachments` | Löschen mit Anhängen |
| 3 | `0038_m3_list_delete` | m³-Liste löschen; **Rechte:** Löschen auf `production_document_requests` nur Ersteller/Master |
| 4 | `0039_order_edit_apply_changes` | Bearbeiten (`apply_order_changes`) |
| 5 | `0040_order_edit_prefill_untouched` | Bearbeiten: vorbefüllte Werte gelten nicht als begonnen |
| 6 | `0041_order_edit_notify_assignees` | Benachrichtigung der Messdienstleister |
| 7 | `0042_order_edit_remove_services` | Dienstleistungen entfernen |
| 8 | `0043_fix_delete_facts_array_cast` | Korrektur |
| 9 | `0044_fix_m3_sample_plan_array_cast` | Korrektur |
| 10 | `0045_order_edit_log_services_added` | Verlaufseintrag |
| 11 | `0046_order_delete_extended` | Löschen: nur echte Messdaten blockieren |
| 12 | `0047_order_delete_always_master_creator` | Löschen: Master/Ersteller immer |
| 13 | `0048_lovable_abgleich_sperren` | **Lovables Bearbeiten-Trigger entfernen, Lovable-Funktionen sperren** |
| 14 | `0049_order_edit_policies` | **Neue einschränkende Policies für begonnene Aufträge, Schalter `app.order_edit`** |
| 15 | `0050_m3_delete_lovable_samples` | m³-Liste löschen erkennt auch Proben "m³-Liste Zeile N" |

**0048 und 0049 gehören zusammen und nur zusammen mit dieser neuen Oberfläche** (alte Oberfläche und installierte Desktop-Programme rufen die in 0048 gesperrten Lovable-Funktionen auf). Beide Dateien haben am Anfang einen entsprechenden Vermerk und eine Selbstprüfung am Ende (Abbruch, wenn etwas nicht stimmt; jede Datei läuft in einer Transaktion).

## Ablauf (bitte genau so)

1. **Lovable bis zum Merge eingefroren** (keine weiteren Änderungen/Publish).
2. **Vor dem Merge am Server:** Datei `sync-db.STOP` anlegen (Sync anhalten).
3. **Backup** der Produktionsdatenbank.
4. **Merge** dieses PR (bitte als Merge-Commit, nicht als Squash, damit die gemeinsame Vorgeschichte erhalten bleibt und spätere Übernahmen ohne erneute Konflikte laufen). Der Release-Workflow baut danach die Desktop-Version.
5. **Neue Oberfläche und Desktop-Programm bereitstellen.**
6. **Erst dann** `sync-db.STOP` entfernen und den Sync **kontrolliert** laufen lassen: Log beobachten, 0036 bis 0050 müssen nacheinander ohne Fehler durchlaufen. Bei einem Fehler stoppt der Lauf an dieser Datei; nichts von Hand ändern, sondern Meldung weitergeben.
7. Danach kurz die Testfälle unten durchgehen.

Hinweis: Der erste Commit (Merge von `dev/main`) übersetzt allein noch nicht (unbenutzte Lovable-Dateien), erst mit dem folgenden Commit ist alles grün. Der PR als Ganzes ist geprüft.

## Was Stefan prüfen soll

- **Berechtigungsänderungen:**
  - 0038: Löschen von m³-Listen nur Ersteller/Master (vorher: jeder Angemeldete).
  - 0047/0046: Löschen von Aufträgen für Master und Ersteller auch mit Messdaten (mit getippter Auftragsnummer, Sicherung im Löschprotokoll).
  - 0048: Lovables Trigger `trg_guard_requester_*` entfernt, drei Funktionen per `REVOKE EXECUTE` gesperrt (`force_delete_order`, `delete_m3_list(uuid,text)`, `requester_remove_order_measurement`); nichts gelöscht.
  - 0049: fünf einschränkende Policies (Ersteller ohne Master können begonnene Aufträge/Aufgaben/Parameter nicht mehr direkt ändern, nur über die Bearbeiten-Funktionen); `apply_order_changes` komplett neu (Text 1:1 aus 0042 plus eine `set_config`-Zeile).
- `tests.yml` (neu, läuft bei Push/PR auf `main`; Installation wie `release.yml` mit `npm install --force`).
- Journal-Reihenfolge (Abschnitt Migrationen).

## Prüfung

- Im Prod-Klon (Branch-Stand): `tsc` 0 Fehler, Vitest 204 Dateien / 2123 Tests grün, `npm run build` erfolgreich.
- Reviewer-Prüfung des Branches (Diff gegen `main`, Journal, m³-Formular, gesperrte Funktionen nirgends mehr aufgerufen, keine Dev-Adressen/Zugangsdaten): **APPROVED**, keine Findings.
- Dev-Datenbank: 0038–0049 eingespielt (0049 am 23.11. um 13:10). Die Tests aus `docs/dev-db-tests.md` sind durchgelaufen: Bearbeiten, Löschen (auch der Fall mit `order_form_versions`), m³-Liste löschen, drei Rollen (Ersteller ohne Master, Messdienstleister, Master) – alles in Ordnung. **0050** ist am 23.11. um 14:42 in die Dev-Datenbank eingespielt und geprüft.
- **Oberflächentest dieses Branches gegen die Dev-Datenbank** (lokal gestartet, ausschließlich gegen das Dev-Backend (Firmenserver), kein Prod-Zugriff): in Ordnung (m³-Liste: Proben ergänzen, Nachrüst-Panel, Löschen).
- Nicht möglich/nicht gemacht: Ausführen gegen die Produktionsdatenbank (nie), Installation mit `npm ci` (Prod-`package-lock.json` ist nicht synchron; Prod nutzt `bun.lock`/`npm install --force`).

## Rollback

Es gibt keine Rückwärts-Migrationen. Rückweg: Backup der Datenbank zurückspielen und den Merge zurücknehmen (Revert). Lovables 0034–0040 bleiben davon unberührt.

## Testfälle nach dem Einspielen (Kurzfassung)

1. Ersteller ohne Master: Auftrag anlegen, bearbeiten (auch begonnen), eigene Aufgabe löschen, eigenen Auftrag löschen.
2. Messdienstleister: zugewiesene Aufgabe bearbeiten und abschließen.
3. Master: alles, auch an fremden begonnenen Aufträgen.
4. m³-Liste: Beprobungsauftrag erstellen, "Proben aus m³-Liste ergänzen", Liste löschen (mit/ohne Auftrag), Master: "Proben-Nachprüfung".
5. Als Ersteller direkt (z. B. über die Schnittstelle) eine begonnene Aufgabe ändern: muss abgewiesen werden.
