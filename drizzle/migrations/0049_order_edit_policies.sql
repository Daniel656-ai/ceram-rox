-- 0049: Abgleich mit Lovable (Prod) – Teil 2: Schutz begonnener Aufträge per Policy statt Trigger (Aufgabe 023).
--
-- ============================================================================================
-- DATENBANK-/BERECHTIGUNGSÄNDERUNG.
-- IN PROD NUR 0048 UND 0049 GEMEINSAM EINSPIELEN – zusammen mit unserer neuen Oberfläche und
-- mit der Freigabe durch Stefan.
-- ============================================================================================
--
-- Lücke (besteht seit der ersten Version, Lovables Trigger hatte sie teilweise geschlossen und 0048 entfernt ihn):
-- Ein Ersteller ohne Master-Rolle darf measurement_orders, measurement_parameters und order_measurements direkt
-- über die Schnittstelle ändern – auch an BEGONNENEN Aufträgen, am Bearbeiten-Weg (apply_order_changes) und an
-- amend_order_spec (Begründung + Protokoll) vorbei.
--
-- Lösung: zusätzliche EINSCHRÄNKENDE (RESTRICTIVE) Policies. Sie ergänzen die bestehenden Regeln; nichts wird erweitert.
--   measurement_orders      UPDATE : nur Master, nicht begonnene Aufträge, oder unsere Bearbeiten-Funktionen
--   measurement_parameters  INSERT/UPDATE/DELETE : nur Master, Parameter UNBERÜHRTER Aufgaben, oder unsere Bearbeiten-Funktionen
--                           (neue Dienstleistungen bekommen ihre Parameter weiterhin direkt vom Client)
--   order_measurements      UPDATE : Ersteller (der weder Master noch zugewiesener Bearbeiter ist) nur an unberührten Aufgaben,
--                           sonst nur Master/Bearbeiter/unsere Bearbeiten-Funktionen. Messdienstleister (zugewiesen) und
--                           Projektleiter, die nicht Ersteller sind, bleiben unberührt.
--   INSERT-Regeln (Aufträge, Aufgaben anlegen) und DELETE bleiben unverändert.
--
-- "Begonnen" / "unberührt" = dieselben Kriterien wie die Bearbeiten-Maske (order_edit_facts, 0040):
--   Aufgabe unberührt = _order_measurement_delete_facts erlaubt (Status offen, keine Ergebnisse/Rohdaten/Korrekturen/
--   Arbeitszeiten/Dokumente/Uploads, Auftrag nicht gesperrt) ODER einziger Grund sind die vom Ersteller beim Anlegen
--   vorbefüllten Formularwerte ("form:…", nicht offiziell, innerhalb 10 Minuten).
--   Auftrag begonnen = Status nicht "open" ODER mindestens eine Aufgabe nicht unberührt ODER Zeitbuchungen ODER Berichte.
--
-- Schalter für unsere Funktionen: apply_order_changes (läuft mit den Rechten des Erstellers) und
-- order_edit_remove_services bekommen per ALTER FUNCTION ... SET app.order_edit = 'on' einen Funktions-Schalter.
-- PostgreSQL setzt ihn nur WÄHREND des Aufrufs und stellt den alten Wert danach wieder her. Der Funktionskörper bleibt
-- unverändert. Kein Client kann ihn selbst setzen (Prüfung siehe tasks/023-zusammenfuehrung.md, Abschnitt "Schalter").
-- ACHTUNG: Ersetzt eine spätere Migration eine dieser Funktionen mit CREATE OR REPLACE, bleibt die SET-Option erhalten
-- (PostgreSQL übernimmt sie), bei DROP+CREATE nicht – die Selbstprüfung unten würde das erkennen, wenn 0049 neu läuft.
--
-- Zusätzlich: public.order_sync_primary_sample(uuid) (SECURITY DEFINER). Der Client hielt measurement_orders.sample_id bisher
-- per direktem UPDATE aktuell; das wäre an begonnenen Aufträgen jetzt blockiert (Proben hinzufügen/entfernen ist dort erlaubt).
-- Die Funktion macht dasselbe, geprüft: nur Master oder Ersteller, sonst keine Wirkung.
--
-- Mehrfach ausführbar (CREATE OR REPLACE, DROP POLICY IF EXISTS, ALTER FUNCTION). Selbstprüfung am Ende.

