# Aufgabe 024 – Übertragung Dev → Prod (Variante A), Schritt 1: Analyse

Stand: nur gelesen und berechnet. Im Prod-Klon wurde nichts verändert und nichts gepusht. Im Dev-Repo ist nur diese Datei neu.

## 0. Aufbau und Zugang

| Punkt | Stand |
|---|---|
| Prod-Klon | `C:\Users\daniel.gass\06_ceram-rox-prod-klon\ceram-rox` (eigener Ordner, nicht der Server, nicht der Ordner `ceram-rox` dort) |
| Prod-Repo | `https://github.com/Daniel656-ai/ceram-rox.git`, **öffentlich** (Klonen ging ohne Anmeldung) |
| Remote `dev` | zeigt auf den lokalen Dev-Ordner (`…\04_ceram-rox-dev\05_ceram-rox-dev`), nicht auf GitHub. Push-Adresse ist auf `DISABLED_NO_PUSH` gesetzt, ein Push dorthin ist nicht möglich. |
| Schreibzugriff auf Prod | **nicht getestet, vermutlich nicht vorhanden.** Nach deiner Angabe gilt der vorhandene Token nur für `ceram-rox-dev`. Für Schritt 2 (Branch pushen, Draft-PR) brauche ich einen Token des Kontos `Daniel656-ai`: nur Repo `ceram-rox`, Contents, Pull requests, Workflows: Read and write. `gh` ist auf diesem PC nicht installiert; den PR lege ich dann über die GitHub-Schnittstelle (API) mit dem Token an. |

## 1. Gemeinsame Basis

| | Commit | Datum | Version |
|---|---|---|---|
| Gemeinsame Basis (merge-base) | `c75a539b` | 13.11.2026 | v0.1.543 |
| Prod `main` | `84260762` | 17.11.2026 | v0.1.552 |
| Dev `main` | `356ab906` | 23.11.2026 | – |

- **Nur in Prod:** 27 Commits (10 davon sind automatische Versionsnummern-Commits, 3 reine Hinweise/Pläne).
- **Nur in Dev:** 227 Commits (70 davon Merge-Commits).
- **Dateien:** Prod hat seit der Basis 51 Dateien geändert, Dev 244. **17 Dateien haben beide geändert.**
- **Probe-Zusammenführung** (`git merge-tree`, ohne etwas zu ändern): **11 Dateien mit echten Konflikten**, alle anderen laufen automatisch zusammen.

## 2. Was ist nur in Prod (Lovable seit 13.11.)?

| Datum | Inhalt (Commit) | Wirkung |
|---|---|---|
| 16.11. | **m³-Beprobung: automatische Probenanlage** mit Probennummer Artikelpräfix-Element (`7bc3177f`): Migration 0036_preserve_explicit_sample_number, `m3List/sampleNumber.ts`, Anpassung `M3ListForm` und `samples.ts` | bleibt (siehe Abschnitt 3, Entscheidung E1) |
| 16.11. | **Auftraggeber bearbeitet eigene, nicht begonnene Aufträge im Originalformular** (`09ec09cc`): Migration 0037 (Schutz-Trigger), `RequesterOrderRowActions`, `requesterEdit.ts`, große Änderung `CreateOrderPage` (+383 Zeilen) | wird durch unser Bearbeiten ersetzt |
| 16.11. | **m³: Proben-Nachprüfung/Nachrüstung** für bestehende Beprobungsaufträge (`1286acc1`, `2aa6552e`): Migrationen 0038/0039, `M3SampleRetrofitPanel`, `m3Retrofit.ts`, `retrofit.ts` (nur Master) | bleibt |
| 17.11. | **Korrekturen am Auftraggeber-Bearbeiten** (`abc29a3d`, `4e2a4b63`, `13b785a3`): volles Formular, Pilot-Plant-Stammdaten, keine doppelten Dienstleistungen, Mehrfachrollen | wird durch unser Bearbeiten ersetzt |
| 17.11. | **Master sieht Bearbeiten/Löschen auch bei eigenen Aufträgen** (`82bdd226`) | wird durch unser Löschen/Bearbeiten ersetzt |
| 17.11. | **Sicheres Löschen von Aufträgen und m³-Listen mit Vorschau** (`a0df4c6b`, `1cba87ee`, `8dec3e19`): Migration 0040, `OrderDeleteDialog`, `M3DeleteDialog`, `deleteLinks.ts` | wird durch unser Löschen ersetzt |
| 17.11. | "Produktionsprojekt statt Projekt" für Beprobungsaufträge (`8c4d9c88`, `e0ff8a00`) | **von Lovable selbst zurückgenommen** (`f435ee94` "Reverted to commit e9ddd817"). Im Prod-Stand nicht mehr enthalten, nichts zu übernehmen. |
| 13.–17.11. | Versionsnummern v0.1.544 bis v0.1.552 (`package.json`, `tauri.conf.json`), `@lovable.dev/vite-plugin-hmr-gate` 1.8.3, `bun.lock`, Pläne in `.lovable/plan/` | Version und Lockdatei bleiben die von Prod |

