# Aufgabe 023 – Zusammenführung Dev ↔ Lovable (Prod): Analyse

Stand: nur gelesen, nichts geändert, keine DB-Zugriffe. Grundlage: Lovable 0034–0040 (`tasks/0034…0040_*.sql`) gegen unsere `drizzle/migrations/0034…0047`.

## Kurzfassung

1. **0034 und 0035 sind bei beiden identisch** (Dateivergleich: gleich). Dort gibt es keinen Konflikt.
2. **Der Fehler bei 0038** kommt von genau zwei Regeln. Lovable 0040 legt "Authenticated insert/update production_document_requests" an, mit demselben Namen und demselben Inhalt wie wir. Unser 0038 löscht nur Regeln für ALL/DELETE und legt INSERT/UPDATE dann nochmal an. Das scheitert, weil die Namen schon existieren.
3. **Lovables Schutz-Trigger aus 0037 blockiert unsere Bearbeiten-Funktion.** Das gilt für Ersteller, die nicht Master sind, sobald der Auftrag begonnen ist. Er muss entschärft werden (Vorschlag unten).
4. Lovables Löschfunktionen (`force_delete_order`, `delete_m3_list(uuid,text)` …) stören unsere nicht, weil sie andere Signaturen haben. Sie laufen aber **parallel** weiter. Damit "genau unser Verhalten gilt", sollten sie abgeschaltet werden.

## 1. Überschneidungen

| Thema | Lovable | Unser Stand | Konflikt? |
|---|---|---|---|
| `enforce_order_lock_on_order`, `trg_recompute_workflow_from_measurements`, `cancel_or_delete_order(uuid)`, `guard_order_delete_dependents` + Trigger (0034/0035) | – | identisch (gleiche Dateien) | nein |
| `generate_sample_number` (Lovable 0036: ausdrücklich gesetzte Probennummern bleiben) | neu | von uns nirgends angefasst | nein, bleibt |
| `m3_retrofit_order_samples` (Lovable 0038/0039: m³-Proben nachrüsten, nur Master) | neu | kein Gegenstück. Unser `m3_list_sample_plan` erkennt Proben an der Beschreibung "Aus m³-Liste…". Nachgerüstete Proben haben eine leere Beschreibung. | nein, bleibt (siehe Hinweis A) |
| Policies `production_document_requests` INSERT/UPDATE | "Authenticated insert/update …" (true) | gleiche Namen, gleicher Inhalt | **ja, Abbruch bei 0038** |
| Policy DELETE `production_document_requests` | "Master delete …" (nur Master) | "Creator or master delete …" (Ersteller oder Master) | nein: unsere DO-Schleife in 0038 löscht Lovables Regel vorher (ALL/DELETE). Danach gilt unsere. |
| m³-Liste löschen | `delete_m3_list(_id, _expected_hash)`, `preview_delete_m3_list`, `_m3_delete_links`. Nur Master. Proben und Auftrag bleiben bestehen (nur Verknüpfungen werden gelöst). | `delete_m3_list(_request_id)`, `m3_list_delete_plan`, `m3_list_sample_plan`. Ersteller oder Master. Löscht Auftrag und unberührte Proben mit. | andere Signatur, daher **keine Kollision, aber zwei parallele Funktionen** |
| Auftrag löschen | `force_delete_order(uuid,text)`, `preview_force_delete_order`, `_order_delete_links`. Master löscht auch bei Verknüpfungen, Proben werden entkoppelt. Alle anderen werden an `cancel_or_delete_order` weitergereicht. | `cancel_or_delete_order(uuid,text)` (0047, die alte `(uuid)`-Version wird dort gelöscht), `_order_delete_blockers`, `_order_started`, `order_delete_summary` … Master und Ersteller dürfen immer löschen. | andere Namen, **parallel**. Lovables Aufruf `cancel_or_delete_order(_order_id)` findet auch nach unserem 0047 die neue Funktion (der zweite Parameter ist optional). |
| Auftrag bearbeiten | `order_requester_edit_state`, `order_requester_block_reason`, `requester_remove_order_measurement` (Dienstleistung entfernen, nur solange nicht begonnen), **Trigger `trg_guard_requester_order_edit` / `trg_guard_requester_param_edit`** | `apply_order_changes`, `order_edit_facts`, `order_edit_remove_services` (auch bei begonnenen Aufträgen) | **ja, Trigger blockiert uns (Punkt 2)** |