-- 1) Hilfsfunktionen (nur lesend; von den Policies aufgerufen, deshalb für angemeldete Benutzer ausführbar)

CREATE OR REPLACE FUNCTION public.order_measurement_is_untouched(_measurement_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _m public.order_measurements%ROWTYPE;
  _o public.measurement_orders%ROWTYPE;
  _f jsonb;
  _all int;
  _pre int;
BEGIN
  SELECT * INTO _m FROM public.order_measurements WHERE id = _measurement_id;
  IF NOT FOUND THEN RETURN true; END IF;
  _f := public._order_measurement_delete_facts(_measurement_id);
  IF COALESCE((_f->>'allowed')::boolean, false) THEN RETURN true; END IF;
  -- Einziger Grund "Ergebnisse" und alle Ergebnisse sind vorbefüllte Formularwerte des Erstellers -> unberührt (wie 0040).
  IF COALESCE(_f->'blockers', '[]'::jsonb) = '["results"]'::jsonb THEN
    SELECT * INTO _o FROM public.measurement_orders WHERE id = _m.order_id;
    SELECT count(*) INTO _all FROM public.measurement_results WHERE order_measurement_id = _m.id;
    SELECT count(*) INTO _pre FROM public.measurement_results r
     WHERE r.order_measurement_id = _m.id
       AND r.is_official IS NOT TRUE
       AND r.result_name LIKE 'form:%'
       AND r.measured_by IS NOT DISTINCT FROM _o.created_by
       AND _o.created_by IS NOT NULL
       AND r.created_at <= _m.created_at + interval '10 minutes';
    RETURN _all > 0 AND _pre = _all;
  END IF;
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.order_measurement_is_untouched(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_measurement_is_untouched(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.order_is_started(_order_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _o public.measurement_orders%ROWTYPE;
BEGIN
  SELECT * INTO _o FROM public.measurement_orders WHERE id = _order_id;
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN _o.status::text <> 'open'
    OR EXISTS (SELECT 1 FROM public.order_measurements m
               WHERE m.order_id = _order_id AND NOT public.order_measurement_is_untouched(m.id))
    OR EXISTS (SELECT 1 FROM public.project_time_entries WHERE order_id = _order_id)
    OR EXISTS (SELECT 1 FROM public.order_reports WHERE order_id = _order_id);
END $$;
REVOKE ALL ON FUNCTION public.order_is_started(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_is_started(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.order_sync_primary_sample(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _creator uuid; _first uuid;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  SELECT created_by INTO _creator FROM public.measurement_orders WHERE id = _order_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT (public.has_role(_uid, 'master'::public.app_role) OR _creator = _uid) THEN RETURN; END IF;
  SELECT sample_id INTO _first FROM public.order_samples WHERE order_id = _order_id ORDER BY created_at, id LIMIT 1;
  UPDATE public.measurement_orders SET sample_id = _first WHERE id = _order_id AND sample_id IS DISTINCT FROM _first;
END $$;
REVOKE ALL ON FUNCTION public.order_sync_primary_sample(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_sync_primary_sample(uuid) TO authenticated;

-- 2) Schalter an unseren Bearbeiten-Funktionen (Funktionskörper unverändert)

ALTER FUNCTION public.apply_order_changes(uuid, jsonb, text) SET app.order_edit = 'on';
ALTER FUNCTION public.order_edit_remove_services(uuid, uuid[], text) SET app.order_edit = 'on';

-- 3) Einschränkende Policies

DROP POLICY IF EXISTS order_edit_restrict_orders_update ON public.measurement_orders;
CREATE POLICY order_edit_restrict_orders_update ON public.measurement_orders AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'master'::public.app_role)
         OR COALESCE(current_setting('app.order_edit', true), '') = 'on'
         OR NOT public.order_is_started(id))
  WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role)
         OR COALESCE(current_setting('app.order_edit', true), '') = 'on'
         OR NOT public.order_is_started(id));

DROP POLICY IF EXISTS order_edit_restrict_params_insert ON public.measurement_parameters;
CREATE POLICY order_edit_restrict_params_insert ON public.measurement_parameters AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role)
         OR COALESCE(current_setting('app.order_edit', true), '') = 'on'
         OR public.order_measurement_is_untouched(order_measurement_id));

