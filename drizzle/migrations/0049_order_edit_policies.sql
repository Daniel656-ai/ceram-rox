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
-- Schalter: apply_order_changes (läuft mit den Rechten des Erstellers) setzt als erste Anweisung
--   PERFORM set_config('app.order_edit', 'on', true)   (true = nur bis zum Ende der Transaktion).
-- (Ein ALTER FUNCTION ... SET app.order_edit scheitert in Supabase: postgres ist kein Superuser, "permission denied to set parameter".
-- set_config innerhalb einer Funktion braucht keine Sonderrechte; dasselbe Muster nutzen wir seit Langem für app.bypass_order_lock.)
-- Ein Textersatz im bestehenden Funktionstext scheitert auf dem Windows-Server (CRLF-Zeilenenden). Deshalb wird die Funktion hier
-- vollständig neu angelegt: Text 1:1 aus 0042, plus die eine set_config-Zeile hinter BEGIN. Rechte, SECURITY-Art, search_path wie bisher.
-- order_edit_remove_services (SECURITY DEFINER) braucht den Schalter nicht (Besitzer umgeht die Policies).
-- Gültigkeit: Eine Schnittstellen-Anfrage ist genau EINE Transaktion mit genau EINEM Funktionsaufruf; danach ist der Schalter weg.
-- Kein Client kann ihn selbst setzen (Prüfung siehe tasks/023-zusammenfuehrung.md, Abschnitt "Schalter"): set_config ist über die
-- Schnittstelle nicht aufrufbar und keine andere öffentliche Funktion setzt app.order_edit.
-- ACHTUNG: Ersetzt eine spätere Migration apply_order_changes mit eigenem Text, muss sie die set_config-Zeile übernehmen;
-- die Selbstprüfung unten würde das beim erneuten Ausführen von 0049 erkennen.
--
-- Zusätzlich: public.order_sync_primary_sample(uuid) (SECURITY DEFINER). Der Client hielt measurement_orders.sample_id bisher
-- per direktem UPDATE aktuell; das wäre an begonnenen Aufträgen jetzt blockiert (Proben hinzufügen/entfernen ist dort erlaubt).
-- Die Funktion macht dasselbe, geprüft: nur Master oder Ersteller, sonst keine Wirkung.
--
-- Mehrfach ausführbar (CREATE OR REPLACE, DROP POLICY IF EXISTS). Selbstprüfung am Ende.

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

-- 2) Schalter in apply_order_changes (SECURITY INVOKER, läuft mit den Rechten des Erstellers).
--    Text 1:1 aus der letzten gültigen Fassung (0042); einzige Änderung: die PERFORM set_config-Zeile direkt hinter BEGIN.
--    order_edit_remove_services (SECURITY DEFINER, Besitzer postgres) braucht den Schalter nicht: Der Besitzer umgeht die Policies
--    (im Projekt gibt es kein FORCE ROW LEVEL SECURITY).