Unsere Frontend-Aufrufe nutzen nur unsere Funktionen. Ein Treffer in `src/` für die Lovable-Namen fehlt (geprüft: `delete_m3_list` nur mit `_request_id`).

## 2. Lovable 0037 – blockiert der Trigger unsere Bearbeiten-Funktion?

**Ja, für Ersteller ohne Master-Rolle.** Master sind ausgenommen (`has_role … master → RETURN`).

Wie der Trigger arbeitet:
- Er feuert vor jedem UPDATE auf `measurement_orders` und vor INSERT/UPDATE/DELETE auf `measurement_parameters`.
- Er prüft nur, wenn `auth.uid()` gesetzt ist, die Datenbankrolle `authenticated` ist und `pg_trigger_depth() <= 1`.
- Ist der Aufrufer der Ersteller und liefert `order_requester_block_reason` einen Grund, bricht er mit "Dieser Auftrag kann nicht mehr bearbeitet werden…" ab.
- Ausnahme: Ändert ein UPDATE an `measurement_orders` nur `updated_at` oder `status`, geht es durch.

Gründe für "gesperrt": Auftrag gesperrt/abgeschlossen, Status nicht "open", irgendeine Aufgabe, Messung, Ergebnis, Zeitbuchung, Rohdaten usw. begonnen.

Warum das uns trifft:
- `apply_order_changes` ist **SECURITY INVOKER**, läuft also mit den Rechten des Erstellers. Sein `UPDATE measurement_orders SET …` (Priorität, Fälligkeit, Anmerkungen, Formularwerte …) ist ein direktes Statement auf Tiefe 1. Die Datenbankrolle ist `authenticated`. Der Trigger greift also.
- Unser Bearbeiten ist ausdrücklich **auch bei begonnenen Aufträgen** erlaubt. Der Trigger verbietet genau das für Ersteller. Der Ersteller bekommt dann beim Speichern die Lovable-Fehlermeldung.
- *(Analysestand vor der Umsetzung; der Trigger ist seit 0048 entfernt.)* `order_edit_remove_services` ist SECURITY DEFINER. Die Datenbankrolle bleibt dabei `authenticated`, deshalb wäre der Trigger auch hier nicht umgangen worden. Das Löschen von Parametern wird über Fremdschlüssel-Kaskaden ausgelöst (Tiefe >1, vom Trigger ignoriert). Direkte Parameter-Änderungen innerhalb unserer Funktionen träfe er dagegen.
- Die Aussage im Lovable-Kommentar, SECURITY-DEFINER-Funktionen blieben unberührt, stimmt nur für Folgetrigger. Sie stimmt nicht für direkte Statements in den Funktionen.

`order_edit_locks`: Es gibt kein solches Objekt im Code. Der Begriff steht nur im Vorschlag `tasks/012`. Die Sperren in unserer Lösung sind die bestehenden `is_order_locked` und `SELECT … FOR UPDATE` in `apply_order_changes`. Beide kollidieren nicht mit Lovable.

Hinweis: Lovables Hilfsfunktionen (`order_requester_*`) sind nur lesend und stören nicht.

### Wie entschärfen? Zwei Wege

**Variante A – Trigger entfernen (empfohlen).**
Neue Migration: `DROP TRIGGER IF EXISTS trg_guard_requester_order_edit ON measurement_orders;` und das Gleiche für `trg_guard_requester_param_edit ON measurement_parameters`.
- Vorteil: einfach, sicher, ohne Eingriff in unsere Funktionen. Unsere Regeln gelten allein.
- Nachteil: Der Trigger war eine zweite Absicherung gegen direkte Client-Schreibzugriffe auf `measurement_orders`/`measurement_parameters`. Diese Absicherung fällt weg. Offene Prüfung vor Prod: Welche Schreibrechte (Policies) hat ein Ersteller auf `measurement_orders` und `measurement_parameters` direkt über die API? Ich habe das hier nicht geprüft (keine DB-Zugriffe). Das wäre ein eigener kleiner Schritt.

