-- 0042: Dienstleistungen im Bearbeiten-Modus ENTFERNEN (Aufgabe 012, Stufe 3a).
--
-- ============================================================================================
-- DATENBANK-/BERECHTIGUNGSÄNDERUNG – vor der Übertragung nach PRODUKTION ist die Freigabe durch
-- Stefan erforderlich. In der Dev-Datenbank wird sie normal über den Merge eingespielt.
-- ============================================================================================
-- NEU: public.order_edit_remove_services(order_id, service_ids[], reason)  SECURITY DEFINER
--   Entfernt ALLE Aufgaben der genannten Dienstleistungen aus einem Auftrag. Darf der Auftragsersteller UND der
--   Master (bisher durfte Aufgaben nur der Master löschen: delete_order_measurement – diese Funktion und ihre Prüfung
--   _order_measurement_delete_facts bleiben UNVERÄNDERT). Voraussetzungen, alle serverseitig:
--     * angemeldet; Ersteller oder Master; Auftrag bearbeitbar (nicht abgeschlossen/gesperrt/intern) – wie order_edit_facts
--     * Begründung mit mindestens 5 Zeichen
--     * JEDE betroffene Aufgabe ist "unberührt" nach order_edit_facts (Status offen; keine echten Ergebnisse, Rohdaten,
--       Korrekturen, Arbeitszeiten, Dokumente, Uploads; nur vom Ersteller beim Anlegen vorbefüllte Formularwerte
--       zählen nicht – diese werden mit der Aufgabe gelöscht)
--     * Folgeaufgaben (source_measurement_id) einer betroffenen Aufgabe müssen ebenfalls mit entfernt werden
--     * mindestens eine andere Dienstleistung bleibt im Auftrag
--   Protokoll: je Aufgabe 'measurement_deleted' (wie delete_order_measurement) + ein Ereignis 'order_updated'
--   (fields = services_removed, Dienstleistungsnamen, Begründung). EXECUTE nur für authenticated; apply_order_changes ruft sie auf.
-- GEÄNDERT: public.apply_order_changes(uuid, jsonb, text): neuer optionaler Schlüssel changes.services.remove (uuid[]).
--   Ohne diesen Schlüssel verhält sich die Funktion unverändert.
-- Mehrfach ausführbar (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.order_edit_remove_services(_order_id uuid, _service_ids uuid[], _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _order public.measurement_orders%ROWTYPE;
  _facts jsonb;
  _reason_txt text := NULLIF(btrim(COALESCE(_reason, '')), '');
  _m record;
  _f jsonb;
  _task_ids uuid[];
  _names text[];
  _count int := 0;
  _del_facts jsonb;
  _remaining int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Bitte erneut anmelden.' USING ERRCODE = '42501'; END IF;
  IF _service_ids IS NULL OR cardinality(_service_ids) = 0 THEN RAISE EXCEPTION 'Keine Dienstleistung angegeben.'; END IF;
  IF _reason_txt IS NULL OR length(_reason_txt) < 5 THEN
    RAISE EXCEPTION 'Für das Entfernen einer Dienstleistung ist eine Begründung (mindestens 5 Zeichen) erforderlich.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('order_edit:' || _order_id::text, 0));
  SELECT * INTO _order FROM public.measurement_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auftrag nicht gefunden.' USING ERRCODE = 'P0002'; END IF;
  IF NOT (public.has_role(_uid, 'master'::public.app_role) OR _order.created_by = _uid) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Bearbeiten dieses Auftrags.' USING ERRCODE = '42501';
  END IF;

  _facts := public.order_edit_facts(_order_id);
  IF NOT COALESCE((_facts->>'can_edit')::boolean, false) THEN
    RAISE EXCEPTION 'Dieser Auftrag kann nicht bearbeitet werden (abgeschlossen, intern oder keine Berechtigung).' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(om.id), array_agg(DISTINCT s.service_name)
    INTO _task_ids, _names
    FROM public.order_measurements om
    LEFT JOIN public.measurement_services s ON s.id = om.service_id
   WHERE om.order_id = _order_id AND om.service_id = ANY(_service_ids);
  IF _task_ids IS NULL THEN RAISE EXCEPTION 'Die Dienstleistung gehört nicht (mehr) zu diesem Auftrag.'; END IF;

  -- jede Aufgabe muss unberührt sein (Definition wie in order_edit_facts)
  FOR _m IN SELECT id, measurement_number FROM public.order_measurements WHERE id = ANY(_task_ids) ORDER BY created_at, id LOOP
    SELECT e INTO _f FROM jsonb_array_elements(COALESCE(_facts->'measurements', '[]'::jsonb)) e
     WHERE (e->>'measurement_id')::uuid = _m.id;
    IF _f IS NULL OR NOT COALESCE((_f->>'untouched')::boolean, false) THEN
      RAISE EXCEPTION 'Die Dienstleistung kann nicht entfernt werden: Aufgabe % ist bereits in Bearbeitung.', COALESCE(_m.measurement_number, _m.id::text);
    END IF;
  END LOOP;

  -- Folgeaufgaben (Regeln) müssen mit entfernt werden
  IF EXISTS (SELECT 1 FROM public.order_measurements d
              WHERE d.source_measurement_id = ANY(_task_ids) AND NOT (d.id = ANY(_task_ids))) THEN
    RAISE EXCEPTION 'Aus dieser Dienstleistung sind Folgeaufgaben entstanden; sie müssen mit entfernt werden.';
  END IF;

  SELECT count(DISTINCT service_id) INTO _remaining
    FROM public.order_measurements WHERE order_id = _order_id AND NOT (id = ANY(_task_ids));
  IF _remaining = 0 THEN
    RAISE EXCEPTION 'Es muss mindestens eine Dienstleistung im Auftrag bleiben.';
  END IF;

  -- Ereignis VOR dem Löschen schreiben: der Benachrichtigungs-Trigger (0041) findet so auch die Zuständigen der entfernten Aufgaben.
  INSERT INTO public.activity_log (event_type, actor_user_id, order_id, project_id, metadata)
  VALUES ('order_updated', _uid, _order_id, _order.project_id,
          jsonb_build_object('fields', jsonb_build_array('services_removed'),
                             'services_removed', to_jsonb(COALESCE(_names, ARRAY[]::text[])),
                             'tasks_removed', cardinality(_task_ids),
                             'reason', _reason_txt));

  FOR _m IN SELECT id, service_id, measurement_number, status::text AS status, assigned_to
              FROM public.order_measurements WHERE id = ANY(_task_ids) ORDER BY created_at, id LOOP
    -- Historie der Aufgabe erhalten (sonst ON DELETE CASCADE): Bezug lösen, Auftragsbezug bleibt
    UPDATE public.activity_log
       SET order_measurement_id = NULL,
           metadata = metadata || jsonb_build_object('deleted_measurement_id', _m.id,
                                                     'deleted_measurement_number', _m.measurement_number)
     WHERE order_measurement_id = _m.id;
    INSERT INTO public.activity_log (event_type, actor_user_id, order_id, order_measurement_id, project_id, service_id, metadata)
    VALUES ('measurement_deleted', _uid, _order_id, NULL, _order.project_id, _m.service_id,
            jsonb_build_object('order_number', _order.order_number, 'measurement_id', _m.id,
                               'measurement_number', _m.measurement_number, 'status', _m.status,
                               'assigned_to', to_jsonb(_m.assigned_to), 'reason', _reason_txt,
                               'deleted_at', now(), 'via', 'order_edit'));
    DELETE FROM public.order_measurements WHERE id = _m.id;
    _count := _count + 1;
  END LOOP;

  RETURN jsonb_build_object('removed_tasks', _count, 'services', to_jsonb(COALESCE(_names, ARRAY[]::text[])));
END $$;
REVOKE ALL ON FUNCTION public.order_edit_remove_services(uuid, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_edit_remove_services(uuid, uuid[], text) TO authenticated;

COMMENT ON FUNCTION public.order_edit_remove_services(uuid, uuid[], text) IS
  'Aufgabe 012 Stufe 3a: unberührte Dienstleistungen (alle Aufgaben) aus einem Auftrag entfernen; Ersteller/Master, Begründung Pflicht, protokolliert.';

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