## 3. Was ist nur in Dev? (227 Commits, nach Themen)

- **Auftrag löschen** (Ersteller und Master immer, mit Messdaten, mit Anhängen, m³-Liste löschen) – Migrationen 0036–0038, 0043, 0044, 0046, 0047.
- **Auftrag bearbeiten** (Stufen 0–4: Kopfdaten, Proben, Vorgaben je Aufgabe, Dienstleistungen entfernen/hinzufügen, Benachrichtigung) – Seite `/auftraege/:id/bearbeiten`, Migrationen 0039–0042, 0045.
- **Ergebnisdatenbank** (Filter, Seitenleiste, Matrix, Auftrag/Probe-Umschalter, Messarten, Excel-Export) – nur Oberfläche.
- **Auftragserstellung** (ruhiger, volle Breite, 2:3-Aufteilung, Spalten nach Containerbreite) und **Pilot Plant** (ausgedünnt, "combined" als Pilot Plant).
- **BET-Darstellung**, **Aktivitätsmessung** (einheitliche Darstellung, Gasnamen in/out).
- **Abgleich mit Lovable**: 0038 idempotent, 0048 (Trigger weg, Lovable-Funktionen gesperrt), 0049 (Policies, Schalter `app.order_edit`).
- **Arbeitsumgebung** (nicht für Prod, siehe Abschnitt 5): Dev-Web, Dev-DB-Sync, Tests/CI, Regeln, `tasks/`.

### Überschneidung (17 Dateien) und Konfliktrisiko

| Datei | Konflikt? | Auflösung |
|---|---|---|
| `src/pages/CreateOrderPage.tsx` | **ja, 9 Stellen** (Prod +287/−119, Dev +401/−345) | **Dev-Fassung.** Lovables Bearbeiten-im-Originalformular entfällt. |
| `src/pages/OrderDetailPage.tsx` | ja, 4 | Dev (Bearbeiten-Knopf zu `/bearbeiten`, Löschdialog) |
| `src/pages/OrdersPage.tsx` | ja, 3 | Dev (Löschen/Bearbeiten wie bei uns). Lovables `RequesterOrderRowActions` entfällt. |
| `src/pages/ProductionDocumentsPage.tsx` | ja, 5 | Dev (m³-Liste löschen: Ersteller und Master) |
| `src/components/productionDocuments/M3DeleteDialog.tsx` | ja, beide haben die Datei neu angelegt | Dev-Fassung |
| `src/components/productionDocuments/M3ListForm.tsx` | ja, 1 Stelle | **manuell, mit Entscheidung E1** |
| `src/hooks/useOrders.ts` | ja, 1 | Dev (`cancel_or_delete_order` mit Bestätigungsnummer) |
| `src/lib/api/orders.ts` | ja, 2 | Dev; Lovables `deletePreview`, `requesterEditState`, `requesterRemoveMeasurement` entfallen |
| `src/lib/api/productionDocuments.ts` | ja, 1 | Dev (`deletePlan`, `deleteM3`); Lovables `m3DeletePreview`, `deleteM3List` entfallen |
| `drizzle/migrations/meta/_journal.json` | ja, 5 | **manuell**, siehe Abschnitt 6 |
| `src-tauri/tauri.conf.json` | ja, 1 (nur Versionsnummer) | **Prod-Fassung** (0.1.552) |
| `package.json` | nein | automatisch: Prod-Version/hmr-gate plus unser Skript `typecheck` |
| `src/hooks/useProductionDocuments.ts`, `src/i18n/locales/{de,en}/orders.json`, `src/integrations/supabase/types.ts`, `src/test/ordersPageSamples.test.tsx` | nein (laufen automatisch) | danach prüfen: Lovables Hooks/Schlüssel für die entfallenden Dialoge werden unbenutzt |

