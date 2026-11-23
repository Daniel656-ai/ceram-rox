# Aufgabe 023 – Testanleitung für die Dev-Datenbank (drei Rollen)

Gilt für **Dev** (`supabase_db_ceram-rox-dev`, Port 55322). Nie in Produktion ausführen.
Die SQL-Skripte wurden von mir nicht gegen eine Datenbank ausgeführt (keine DB-Zugriffe); falls eines meldet, dass etwas
nicht passt, bitte die Meldung weitergeben – dann korrigiere ich es.

## Vorbereitung

1. Migrationen einspielen (siehe Abschnitt "Einspielen" im Bericht an den Nutzer bzw. `scripts/dev-db/README.md`). Im Log
   `C:\Users\Daniel.Gass\Ceram_Rox\dev-state\sync-db-dev.log` müssen 0038 bis 0049 ohne Fehler stehen.
2. Testbenutzer anlegen (Dev-Container, Name vorher prüfen):
   ```powershell
   Get-Content tasks\023-testuser-dev.sql -Raw | docker exec -i supabase_db_ceram-rox-dev psql -U postgres -d postgres -v nur_dev=ja -f -
   ```
   Ergebnis: `test-ersteller@example.test` (Auftraggeber) und `test-dienstleister@example.test` (Messdienstleister),
   Passwort für beide `Dev-Test-023!`. Der **Master** ist ein vorhandener Master-Benutzer der Dev-Datenbank.

## Teil A – Oberfläche (maßgeblich)

Lokaler Server gegen die Dev-DB: `npm run dev -- --open`. Danach `git checkout -- supabase/functions/mcp/index.ts`.

| # | Rolle | Schritte | Erwartung |
|---|---|---|---|
| 1 | Ersteller | Auftrag mit 2 Dienstleistungen und 1 Probe anlegen. | Wird angelegt (Parameter, Formularwerte gespeichert). |
| 2 | Ersteller | Auftrag **bearbeiten**: Priorität, Fälligkeit, Anmerkung ändern, speichern. | Gelingt (noch unberührt). |
| 3 | Master | Eine Aufgabe des Auftrags dem Dienstleister zuweisen. | Gelingt. |
| 4 | Dienstleister | Aufgabe öffnen, auf "In Arbeit" setzen, ein Ergebnis eintragen. Der Auftrag ist jetzt **begonnen**. | Gelingt. |
| 5 | Ersteller | Auftrag **bearbeiten** (Maske): Priorität/Fälligkeit/Anmerkung ändern, Probe hinzufügen, eine **noch unberührte** Dienstleistung entfernen, eine neue Dienstleistung **hinzufügen**. | Alles gelingt (Bearbeiten-Funktion; Schalter greift). Die begonnene Aufgabe lässt sich nicht entfernen. |
| 6 | Ersteller | Im Proben-Tab des begonnenen Auftrags Probe hinzufügen und wieder entfernen. | Gelingt; Hauptprobe (`sample_id`) wird nachgeführt. |
| 7 | Ersteller | Löschen des Auftrags (begonnen, mit Ergebnissen). | Wie bisher: Bestätigung mit Auftragsnummer, Löschen gelingt (unsere Regeln). |
| 8 | Ersteller | m³-Liste löschen (eigene). | Gelingt; fremde m³-Liste: Fehlermeldung. |
| 9 | Dienstleister | Eigene Aufgabe weiterbearbeiten, abschließen. | Gelingt (nicht durch 0049 gebremst). |
| 10 | Dienstleister | Auftragskopf bearbeiten. | Nicht möglich (wie vorher). |
| 11 | Master | Alles an dem begonnenen Auftrag: Priorität in der Auftragsliste ändern, Aufgabe umpriorisieren, bearbeiten, löschen. | Gelingt immer. |
| 12 | Master | Auftrag/Aufgabe, die dem Ersteller gehören, über die Bearbeiten-Maske ändern. | Gelingt. |

Gesperrte Lovable-Funktionen (Schritt 0048): Der Aufruf von `force_delete_order(uuid,text)`, `delete_m3_list(uuid,text)` und
`requester_remove_order_measurement(uuid,text)` muss "permission denied" liefern (siehe Teil B, Abschnitt "Sperre").

## Teil B – SQL-Prüfung (ergänzend)

### Policies

Auftrag, begonnen, dem Test-Ersteller gehörend (aus Teil A, Schritt 4/5), und eine begonnene Aufgabe davon:

```powershell
Get-Content tasks\023-testfaelle-dev.sql -Raw | docker exec -i supabase_db_ceram-rox-dev psql -U postgres -d postgres -v nur_dev=ja -v order_id=<UUID> -v started_meas=<UUID> -f -
```
Alles läuft in einer Transaktion und wird zurückgerollt. Jede Zeile muss `OK` melden (Ersteller: direkte Änderungen an begonnenem
Auftrag/Aufgabe/Parametern werden abgewiesen; Master: dürfen; Dienstleister: kein Zugriff auf den Auftragskopf).

### Sperre (0048)

```sql
-- im Dev-Container: als authenticated muss jeweils "permission denied" kommen
SET ROLE authenticated;
SELECT public.force_delete_order('00000000-0000-0000-0000-000000000000', 'x');
SELECT public.delete_m3_list('00000000-0000-0000-0000-000000000000', 'x');
SELECT public.requester_remove_order_measurement('00000000-0000-0000-0000-000000000000', 'abcdef');
-- Gegenprobe (unsere Funktion): muss "m³-Liste nicht vorhanden" o. ä. liefern, NICHT "permission denied"
SELECT public.delete_m3_list('00000000-0000-0000-0000-000000000000');
```
(In einer Datenbank ohne Lovable-Funktionen entfällt die Prüfung – dort gibt es sie nicht.)

### Trigger weg

```sql
SELECT tgname FROM pg_trigger WHERE tgname LIKE 'trg_guard_requester%';  -- muss 0 Zeilen liefern
```

## Teil C – Schalter-Prüfung

```sql
-- Die Zeile muss in apply_order_changes direkt hinter dem ersten BEGIN stehen (muss true liefern; \r\n wird toleriert)
SELECT pg_get_functiondef('public.apply_order_changes(uuid,jsonb,text)'::regprocedure)
         ~ 'BEGIN\r?\n\s*PERFORM set_config\(''app\.order_edit'', ''on'', true\)' AS schalter_am_anfang;
-- order_edit_remove_services braucht den Schalter nicht (SECURITY DEFINER): muss false liefern
SELECT pg_get_functiondef('public.order_edit_remove_services(uuid,uuid[],text)'::regprocedure) LIKE '%app.order_edit%' AS enthaelt_schalter;
-- In einer neuen Verbindung/Transaktion ist der Schalter nicht gesetzt: leer oder NULL
SELECT current_setting('app.order_edit', true);
```

## Aufräumen

`DELETE FROM auth.users WHERE email LIKE '%@example.test';` (nur Dev) und die Testaufträge über die Oberfläche löschen.

## Hinweis für Prod

In Prod nur **0048 und 0049 gemeinsam**, zusammen mit unserer neuen Oberfläche und mit Stefans Freigabe. Diese Testfälle
vorher in Dev bestanden haben.
