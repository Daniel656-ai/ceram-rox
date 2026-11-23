-- 0048: Abgleich mit Lovable (Prod) – Teil 1: Lovables Bearbeiten-Trigger entfernen, Lovables Funktionen sperren (Aufgabe 023).
--
-- ============================================================================================
-- DATENBANK-/BERECHTIGUNGSÄNDERUNG.
-- IN PROD NUR 0048 UND 0049 GEMEINSAM EINSPIELEN – zusammen mit unserer neuen Oberfläche und
-- mit der Freigabe durch Stefan. 0048 allein würde die Schutzlücke an begonnenen Aufträgen
-- (siehe 0049) wieder öffnen; die Lovable-Oberfläche in Prod ruft die hier gesperrten Funktionen
-- noch auf und würde danach nicht mehr löschen/entfernen können.
-- ============================================================================================
--
-- Hintergrund: Lovable hat in Prod (0037/0040) Funktionen und Trigger angelegt, die sich mit unseren
-- Lösungen (Auftrag löschen, m³-Liste löschen, Auftrag bearbeiten) überschneiden. Grundsatz: Es gilt UNSERE Lösung.
--
-- 1) Trigger entfernen (blockierten unser Bearbeiten für Ersteller begonnener Aufträge):
--      trg_guard_requester_order_edit  auf measurement_orders
--      trg_guard_requester_param_edit  auf measurement_parameters
--    Die Funktion guard_requester_order_edit() bleibt bestehen (nicht aufgerufen). Die Schutzwirkung ersetzt 0049.
-- 2) Per REVOKE EXECUTE gesperrt (NICHT gelöscht, jederzeit mit GRANT wieder freigebbar):
--      force_delete_order(uuid, text)               Lovables Master-Löschen mit Hash
--      delete_m3_list(uuid, text)                   Lovables m³-Listen-Löschen mit Hash (unsere Variante: delete_m3_list(uuid))
--      requester_remove_order_measurement(uuid, text) Lovables Dienstleistung entfernen (unsere: order_edit_remove_services)
--    Lovables reine Vorschau-/Lesefunktionen (preview_force_delete_order, preview_delete_m3_list,
--    order_requester_edit_state, order_requester_block_reason) bleiben unverändert.
--
-- Mehrfach ausführbar. Läuft auch auf einer Datenbank OHNE die Lovable-Objekte (dann passiert nichts).
-- Eine Selbstprüfung am Ende bricht ab (nichts wird übernommen), wenn Trigger noch existieren
-- oder eine der drei Funktionen für angemeldete Benutzer noch aufrufbar ist.

DROP TRIGGER IF EXISTS trg_guard_requester_order_edit ON public.measurement_orders;
DROP TRIGGER IF EXISTS trg_guard_requester_param_edit ON public.measurement_parameters;

DO $$
DECLARE _sig text;
BEGIN
  FOREACH _sig IN ARRAY ARRAY[
    'public.force_delete_order(uuid,text)',
    'public.delete_m3_list(uuid,text)',
    'public.requester_remove_order_measurement(uuid,text)'
  ] LOOP
    IF to_regprocedure(_sig) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', _sig);
    END IF;
  END LOOP;
END $$;

-- Selbstprüfung
DO $$
DECLARE _sig text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger t
             WHERE NOT t.tgisinternal
               AND t.tgname IN ('trg_guard_requester_order_edit', 'trg_guard_requester_param_edit')) THEN
    RAISE EXCEPTION '0048: Lovable-Trigger trg_guard_requester_* existiert noch';
  END IF;
  FOREACH _sig IN ARRAY ARRAY[
    'public.force_delete_order(uuid,text)',
    'public.delete_m3_list(uuid,text)',
    'public.requester_remove_order_measurement(uuid,text)'
  ] LOOP
    IF to_regprocedure(_sig) IS NOT NULL
       AND (has_function_privilege('authenticated', to_regprocedure(_sig), 'EXECUTE')
            OR has_function_privilege('anon', to_regprocedure(_sig), 'EXECUTE')) THEN
      RAISE EXCEPTION '0048: % ist noch aufrufbar', _sig;
    END IF;
  END LOOP;
  -- Unsere eigenen Funktionen müssen weiter aufrufbar sein.
  IF to_regprocedure('public.delete_m3_list(uuid)') IS NOT NULL
     AND NOT has_function_privilege('authenticated', to_regprocedure('public.delete_m3_list(uuid)'), 'EXECUTE') THEN
    RAISE EXCEPTION '0048: unsere delete_m3_list(uuid) ist nicht mehr aufrufbar';
  END IF;
END $$;