Nicht überlappend, aber von Lovable (kommen unverändert mit): `orderTemplateCopy.ts`, `orderTemplateInputs.ts` (Änderungen für das Lovable-Bearbeiten), `requesterEdit.ts`, `deleteLinks.ts` usw. – siehe unten.

### Lovable-Änderungen, die bei "Dev gilt" wegfallen würden

1. **Auftraggeber-Bearbeiten im Originalformular** (`/auftraege/neu?edit=…`): Oberfläche in `CreateOrderPage`, Knopf in `OrderDetailPage`, Spalte `RequesterOrderRowActions` in der Auftragsliste. Dateien, die danach unbenutzt sind: `src/lib/orders/requesterEdit.ts` (+ Tests `requesterEdit.test.ts`, `requesterEditFixes.test.ts`, `ownOrderActions.test.ts`), `RequesterOrderRowActions.tsx`, `useOrderRequesterEditState`, Änderungen in `orderTemplateCopy.ts`/`orderTemplateInputs.ts`.
2. **Löschen mit Vorschau und Prüfschlüssel** (`force_delete_order`, `delete_m3_list(uuid,text)`, `preview_*`): `OrderDeleteDialog.tsx`, Lovables `M3DeleteDialog`, `deleteLinks.ts` (+ Test). Fachlich: Bei Lovable darf nur der Master löschen (m³-Liste) bzw. nur der Ersteller unbegonnene Aufträge; bei uns Master und Ersteller immer.
3. **"Master sieht Bearbeiten/Löschen auch bei eigenen Aufträgen"** (`82bdd226`).
4. **In der Datenbank** bleiben die Lovable-Objekte bestehen (Prod hat sie schon). Unsere 0048 sperrt `force_delete_order`, `delete_m3_list(uuid,text)`, `requester_remove_order_measurement` und entfernt die Trigger `trg_guard_requester_*`. Lovables "Master delete"-Regel auf `production_document_requests` wird durch unsere "Creator or master delete" ersetzt.

**Vorschlag für die Dateien (Entscheidung E2):** Die unbenutzten Lovable-Dateien (Liste in Punkt 1 und 2) in der Zusammenführung **mit entfernen**, damit kein toter Code und keine Tests für nicht mehr vorhandene Funktionen bleiben. Die Gegenseite (alles lassen): mehr Konfliktfreiheit mit späteren Lovable-Änderungen, dafür unbenutzter Code. Ich empfehle Entfernen, aber als eigener, gut erkennbarer Commit im PR.

### Entscheidung E1: m³-Probenanlage (zwei Lösungen für dasselbe)