**Variante B – Trigger behalten, mit Schalter durchlassen.** *(Nicht gewählt. Umgesetzt wurde Variante A plus Policies; der Schalter sitzt nur in `apply_order_changes`, siehe Abschnitt "Umsetzung".)*
`guard_requester_order_edit` wird per `CREATE OR REPLACE` so geändert, dass er bei gesetztem Schalter `app.order_edit = 'on'` sofort durchlässt. `apply_order_changes` und `order_edit_remove_services` würden den Schalter transaktionslokal setzen (`set_config(…, true)`). Das gleiche Muster nutzen wir schon mit `app.order_force_delete`.
- Vorteil: Schutz gegen direkte Zugriffe bleibt.
- Nachteil: Wir müssten die zwei Funktionen (ca. 350 Zeilen) in einer neuen Migration neu schreiben. Mehr Aufwand, mehr Risiko.

## 3. Vorschlag: Wie unsere Migrationen auf dem Prod-Stand sauber durchlaufen

Ziel: Dieselbe Migrationsfolge soll auf einer frischen Dev-DB, auf der Dev-DB nach Lovable und später auf Prod gleich funktionieren (mehrfach ausführbar).

**Schritt 1 – 0038 minimal ergänzen (bräuchte Deine Freigabe):**
Vor die beiden `CREATE POLICY`-Zeilen für INSERT und UPDATE kommt je ein
`DROP POLICY IF EXISTS "Authenticated insert production_document_requests" ON public.production_document_requests;`
bzw. `… "Authenticated update …"`.
Begründung: 0038 ist bisher nirgends erfolgreich gelaufen (Dev scheiterte, Prod hat sie nie gesehen). Die Regel "bestehende Migrationsdateien nie ändern" dient dazu, bereits eingespielte Stände nicht auseinanderlaufen zu lassen. Das ist hier nicht der Fall. Trotzdem weiche ich von der Regel nur mit Deinem OK ab.
Alternative ohne Dateiänderung: die Dev-DB von Hand vorbereiten. Das ist aber für Prod nicht wiederholbar und deshalb nicht empfohlen.

Die DELETE-Regel muss nicht angefasst werden: Die DO-Schleife in 0038 löscht Lovables "Master delete …" und legt unsere "Creator or master delete …" an. Die Selbstprüfung am Ende (genau eine DELETE-Regel) bleibt gültig.

**Schritt 2 – Neue Migration `0048_lovable_abgleich.sql` (nach 0047), nur mit `IF EXISTS`:**
- Trigger entschärfen (Variante A: zwei `DROP TRIGGER IF EXISTS`; Variante B siehe oben).
- Lovables Löschfunktionen abschalten, damit nur unser Verhalten gilt:
  `DROP FUNCTION IF EXISTS public.force_delete_order(uuid,text);`
  `DROP FUNCTION IF EXISTS public.preview_force_delete_order(uuid);`
  `DROP FUNCTION IF EXISTS public._order_delete_links(uuid);`
  `DROP FUNCTION IF EXISTS public.delete_m3_list(uuid,text);`
  `DROP FUNCTION IF EXISTS public.preview_delete_m3_list(uuid);`
  `DROP FUNCTION IF EXISTS public._m3_delete_links(uuid);`
  (Alternative statt Löschen: nur `REVOKE EXECUTE`. Dann bleiben sie als Reserve erhalten, sind aber nicht aufrufbar.)
- Lovables Bearbeiten-Gegenstück `requester_remove_order_measurement(uuid,text)` ebenfalls abschalten (Zweck deckt sich mit `order_edit_remove_services`, Regeln sind aber strenger). `order_requester_edit_state/block_reason` können bleiben (nur lesend). Sie werden nur gebraucht, solange Lovables Oberfläche läuft.
- Alles andere von Lovable bleibt unverändert: `generate_sample_number`, `m3_retrofit_order_samples`, Policies INSERT/UPDATE.

