-- Aufgabe 023: Prüfung der Policies aus 0049 in der DEV-Datenbank (nur Dev; alles läuft in einer Transaktion und wird zurückgerollt).
--
-- Voraussetzung: 0048/0049 sind in Dev eingespielt; Testbenutzer aus tasks/023-testuser-dev.sql sind angelegt;
-- ein BEGONNENER Auftrag, der dem Testbenutzer "Ersteller" gehört (siehe tasks/023-testanleitung.md, Schritt 2).
--
-- Aufruf (am Server, im DEV-Container):
--   docker exec -i supabase_db_ceram-rox-dev psql -U postgres -d postgres -v nur_dev=ja \
--     -v order_id=<Auftrags-UUID> -v started_meas=<UUID einer begonnenen Aufgabe> \
--     -f - < tasks/023-testfaelle-dev.sql
-- Jede Zeile "ERGEBNIS" muss "OK" melden. "FEHLER" = Policy greift nicht wie erwartet.

\if :{?nur_dev}
\else
  \echo 'ABBRUCH: bitte mit -v nur_dev=ja starten (nur Dev!).'
  \quit
\endif

BEGIN;

CREATE TEMP TABLE t_ergebnis(fall text, ergebnis text);
GRANT ALL ON t_ergebnis TO authenticated;

-- Hilfsfunktion: führt eine Änderung als Benutzer aus; meldet, wie viele Zeilen sie getroffen hat oder welchen Fehler es gab.
CREATE FUNCTION pg_temp.versuche(_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  EXECUTE _sql; GET DIAGNOSTICS n = ROW_COUNT; RETURN n || ' Zeile(n)';
EXCEPTION WHEN OTHERS THEN RETURN 'Fehler: ' || SQLERRM;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.versuche(text) TO authenticated;

-- ===== Rolle 1: Ersteller ohne Master =====
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

INSERT INTO t_ergebnis SELECT 'Ersteller: Auftrag begonnen? (muss true sein)', CASE WHEN order_is_started(:'order_id'::uuid) THEN 'OK' ELSE 'FEHLER (Auftrag ist nicht begonnen – falscher Testauftrag?)' END;

INSERT INTO t_ergebnis SELECT 'Ersteller: Priorität am begonnenen Auftrag direkt ändern (erwartet: 0 Zeilen)',
  CASE WHEN pg_temp.versuche(format('UPDATE measurement_orders SET priority = priority WHERE id = %L', :'order_id')) LIKE '0 Zeile%' THEN 'OK' ELSE 'FEHLER: ' || pg_temp.versuche(format('UPDATE measurement_orders SET priority = priority WHERE id = %L', :'order_id')) END;

INSERT INTO t_ergebnis SELECT 'Ersteller: begonnene Aufgabe direkt ändern (erwartet: 0 Zeilen)',
  CASE WHEN pg_temp.versuche(format('UPDATE order_measurements SET priority = priority WHERE id = %L', :'started_meas')) LIKE '0 Zeile%' THEN 'OK' ELSE 'FEHLER' END;

INSERT INTO t_ergebnis SELECT 'Ersteller: Parameter der begonnenen Aufgabe löschen (erwartet: 0 Zeilen)',
  CASE WHEN pg_temp.versuche(format('DELETE FROM measurement_parameters WHERE order_measurement_id = %L', :'started_meas')) LIKE '0 Zeile%' THEN 'OK' ELSE 'FEHLER' END;

INSERT INTO t_ergebnis SELECT 'Ersteller: Parameter für begonnene Aufgabe neu anlegen (erwartet: Fehler)',
  CASE WHEN pg_temp.versuche(format('INSERT INTO measurement_parameters(order_measurement_id, parameter_name, parameter_value) VALUES (%L, ''x'', ''y'')', :'started_meas')) LIKE 'Fehler%' THEN 'OK' ELSE 'FEHLER' END;

-- Hauptprobe nachführen darf der Ersteller weiterhin (geprüfte Funktion, kein Fehler)
INSERT INTO t_ergebnis SELECT 'Ersteller: order_sync_primary_sample am begonnenen Auftrag (erwartet: kein Fehler)',
  CASE WHEN pg_temp.versuche(format('SELECT order_sync_primary_sample(%L)', :'order_id')) NOT LIKE 'Fehler%' THEN 'OK' ELSE 'FEHLER' END;

-- ===== Rolle 2: Messdienstleister (nicht Ersteller): darf an Aufgaben arbeiten, wenn ihm zugewiesen =====
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

INSERT INTO t_ergebnis SELECT 'Dienstleister: Auftrag direkt ändern (erwartet: 0 Zeilen, hatte nie Recht)',
  CASE WHEN pg_temp.versuche(format('UPDATE measurement_orders SET priority = priority WHERE id = %L', :'order_id')) LIKE '0 Zeile%' THEN 'OK' ELSE 'FEHLER' END;
-- Zuweisung an den Dienstleister: von Hand in der Oberfläche prüfen (siehe Testanleitung, Schritt 5).

-- ===== Rolle 3: Master =====
RESET ROLE;
SET LOCAL ROLE authenticated;
-- Master-UUID einsetzen: erster Benutzer mit Master-Rolle der Dev-Datenbank
SELECT set_config('request.jwt.claims',
  json_build_object('sub', (SELECT user_id FROM public.user_roles WHERE role = 'master' LIMIT 1), 'role', 'authenticated')::text, true);

INSERT INTO t_ergebnis SELECT 'Master: begonnenen Auftrag direkt ändern (erwartet: 1 Zeile)',
  CASE WHEN pg_temp.versuche(format('UPDATE measurement_orders SET priority = priority WHERE id = %L', :'order_id')) LIKE '1 Zeile%' THEN 'OK' ELSE 'FEHLER' END;

INSERT INTO t_ergebnis SELECT 'Master: begonnene Aufgabe direkt ändern (erwartet: 1 Zeile)',
  CASE WHEN pg_temp.versuche(format('UPDATE order_measurements SET priority = priority WHERE id = %L', :'started_meas')) LIKE '1 Zeile%' THEN 'OK' ELSE 'FEHLER' END;

RESET ROLE;
SELECT fall, ergebnis AS "ERGEBNIS" FROM t_ergebnis;
ROLLBACK;  -- nichts bleibt zurück