- **Lovable (16.11., bleibt nach Grundsatz):** Probennummer wird fachlich vergeben (`Artikelpräfix-NNNNN`, explizite Nummer, Datenbank respektiert sie dank 0036; TEST-Markierung; Beschreibung "m³-Liste Zeile N").
- **Dev (17.11.):** Probenname `Artikelnummer-Element`, Probennummer vergibt die Datenbank (P-Nummer), Beschreibung "Aus m³-Liste …"; "Proben aus m³-Liste ergänzen" (`ensureSamples`).
- Beide Wege stehen jetzt in `M3ListForm` gegeneinander. Diese Funktion steht **nicht** in deiner Liste der Dev-Vorrangbereiche.
- **Folge für unser Löschen:** Unser `m3_list_sample_plan` löscht mitgelöschte Proben nur, wenn die Beschreibung mit "Aus m³-Liste" beginnt. Proben nach Lovable-Art ("m³-Liste Zeile N") oder aus dem Nachrüsten würden **nicht** mitgelöscht, sondern blieben stehen (sicher, aber anders als gewünscht).
- **Vorschlag:** Lovables Probenanlage gewinnt (sie ist neuer und entspricht dem Grundsatz "übrige Lovable-Änderungen bleiben"); unser "Ergänzen"-Knopf ruft sie auf. Dazu eine kleine neue Migration (nach 0049), die `m3_list_sample_plan` auch Proben mit Beschreibung "m³-Liste Zeile …" und Tag `m3_beprobung` als löschbar erkennt. **Dazu brauche ich dein OK.**

## 4. Was NICHT nach Prod darf

| Pfad | Grund | Behandlung |
|---|---|---|
| `tasks/` (inkl. `lovable-prod/`) | Arbeitsnotizen | nicht übertragen |
| `scripts/dev-db/`, `scripts/dev-web/` | Dev-Server | nicht übertragen |
| `.github/workflows/dev-web.yml` | Dev-Web-Bau (enthält Dev-URLs und `CLOUD_REF`) | nicht übertragen |
| `.github/workflows/release.yml` | Dev-Fassung hat nur die Zusatzzeile `if: github.repository != 'danielgass95-sketch/ceram-rox-dev'`; Prod hat sie nicht geändert | **Prod-Fassung behalten** (Datei wird unverändert gelassen) |
| `package-lock.json` | gehört nur zum Dev-Repo (CLAUDE.md). Prod hat eine eigene `package-lock.json` und `bun.lock`. | nicht übertragen, Prod-Datei bleibt |
| `.gitignore` | Dev-Zusätze (Dev-Web-Log, `tasks/**/*.csv` usw.) | nicht übertragen |
| `src-tauri/tauri.conf.json` | nur Versionsnummer (Dev 0.1.547, Prod 0.1.552) | Prod-Fassung |
| `scripts/test-runner/`, `scripts/analyse/` | Dev-Werkzeuge | nicht übertragen |
| Test-Benutzer-Skripte (`tasks/023-testuser-dev.sql` u. a.) | nur Dev | liegen in `tasks/`, entfallen |
| `.env` | Prod hat eine eigene, eingecheckte `.env`; Dev ändert sie nicht, `.env.development.local` ist in Dev nicht eingecheckt | unverändert lassen |

**Weitere Prüfungen (Ergebnis):**
- In `src/`, `supabase/` und `vite.config.ts` gibt es keine Dev-Adressen oder Dev-Kennungen (Suche nach `55321`, `55322`, `172.30.`, `ceram-rox-dev`, `danielgass95`, `localhost:5`, `vrzqlfovvdxofxqyslev` ergab nur Treffer in `dev-web.yml` und `release.yml`).
- Der Eintrag "PDF-Import im Dev-Web zu Dev leiten" liegt in `scripts/dev-web/` (nicht übertragen), nicht im App-Code.
- Code-Kommentare in `src/` verweisen auf `docs/gestaltungsregeln.md` und `tasks/…` (nur Kommentare, kein Laufzeitverhalten).