**Schritt 3 – Selbstprüfung am Ende von 0048** (wie schon in 0038): bricht ab, wenn
- noch ein Trigger `trg_guard_requester_*` existiert (Variante A),
- Lovables Löschfunktionen noch aufrufbar sind,
- mehr oder weniger als eine DELETE-Regel auf `production_document_requests` existiert.

**Prod-Übertragung:** Gleiche Dateien (0038 mit Ergänzung plus 0048) in das Ceram-Repo. Da Prod Lovables 0034–0040 schon hat, läuft es genauso wie hier getestet. Vorher gilt die Freigabe durch Stefan wie bei 0039. Beim Abschalten von Lovables Funktionen ist wichtig: **Lovables eigene Oberfläche, falls sie in Prod noch läuft, ruft diese Funktionen auf.** Das Abschalten darf erst zusammen mit unserer neuen Oberfläche in Prod gehen (sonst funktionieren Löschen und Bearbeiten dort nicht mehr).

**Ergebnis nach allem:**
- Löschen: Master und Ersteller dürfen immer (0046/0047). Lovables `force_delete_order` ist weg.
- m³-Liste löschen: Ersteller oder Master, mit unserem Plan. Lovables Variante ist weg.
- Bearbeiten: unser `apply_order_changes` ohne Blockade durch Lovables Trigger.

## Hinweise / Offene Punkte

- **A – m³-Retrofit:** Von Lovable nachgerüstete Proben haben meist eine leere Beschreibung und tragen das Tag `m3_beprobung`. Unser Löschen einer m³-Liste behält sie, weil sie nicht "Aus m³-Liste…" heißen. Das ist sicher (es wird nichts zu viel gelöscht). Wenn sie mitgelöscht werden sollen, wäre eine kleine Anpassung in `m3_list_sample_plan` nötig. Erst nach Deiner Entscheidung.
- **B – Lovable 0040 enthält zusätzlich** `is_order_locked`-Bypass `app.bypass_order_lock` (wie unser 0047). Beide Seiten nutzen denselben Schalter. Das ist kompatibel.
- **C – `tasks/` ist im Repo noch nicht eingecheckt** (nur lokal). Nach CLAUDE.md gehört es mit auf GitHub. Das mache ich erst mit einem eigenen Branch, wenn Du es willst.

## Entscheidungen, die ich von Dir brauche

1. Darf 0038 minimal ergänzt werden (zwei `DROP POLICY IF EXISTS`)? Empfehlung: Ja.
2. Bearbeiten-Trigger: Variante A (entfernen) oder B (mit Schalter)? Empfehlung: A, dazu vorher die Schreibrechte der Ersteller prüfen.
3. Lovables Löschfunktionen: löschen oder nur sperren? Empfehlung: erst sperren (REVOKE), später löschen.

---

# Umsetzung (Entscheidungen vom Nutzer: 0038 ergänzen, Variante A, Lovable-Funktionen sperren)

Branch `improve/lovable-abgleich`. Dateien:

| Datei | Inhalt |
|---|---|
| `drizzle/migrations/0038_m3_list_delete.sql` | ergänzt: `DROP POLICY IF EXISTS` für "Authenticated insert/update production_document_requests" vor dem Anlegen |
| `drizzle/migrations/0048_lovable_abgleich_sperren.sql` | Lovables Trigger `trg_guard_requester_order_edit` / `trg_guard_requester_param_edit` entfernen; `force_delete_order(uuid,text)`, `delete_m3_list(uuid,text)`, `requester_remove_order_measurement(uuid,text)` per `REVOKE` sperren (nicht gelöscht) |
| `drizzle/migrations/0049_order_edit_policies.sql` | Hilfsfunktionen, fünf einschränkende Policies, Schalter `app.order_edit` (`apply_order_changes` komplett neu angelegt, `set_config` als erste Anweisung), `order_sync_primary_sample` |
| `src/lib/api/orderSamples.ts` | `syncPrimary` ruft `order_sync_primary_sample` statt direktem UPDATE |
| `tasks/lovable-prod/` | Lovable-Kopien 0034–0040 (nur zum Lesen) |
| `tasks/023-testanleitung.md`, `023-testuser-dev.sql`, `023-testfaelle-dev.sql` | Testanleitung, Testbenutzer (nur Dev), SQL-Prüfung |