DROP POLICY IF EXISTS order_edit_restrict_params_update ON public.measurement_parameters;
CREATE POLICY order_edit_restrict_params_update ON public.measurement_parameters AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'master'::public.app_role)
         OR COALESCE(current_setting('app.order_edit', true), '') = 'on'
         OR public.order_measurement_is_untouched(order_measurement_id))
  WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role)
         OR COALESCE(current_setting('app.order_edit', true), '') = 'on'
         OR public.order_measurement_is_untouched(order_measurement_id));

DROP POLICY IF EXISTS order_edit_restrict_params_delete ON public.measurement_parameters;
CREATE POLICY order_edit_restrict_params_delete ON public.measurement_parameters AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'master'::public.app_role)
         OR COALESCE(current_setting('app.order_edit', true), '') = 'on'
         OR public.order_measurement_is_untouched(order_measurement_id));

DROP POLICY IF EXISTS order_edit_restrict_measurements_update ON public.order_measurements;
CREATE POLICY order_edit_restrict_measurements_update ON public.order_measurements AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'master'::public.app_role)
         OR COALESCE(current_setting('app.order_edit', true), '') = 'on'
         OR assigned_to = auth.uid()
         OR NOT public.is_order_creator(auth.uid(), order_id)
         OR public.order_measurement_is_untouched(id))
  WITH CHECK (public.has_role(auth.uid(), 'master'::public.app_role)
         OR COALESCE(current_setting('app.order_edit', true), '') = 'on'
         OR assigned_to = auth.uid()
         OR NOT public.is_order_creator(auth.uid(), order_id)
         OR public.order_measurement_is_untouched(id));

-- 4) Selbstprüfung (Abbruch = nichts wird übernommen)
DO $$
DECLARE _f text;
BEGIN
  FOREACH _f IN ARRAY ARRAY['public.apply_order_changes(uuid,jsonb,text)', 'public.order_edit_remove_services(uuid,uuid[],text)'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure(_f) AND 'app.order_edit=on' = ANY (p.proconfig)) THEN
      RAISE EXCEPTION '0049: Funktions-Schalter app.order_edit fehlt an %', _f;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND permissive = 'RESTRICTIVE'
        AND policyname IN ('order_edit_restrict_orders_update', 'order_edit_restrict_params_insert',
                           'order_edit_restrict_params_update', 'order_edit_restrict_params_delete',
                           'order_edit_restrict_measurements_update')) <> 5 THEN
    RAISE EXCEPTION '0049: nicht alle fünf einschränkenden Policies vorhanden';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.order_is_started(uuid)'), 'EXECUTE')
     OR has_function_privilege('anon', to_regprocedure('public.order_measurement_is_untouched(uuid)'), 'EXECUTE')
     OR has_function_privilege('anon', to_regprocedure('public.order_sync_primary_sample(uuid)'), 'EXECUTE') THEN
    RAISE EXCEPTION '0049: Hilfsfunktionen dürfen für anon nicht aufrufbar sein';
  END IF;
END $$;