CREATE OR REPLACE FUNCTION public.apply_order_changes(_order_id uuid, _changes jsonb, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _facts jsonb;
  _order public.measurement_orders%ROWTYPE;
  _reason_txt text := NULLIF(btrim(COALESCE(_reason, '')), '');
  _started boolean;
  _h jsonb := COALESCE(_changes->'header', '{}'::jsonb);
  _s jsonb := COALESCE(_changes->'samples', '{}'::jsonb);
  _t jsonb := _changes->'template';
  _fields text[] := ARRAY[]::text[];
  _need_reason boolean := false;
  _new_type public.order_type := NULL;
  _type_changed boolean := false;
  _project_changed boolean := false;
  _new_project uuid;
  _eff_project uuid;
  _old_project_label text;
  _new_project_label text;
  _add uuid[];
  _remove uuid[];
  _sid uuid;
  _locked_samples jsonb;
  _removed_nums text[] := ARRAY[]::text[];
  _added_nums text[] := ARRAY[]::text[];
  _num text;
  _tmpl_changed boolean := false;
  _old_tmpl jsonb;
  _new_values jsonb;
  _shared jsonb;
  _expected timestamptz;
  _priority_changed boolean := false;
  _svc_remove uuid[] := ARRAY[]::uuid[];
BEGIN
  PERFORM set_config('app.order_edit', 'on', true);  -- Schalter für die Policies (0049), nur bis Transaktionsende
  IF _uid IS NULL THEN RAISE EXCEPTION 'Bitte erneut anmelden.' USING ERRCODE = '42501'; END IF;
  IF _changes IS NULL OR jsonb_typeof(_changes) <> 'object' THEN
    RAISE EXCEPTION 'Ungültige Änderungsdaten.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('order_edit:' || _order_id::text, 0));
  SELECT * INTO _order FROM public.measurement_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auftrag nicht gefunden.' USING ERRCODE = 'P0002'; END IF;

  -- Optimistische Sperre: zwischenzeitliche Änderungen nicht überschreiben.
  IF _changes ? 'expected_updated_at' AND NULLIF(_changes->>'expected_updated_at', '') IS NOT NULL THEN
    _expected := (_changes->>'expected_updated_at')::timestamptz;
    IF _order.updated_at > _expected THEN
      RAISE EXCEPTION 'Der Auftrag wurde zwischenzeitlich geändert. Bitte die Seite neu laden.' USING ERRCODE = '40001';
    END IF;
  END IF;

  _facts := public.order_edit_facts(_order_id);
  IF NOT COALESCE((_facts->>'can_edit')::boolean, false) THEN
    IF COALESCE((_facts->>'locked')::boolean, false) THEN
      RAISE EXCEPTION 'Auftrag ist abgeschlossen und schreibgeschützt.' USING ERRCODE = '42501';
    END IF;
    IF COALESCE((_facts->>'internal')::boolean, false) THEN
      RAISE EXCEPTION 'Interne Prüfaufträge werden in der Prüfmittelüberwachung bearbeitet.' USING ERRCODE = '42501';
    END IF;
    RAISE EXCEPTION 'Keine Berechtigung zum Bearbeiten dieses Auftrags.' USING ERRCODE = '42501';
  END IF;
  _started := COALESCE((_facts->>'started')::boolean, false);

  -- ---- Kopfdaten prüfen ----
  IF _h ? 'order_type' THEN
    _new_type := (_h->>'order_type')::public.order_type;
    IF _new_type::text = 'internal' THEN RAISE EXCEPTION 'Der Auftragstyp „Intern“ kann hier nicht gewählt werden.'; END IF;
    IF _new_type IS DISTINCT FROM _order.order_type THEN
      IF _started THEN
        RAISE EXCEPTION 'Der Auftragstyp kann nicht mehr geändert werden, weil am Auftrag bereits gearbeitet wurde.';
      END IF;
      _type_changed := true; _need_reason := true; _fields := _fields || 'order_type'::text;
    END IF;
  END IF;

  _eff_project := _order.project_id;
  IF _h ? 'project_id' THEN
    _new_project := NULLIF(_h->>'project_id', '')::uuid;
    IF _new_project IS DISTINCT FROM _order.project_id THEN
      IF _started THEN
        RAISE EXCEPTION 'Das Projekt kann nicht mehr geändert werden, weil am Auftrag bereits gearbeitet wurde.';
      END IF;
      _project_changed := true; _need_reason := true; _eff_project := _new_project; _fields := _fields || 'project_id'::text;
    END IF;
  END IF;
  IF COALESCE(_new_type, _order.order_type)::text = 'rnd' AND _eff_project IS NULL THEN
    RAISE EXCEPTION 'F&E-Aufträge benötigen ein Projekt.';
  END IF;

  IF _h ? 'priority' AND (_h->>'priority')::public.order_priority IS DISTINCT FROM _order.priority THEN
    _priority_changed := true; _fields := _fields || 'priority'::text;
  END IF;
  IF _h ? 'due_date' AND NULLIF(_h->>'due_date', '')::date IS DISTINCT FROM _order.due_date THEN
    _fields := _fields || 'due_date'::text;
  END IF;
  IF _h ? 'notes' AND NULLIF(_h->>'notes', '') IS DISTINCT FROM _order.notes THEN
    _fields := _fields || 'notes'::text;
  END IF;

  -- ---- Proben prüfen ----
  _add := ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(COALESCE(_s->'add', '[]'::jsonb)) x);
  _remove := ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(COALESCE(_s->'remove', '[]'::jsonb)) x);
  _locked_samples := COALESCE(_facts->'samples', '[]'::jsonb);
  FOREACH _sid IN ARRAY _remove LOOP
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(_locked_samples) e
               WHERE (e->>'sample_id')::uuid = _sid AND (e->>'locked')::boolean) THEN
      RAISE EXCEPTION 'Die Probe kann nicht entfernt werden, weil Aufgaben oder eine Ersatzprobe daran hängen.';
    END IF;
  END LOOP;
  IF cardinality(_remove) > 0 THEN _need_reason := true; _fields := _fields || 'samples_removed'::text; END IF;
  IF cardinality(_add) > 0 THEN _fields := _fields || 'samples_added'::text; END IF;

  -- ---- Dienstleistungen entfernen (Stufe 3a) ----
  -- Die eigentliche Prüfung (unberührt, Folgeaufgaben, mind. eine Dienstleistung bleibt) und das Löschen macht
  -- order_edit_remove_services (SECURITY DEFINER); hier nur: Begründung ist Pflicht.
  _svc_remove := ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(COALESCE(_changes->'services'->'remove', '[]'::jsonb)) x);
  IF cardinality(_svc_remove) > 0 THEN _need_reason := true; END IF;

  -- ---- Auftragsformular (Vorlagenwerte) ----
  IF _t IS NOT NULL AND jsonb_typeof(_t) = 'object' THEN
    _new_values := COALESCE(_t->'values', '{}'::jsonb);
    _old_tmpl := COALESCE(_order.shared_form_data->'template', '{}'::jsonb);
    IF COALESCE(_old_tmpl->'values', '{}'::jsonb) IS DISTINCT FROM _new_values THEN
      _tmpl_changed := true; _fields := _fields || 'template'::text;
      IF _started THEN _need_reason := true; END IF;
    END IF;
  END IF;

  IF cardinality(_fields) = 0 AND cardinality(_svc_remove) = 0 THEN
    RETURN jsonb_build_object('changed', false, 'fields', '[]'::jsonb);
  END IF;
  IF _need_reason AND _reason_txt IS NULL THEN
    RAISE EXCEPTION 'Bitte eine Begründung für die Änderung angeben.';
  END IF;

  -- ---- Änderungen anwenden ----
  IF _project_changed THEN
    SELECT NULLIF(concat_ws(' – ', project_number, project_name), '') INTO _old_project_label
      FROM public.projects WHERE id = _order.project_id;
    SELECT NULLIF(concat_ws(' – ', project_number, project_name), '') INTO _new_project_label
      FROM public.projects WHERE id = _new_project;
  END IF;

  IF _tmpl_changed THEN
    _shared := COALESCE(_order.shared_form_data, '{}'::jsonb);
    _shared := jsonb_set(_shared, '{template}',
      _old_tmpl || jsonb_build_object(
        'form_definition_id', COALESCE(NULLIF(_t->>'form_definition_id', ''), _old_tmpl->>'form_definition_id'),
        'order_kind', COALESCE(_old_tmpl->>'order_kind', _order.order_kind::text),
        'values', _new_values,
        'saved_at', to_jsonb(now()),
        'saved_by', to_jsonb(_uid)), true);
  END IF;

  UPDATE public.measurement_orders SET
    order_type = CASE WHEN _type_changed THEN _new_type ELSE order_type END,
    is_billed = CASE WHEN _type_changed AND _new_type::text <> 'customer' THEN false ELSE is_billed END,
    project_id = CASE WHEN _project_changed THEN _new_project ELSE project_id END,
    priority = CASE WHEN _priority_changed THEN (_h->>'priority')::public.order_priority ELSE priority END,
    due_date = CASE WHEN _h ? 'due_date' THEN NULLIF(_h->>'due_date', '')::date ELSE due_date END,
    notes = CASE WHEN _h ? 'notes' THEN NULLIF(_h->>'notes', '') ELSE notes END,
    shared_form_data = CASE WHEN _tmpl_changed THEN _shared ELSE shared_form_data END,
    pp_experiment_number = CASE WHEN _tmpl_changed AND _t ? 'experiment_number'
                                THEN NULLIF(_t->>'experiment_number', '') ELSE pp_experiment_number END
  WHERE id = _order_id;

  -- Proben (n:m) + erste Probe als Hauptprobe nachführen (wie bisher api.orderSamples)
  IF cardinality(_remove) > 0 THEN
    FOREACH _sid IN ARRAY _remove LOOP
      SELECT sample_number INTO _num FROM public.samples WHERE id = _sid;
      _removed_nums := _removed_nums || COALESCE(_num, _sid::text);
    END LOOP;
    DELETE FROM public.order_samples WHERE order_id = _order_id AND sample_id = ANY(_remove);
  END IF;
  IF cardinality(_add) > 0 THEN
    FOREACH _sid IN ARRAY _add LOOP
      IF NOT EXISTS (SELECT 1 FROM public.order_samples WHERE order_id = _order_id AND sample_id = _sid) THEN
        INSERT INTO public.order_samples (order_id, sample_id, created_by) VALUES (_order_id, _sid, _uid);
        SELECT sample_number INTO _num FROM public.samples WHERE id = _sid;
        _added_nums := _added_nums || COALESCE(_num, _sid::text);
      END IF;
    END LOOP;
  END IF;
  IF cardinality(_remove) > 0 OR cardinality(_add) > 0 THEN
    UPDATE public.measurement_orders SET sample_id = (
      SELECT sample_id FROM public.order_samples WHERE order_id = _order_id ORDER BY created_at, id LIMIT 1)
    WHERE id = _order_id;
  END IF;

  -- ---- Protokoll ----
  -- Priorität protokolliert der vorhandene Trigger (log_order_priority_change) selbst.
  IF _type_changed THEN
    INSERT INTO public.order_audit_log (order_id, changed_by, field_name, old_value, new_value)
    VALUES (_order_id, _uid, 'order_type', _order.order_type::text, _new_type::text);
  END IF;
  IF _type_changed AND _order.is_billed AND _new_type::text <> 'customer' THEN
    INSERT INTO public.order_audit_log (order_id, changed_by, field_name, old_value, new_value)
    VALUES (_order_id, _uid, 'is_billed', 'true', 'false');
  END IF;
  IF _project_changed THEN
    INSERT INTO public.order_audit_log (order_id, changed_by, field_name, old_value, new_value)
    VALUES (_order_id, _uid, 'project_id', _old_project_label, _new_project_label);
  END IF;
  IF 'due_date' = ANY(_fields) THEN
    INSERT INTO public.order_audit_log (order_id, changed_by, field_name, old_value, new_value)
    VALUES (_order_id, _uid, 'due_date', _order.due_date::text, NULLIF(_h->>'due_date', ''));
  END IF;
  IF 'notes' = ANY(_fields) THEN
    INSERT INTO public.order_audit_log (order_id, changed_by, field_name, old_value, new_value)
    VALUES (_order_id, _uid, 'notes', _order.notes, NULLIF(_h->>'notes', ''));
  END IF;

  -- activity_log erlaubt authenticated kein direktes INSERT -> über die geprüfte Hilfsfunktion.
  IF cardinality(_fields) > 0 THEN
    PERFORM public.order_edit_log_activity(
      _order_id, _fields, _added_nums, _removed_nums, _tmpl_changed,
      CASE WHEN _type_changed THEN _order.order_type::text END,
      CASE WHEN _type_changed THEN _new_type::text END,
      _reason_txt);
  END IF;

  -- Dienstleistungen entfernen (schreibt sein eigenes Ereignis 'order_updated' mit Dienstleistungsnamen)
  IF cardinality(_svc_remove) > 0 THEN
    PERFORM public.order_edit_remove_services(_order_id, _svc_remove, _reason_txt);
    _fields := _fields || 'services_removed'::text;
  END IF;

  RETURN jsonb_build_object('changed', true, 'fields', to_jsonb(_fields));
END $$;
REVOKE ALL ON FUNCTION public.apply_order_changes(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_order_changes(uuid, jsonb, text) TO authenticated;

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
BEGIN
  -- Die Zeile muss in apply_order_changes direkt hinter dem ersten BEGIN stehen (Zeilenenden \n oder \r\n).
  IF pg_get_functiondef(to_regprocedure('public.apply_order_changes(uuid,jsonb,text)'))
       !~ 'BEGIN\r?\n\s*PERFORM set_config\(''app\.order_edit'', ''on'', true\)' THEN
    RAISE EXCEPTION '0049: Schalter app.order_edit fehlt oder steht nicht am Anfang von apply_order_changes';
  END IF;
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