**Mit übertragen (kleine Hilfsdateien, bitte bestätigen):** `vitest.config.ts` (längere Test-Zeitlimits, nur für Tests), `package.json`-Skript `typecheck` (wird von den Tests/CI gebraucht), `scripts/test-order-deletion.sql` (bestehende Prod-Datei, von uns an das neue Löschen angepasst).

**Nur Vorschläge (nicht ohne dein OK übertragen):**
- `.github/workflows/tests.yml` (läuft bei Pull Requests; würde in Prod Tests und Typprüfung automatisch starten) – empfehle: mitnehmen, nach Stefans OK.
- `.claude/` (Agenten-Definitionen), `CLAUDE.md` – Arbeitsregeln des Dev-Repos; empfehle: **nicht** nach Prod, außer Stefan wünscht sie.
- `docs/` (`gestaltungsregeln.md`, `tests.md`) – der Code verweist in Kommentaren darauf; empfehle: mitnehmen.
- `.github/ISSUE_TEMPLATE/bug.md` – Geschmackssache; empfehle: nicht.

## 5. Migrationen

**Prod-Stand:** Die Prod-Liste kennt Lovable 0000–0040 (Dateien mit denselben Nummern wie unsere, aber anderen Namen ab 0036). Die Datei `sync-db.ps1` liegt nicht im Repo, ich kenne ihre genaue Sortierung nicht. Als Vorbild (nach `tasks/003`) gilt: neue Dateien = nicht in der Liste, sortiert nach Dateiname.

**Neu für Prod (alle in `drizzle/migrations`):**

| Reihenfolge | Datei | Inhalt |
|---|---|---|
| 1 | `0036_order_delete_creator_and_form_versions_guard` | Löschen: Ersteller, Formularversionen |
| 2 | `0037_order_delete_with_attachments` | Löschen mit Anhängen |
| 3 | `0038_m3_list_delete` (mit der Ergänzung `DROP POLICY IF EXISTS`) | m³-Liste löschen, Policies |
| 4 | `0039_order_edit_apply_changes` | Bearbeiten |
| 5 | `0040_order_edit_prefill_untouched` | Bearbeiten |
| 6 | `0041_order_edit_notify_assignees` | Benachrichtigung |
| 7 | `0042_order_edit_remove_services` | Dienstleistungen entfernen |
| 8 | `0043_fix_delete_facts_array_cast` | Korrektur |
| 9 | `0044_fix_m3_sample_plan_array_cast` | Korrektur |
| 10 | `0045_order_edit_log_services_added` | Bearbeiten |
| 11 | `0046_order_delete_extended` | Löschen |
| 12 | `0047_order_delete_always_master_creator` | Löschen (Master/Ersteller immer) |
| 13 | `0048_lovable_abgleich_sperren` | Lovable-Trigger weg, Funktionen gesperrt |
| 14 | `0049_order_edit_policies` | Policies, Schalter `app.order_edit` |
| (15) | evtl. neue Migration zu E1 | m³-Löschen erkennt Lovable-Proben |

**Bestätigung:** Diese Reihenfolge ist **dieselbe wie im erfolgreichen Dev-Lauf**. Dort waren Lovable 0034–0040 bereits in der kopierten Datenbank, danach liefen unsere 0036–0049 in dieser Nummernfolge (0038 und 0049 nach den bekannten Korrekturen). Auch Sortierung nach Dateiname ergibt in Prod genau diese Reihenfolge, weil Lovables Dateien dort schon als eingespielt gelten. Dieselbe Folge ergäbe sich nach dem Git-Zeitpunkt oder der Journal-Nummer.