> **IN PROD NUR 0048 UND 0049 GEMEINSAM EINSPIELEN** – zusammen mit unserer neuen Oberfläche und mit der Freigabe durch Stefan.
> 0048 allein öffnet die Schutzlücke wieder, 0049 allein lässt Lovables Trigger stehen. Lovables Oberfläche ruft die in 0048
> gesperrten Funktionen noch auf. Dasselbe steht als Vermerk im Kopf beider Migrationsdateien. 0038 (mit Ergänzung) läuft davor wie
> jede andere Migration. Das Ceram-Repo bekommt `package-lock.json` und `dev-web.yml` weiterhin nicht.

## Prüfung: Kann ein Client den Schalter `app.order_edit` selbst setzen?

Ergebnis: **Nein.** Geprüft in allen Migrationen (`drizzle/migrations`, `supabase/migrations`, `tasks/lovable-prod`):

1. **`set_config` / `SET`:** Alle Aufrufe in Funktionen nennen den Namen als feste Zeichenfolge (`app.bypass_order_lock`,
   `app.order_force_delete`) mit festem Wert `'on'`/`'off'` oder dem zuvor gelesenen Wert dieses Schalters. Keine Funktion nimmt
   einen Einstellungsnamen oder -wert vom Benutzer entgegen.
2. **Dynamisches SQL (`EXECUTE`):** Nur feste Anweisungen mit `$1`-Parameter (`order_form_versions`) und die einmalige DO-Schleife in 0038
   (`DROP POLICY %I`, Namen aus `pg_policies`, keine Benutzereingabe). Kein `EXECUTE` mit `set_config`.
3. **Keine Funktion im Schema `public`**, die beliebiges SQL ausführt oder `set_config` weiterreicht (Suche nach `set_config`, `exec_sql`,
   `run_sql`, `execute_sql` ergab nichts). Die Schnittstelle (PostgREST) macht nur Funktionen aus `public` aufrufbar; `pg_catalog.set_config`
   gehört nicht dazu. Oberfläche und Edge Functions rufen kein `set_config`/`SET` auf (Suche in `src/`, `supabase/functions/`).
4. **Der Schalter selbst (zweimal nach Dev-Läufen geändert):**
   - Erster Lauf: `ALTER FUNCTION … SET app.order_edit` scheitert in Supabase (`permission denied to set parameter`, postgres ist kein Superuser).
   - Zweiter Lauf: Der Textersatz im bestehenden Funktionstext fand `BEGIN` nicht, weil die Datei auf dem Windows-Server mit CRLF ausgecheckt wird
     und im Funktionstext `BEGIN\r\n` steht.
   - Jetzt: 0049 legt `apply_order_changes` **vollständig neu an**. Der Text stammt Zeile für Zeile aus der letzten gültigen Fassung (0042; ein Test
     vergleicht beide), einzige Änderung ist die **erste Anweisung** `PERFORM set_config('app.order_edit', 'on', true)`. Rechte (nur angemeldete
     Benutzer), SECURITY INVOKER und search_path bleiben wie bisher. Die Selbstprüfung am Ende erkennt die Zeile mit `\n` und mit `\r\n`.
   - `order_edit_remove_services` (SECURITY DEFINER, Besitzer postgres) braucht den Schalter nicht: Der Besitzer umgeht die Policies, und im Projekt gibt es
     kein `FORCE ROW LEVEL SECURITY` (Suche in allen Migrationen: kein Treffer). Die Funktion bleibt unverändert.
   - Der dritte Parameter `true` macht den Schalter **transaktionslokal**: Er gilt nur bis zum Ende der Transaktion. Eine Schnittstellen-Anfrage ist genau eine
     Transaktion mit genau einem Funktionsaufruf, danach ist der Schalter weg (und wird auch auf einer weiterverwendeten Verbindung nicht mitgenommen).
   - `app.order_edit` kommt in keiner anderen Migration vor (der Test `lovableAbgleichMigrationen.test.ts` prüft das), keine öffentliche Funktion nimmt
     einen Einstellungsnamen entgegen, und `set_config` selbst ist über die Schnittstelle nicht aufrufbar. `apply_order_changes` prüft selbst,
     wer sie aufrufen darf (Ersteller/Master).
5. Annahme: Direkte Datenbankverbindungen (Rollen `postgres`, `authenticator`) sind für Clients nicht offen; Clients kommen nur über die
   Schnittstelle. Das gilt genauso für den bestehenden Schalter `app.bypass_order_lock`.

## Direkte Schreibzugriffe im Code und Wirkung von 0049

Suche in `src/` und `supabase/functions/` nach Schreibzugriffen (`insert/update/upsert/delete`) auf `measurement_orders`,
`measurement_parameters`, `order_measurements`. Spalte "blockiert?" gilt für **Ersteller ohne Master-Rolle an einem begonnenen Auftrag**;
Master sind nie blockiert, zugewiesene Messdienstleister bei `order_measurements` ebenfalls nicht.

| Stelle | Tabelle / Aktion | Wer | Blockiert durch 0049? |
|---|---|---|---|
| `orders.ts` `create`, `copy` | measurement_orders INSERT | Ersteller/Master | nein (INSERT-Regeln unverändert; neuer Auftrag ist unberührt) |
| `orders.ts` `copy` (Aufgaben, Parameter), `templates.ts` (Auftrag aus Vorlage) | order_measurements INSERT, measurement_parameters INSERT | Ersteller | nein (neue, unberührte Aufgaben) |
| `orders.ts` `update` → `OrderPriorityCell` | measurement_orders UPDATE (Priorität) | in der Auftragsliste nur Master (`editable={role === "master"}`) | nein |
| `orders.ts` `updateStatus`, `updateRanking` | measurement_orders UPDATE | `useUpdateOrderStatus` hat keinen Aufrufer; Ranking: Master/Planung | nein (kein Ersteller-Aufruf gefunden) |
| `orderSamples.ts` `syncPrimary` (Proben hinzufügen/entfernen: `OrderSamplesTab`, `OrderSamplesCard`, `M3ListForm`, `createOrderFlow`) | measurement_orders UPDATE (`sample_id`) | Ersteller | **ja, wäre blockiert → umgestellt** auf `order_sync_primary_sample` (geprüfte Funktion, nur Ersteller/Master) |
| `workflowDesigner.ts` `orderSharedFormData.merge` | measurement_orders UPDATE (`shared_form_data`) | nur `createOrderFlow` beim Anlegen (Auftrag noch unberührt) | nein |
| `measurementParameters.ts` `replace`, `insertOne`, `update`, `delete` (`MeasurementDataEntry`, `DynamicParameterForm`) | measurement_parameters | Ersteller (Vorgaben einer Aufgabe) | **ja**, an **begonnenen** Aufgaben (gewollt: dafür gibt es `amend_order_spec` mit Begründung). An unberührten Aufgaben nicht, auch nicht beim Hinzufügen einer Dienstleistung |
| `measurements.ts` `updateStatus`, `updateRanking`, `complete` | order_measurements UPDATE | Dienstleister (zugewiesen), Master, Projektleitung | nein für Dienstleister/Master. **Ja** nur, wenn ein Ersteller, der weder Master noch zugewiesen ist, eine begonnene Aufgabe direkt ändert (gewollt) |
| `measurements.ts` `update` (allgemein), `assign` | order_measurements UPDATE | kein Aufrufer in der Oberfläche (`assign` wird zusätzlich von der DB abgelehnt) | nein |
| `ruleTriggers.ts` | order_measurements INSERT/DELETE | Regelauslöser (Ersteller/Master/Projektleitung) | nein (INSERT/DELETE unverändert) |
| `apply_order_changes` (INVOKER) | measurement_orders, order_measurements, order_samples | Ersteller/Master im Bearbeiten-Modus | nein – Schalter `app.order_edit` |
| `order_edit_remove_services`, `amend_order_spec`, `reassign/claim/release_measurement`, Löschfunktionen (SECURITY DEFINER) | alle drei Tabellen | verschiedene | nein (laufen mit Funktionsrechten, ohne die Policies) |
| Edge Functions (`generate-order-report`, `db-integrity-check`, `mcp`) | nur lesend auf diesen Tabellen | – | nein |