**Zwei Anpassungen, die ich vorschlage:**
1. **Journal (`_journal.json`)**: Beide Seiten haben Einträge 36–40 mit verschiedenen Dateien. Im PR die Prod-Einträge 0–40 unverändert lassen und unsere 14 Einträge als **idx 41–54** mit zeitlich nachfolgenden `when`-Werten anhängen (Dateinamen bleiben, nur die Zählung im Journal ändert sich). Damit entspricht die Journal-Reihenfolge der Einspielreihenfolge (Lovable zuerst, dann unsere).
2. **Neuaufbau einer leeren Datenbank:** Würde man eine leere Datenbank **nach Dateinamen** aufbauen, liefe z. B. unser `0038_m3_list_delete` vor Lovables `0040_force_delete_order_and_m3_list` und Lovables 0040 scheiterte an den schon vorhandenen Regeln "Authenticated insert/update production_document_requests". Für den laufenden Betrieb in Prod spielt das keine Rolle (Lovables Dateien sind dort angewendet); für einen späteren Neuaufbau gilt: **Reihenfolge nach Journal (idx), nicht nach Namen.** Das steht dann im PR-Text.

**0048 und 0049 nur gemeinsam und nur mit unserer Oberfläche:** Der Sync spielt **alle** neuen Dateien in einem Lauf ein, also kommen 0048 und 0049 automatisch gemeinsam (sofern 0049 nicht auf der Ignorierliste steht). Die Gefahr liegt im Zeitfenster zwischen Datenbank und Oberfläche:
- Wird die Datenbank **vor** der neuen Oberfläche umgestellt, rufen die alte Web-Oberfläche und **bereits installierte Desktop-Programme** (Tauri, aktualisieren sich erst bei Release/Neustart) die gesperrten Lovable-Funktionen auf. Löschen und Bearbeiten schlagen dann fehl.
- Vorschlag für die Abfolge: Backup → Lovable bleibt eingefroren → PR mergen (Release baut) → **Web-Oberfläche** deployen → direkt danach `sync-db.ps1` → Desktop-Release verteilen. Bis die Desktop-Nutzer aktualisiert haben, bleibt Löschen/Bearbeiten dort eingeschränkt; das ist mit Stefan abzusprechen. Alternative: 0048/0049 vorläufig auf die Ignorierliste setzen und erst nach der Desktop-Verteilung einspielen (0036–0047 sind für die alte Oberfläche unkritisch, da sie Lovables Funktionen nicht entfernen).

## 6. Risiken und offene Entscheidungen

| Nr. | Frage | Empfehlung |
|---|---|---|
| E1 | m³-Probenanlage: Lovables Lösung gewinnt, plus kleine Migration, damit unser Löschen die Proben erkennt | Ja |
| E2 | Unbenutzte Lovable-Dateien (Bearbeiten/Löschen) im PR entfernen, als eigener Commit | Ja |
| E3 | Mit übertragen: `vitest.config.ts`, Skript `typecheck`, `scripts/test-order-deletion.sql`, `docs/`, `tests.yml` | Ja |
| E4 | `.claude/`, `CLAUDE.md`, Issue-Vorlage nicht übertragen | Ja |
| E5 | Journal als idx 41–54 anhängen (Abschnitt 5) | Ja |
| E6 | Reihenfolge Oberfläche → Datenbank und Umgang mit installierten Desktop-Programmen (Abschnitt 5) | mit Stefan klären |
| E7 | Token für `Daniel656-ai` (Repo `ceram-rox`; Contents, Pull requests, Workflows: Read and write) | von dir anzulegen |

Weitere Hinweise:
- Die Tests im Prod-Klon müssen nach der Zusammenführung grün sein (Build, Typprüfung, Volllauf). Lovables eigene Tests zu entfallenden Teilen (`requesterEdit*`, `ownOrderActions`, `deleteLinks`) entfallen mit (E2).
- Ich habe nichts gegen die echte Datenbank ausgeführt; Prod wird weiter nur über `sync-db.ps1` versorgt, nie von mir.
- Vor dem Merge durch Stefan: Backup der Prod-Datenbank, Lovable bis zum Merge eingefroren.

**Stopp:** Ich warte auf dein OK für Schritt 2 und deine Entscheidungen zu E1–E7.