**Offene Punkte aus dieser Liste:**
- Ändert ein Ersteller an einer **begonnenen** Aufgabe die Vorgaben direkt (`MeasurementDataEntry`), gibt es beim Ändern/Löschen keine
  Fehlermeldung, sondern stilles "keine Zeile betroffen" (die Datenbank blendet die Zeile aus), beim Anlegen einen Fehler. Der richtige Weg ist
  `amend_order_spec`. Bietet die Oberfläche das Ändern dort weiter an, wäre eine kleine Anpassung der Oberfläche sinnvoll.
- Projektleiter (`owner`/`leader`), die zugleich Ersteller sind, gelten wie Ersteller; Projektleiter, die nicht Ersteller sind, sind unberührt.
- Die Policies wurden nicht gegen eine echte Datenbank ausgeführt (keine DB-Zugriffe). Der Test in Dev (siehe Testanleitung) ist deshalb Pflicht
  vor dem Merge-Freigabe-Schritt und vor Prod.

## Einspielen in die Dev-DB (Dev-Sync)

Nach dem Merge nach `main` holt der Dev-Sync (`scripts/dev-db/sync-db-dev.ps1`, alle 10 Minuten über `update-dev-web.ps1`) die Dateien selbst.
0038 war bisher fehlgeschlagen und nicht eingetragen: der nächste Lauf nimmt dort wieder auf und spielt 0038 bis 0049 nacheinander ein.
Kontrolle über `sync-db-dev.log` und die Testanleitung `tasks/023-testanleitung.md`.

## Vorschlag (nicht umgesetzt): feste LF-Zeilenenden für `.sql` per `.gitattributes`

Befund: Im Repo liegen alle Migrationsdateien mit LF (`git ls-files --eol`: 251 von 252 Dateien `i/lf`). Auf den Windows-Rechnern und dem Server werden sie wegen
`core.autocrlf=true` mit CRLF ausgecheckt (`w/crlf`). `psql -f` schickt den Text so an die Datenbank; Funktionstexte enthalten dann `\r`
(Ursache des zweiten 0049-Fehlers). Auf Prod/Linux (LF) wäre derselbe Text ohne `\r`. Dieselbe Migration ergibt also in Dev und Prod verschiedene Funktionstexte.

Vorschlag: Datei `.gitattributes` im Repo-Wurzelordner mit

```
*.sql text eol=lf
drizzle/migrations/meta/*.json text eol=lf
```

- Wirkung: Beim Auschecken bekommen diese Dateien auf allen Rechnern LF. Der gespeicherte Inhalt im Repo ändert sich nicht (er ist schon LF),
  es entsteht also keine Änderung an bestehenden Migrationen und keine neue Prüfsumme.
- Vorteil: Dev (Windows) und Prod spielen byte-gleich ein; Textvergleiche (`pg_get_functiondef`) und künftige Textersatz-Migrationen sind unabhängig vom Rechner.
- Nachteile/Hinweise: Bereits in der Dev-DB eingespielte Funktionen behalten ihr `\r` (kein Problem, nur kosmetisch). Die Windows-Arbeitskopien müssen einmal
  neu ausgecheckt werden (`git rm --cached -r . && git reset --hard` oder `git add --renormalize .`), sonst bleiben vorhandene Dateien CRLF, bis sie sich ändern.
  Das Ceram-Repo (Prod) bräuchte dieselbe Datei; sie gehört zu den Dingen, die bei der Übertragung nach Prod mitgenommen werden müssen.
- Meine Einschätzung: sinnvoll und risikoarm. Umsetzen erst auf Deinen Wunsch, als eigener kleiner Branch.
