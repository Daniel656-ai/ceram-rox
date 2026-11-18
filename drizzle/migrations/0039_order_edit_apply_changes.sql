-- 0039: Auftrag im Bearbeiten-Modus ändern (Aufgabe 012, Stufe 1).
--
-- ============================================================================================
-- DATENBANK-/BERECHTIGUNGSÄNDERUNG – vor der Übertragung nach PRODUKTION ist die Freigabe durch
-- Stefan erforderlich. In der Dev-Datenbank wird sie normal über den Merge eingespielt.
-- ============================================================================================
-- Rein additiv und mehrfach ausführbar (CREATE OR REPLACE, REVOKE/GRANT sind wiederholbar):
--   * Neue Funktion  public.order_edit_facts(uuid)               SECURITY DEFINER, nur lesend
--   * Neue Funktion  public.apply_order_changes(uuid,jsonb,text) SECURITY INVOKER (Rechte des Aufrufers)
--   * Neue Funktion  public.order_edit_log_activity(...)         SECURITY DEFINER, schreibt NUR das Ereignis
--                    "order_updated" in activity_log. Nötig, weil activity_log für angemeldete Benutzer kein
--                    direktes INSERT erlaubt (Policy "Only triggers insert activity", WITH CHECK (false));
--                    die Policy bleibt unverändert. Die Funktion prüft selbst: nur Ersteller/Master des
--                    Auftrags, Metadaten werden in der Funktion aufgebaut (nichts frei Wählbares).
--   * EXECUTE nur für angemeldete Benutzer (authenticated); nicht für PUBLIC/anon.
-- Keine Tabellen-, Spalten-, Index-, Policy- oder Trigger-Änderung. Bestehende Schutzregeln
-- (guard_order_delete_dependents, cancel_or_delete_order, delete_order_measurement, is_order_locked
-- und die Sperr-Trigger) bleiben unverändert und greifen weiter (z. B. bei abgeschlossenen Aufträgen).
--
-- Regeln (serverseitig, gelten unabhängig von der Oberfläche):
--   * Ändern dürfen nur Ersteller und Master. Interne Aufträge: nie. Abgeschlossene/gesperrte Aufträge: nie.
--   * "Begonnen" = Auftrag nicht mehr "offen" ODER mindestens eine Dienstleistung nicht mehr unberührt
--     (Kriterien von delete_order_measurement: Status, Ergebnisse, Rohdaten, Korrekturen, Arbeitszeiten,
--     Dokumente, Uploads) ODER Zeitbuchungen/Berichte am Auftrag.
--   * Auftragstyp und Projekt: nur änderbar, solange der Auftrag NICHT begonnen ist (auch für Master gesperrt).
--   * Auftragsart (Labor/Pilot Plant), Auftragsnummer, Ersteller: nie änderbar.
--   * Proben: hinzufügen jederzeit; entfernen nur Proben, an denen KEINE Aufgabe dieses Auftrags hängt
--     und die keine Ersatzprobe-Verknüpfung haben.
--   * Auftragsformular-Werte, Priorität, Fälligkeit, Anmerkungen: änderbar (solange nicht gesperrt).
--   * Begründung Pflicht bei: Typ-, Projektwechsel, Entfernen von Proben, Änderung der Auftragsformular-Werte
--     eines begonnenen Auftrags.
--   * Alles in EINER Transaktion; Änderungen werden in order_audit_log und activity_log protokolliert.

CREATE OR REPLACE FUNCTION public.order_edit_facts(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _order public.measurement_orders%ROWTYPE;
  _is_master boolean;
  _locked boolean;
  _can_edit boolean;
  _internal boolean;
  _started boolean := false;
  _touched int := 0;
  _ms jsonb := '[]'::jsonb;
  _samples jsonb := '[]'::jsonb;
  _m record;
  _facts jsonb;
  _s record;
  _sample_locked boolean;
  _sample_reasons text[];
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Bitte erneut anmelden.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _order FROM public.measurement_orders WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auftrag nicht gefunden.' USING ERRCODE = 'P0002'; END IF;

  _is_master := public.has_role(_uid, 'master'::public.app_role);
  IF NOT (_is_master OR _order.created_by = _uid OR public.is_assigned_to_order(_uid, _order_id)) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diesen Auftrag.' USING ERRCODE = '42501';
  END IF;

  _locked := public.is_order_locked(_order_id);
  _internal := _order.order_type::text = 'internal';
  _can_edit := (_is_master OR _order.created_by = _uid)
               AND NOT _internal AND NOT _locked
               AND NOT (public.is_external_customer(_uid) AND _order.created_by <> _uid);

  -- Aufgaben: unberührt? (gleiche Kriterien wie das Löschen einer Dienstleistung)
  FOR _m IN SELECT id FROM public.order_measurements WHERE order_id = _order_id ORDER BY created_at, id LOOP
    _facts := public._order_measurement_delete_facts(_m.id);
    IF NOT COALESCE((_facts->>'allowed')::boolean, false) THEN _touched := _touched + 1; END IF;
    _ms := _ms || jsonb_build_array(jsonb_build_object(
      'measurement_id', _m.id,
      'measurement_number', _facts->>'measurement_number',
      'service_id', _facts->>'service_id',
      'service_name', _facts->>'service_name',
      'sample_id', (SELECT sample_id FROM public.order_measurements WHERE id = _m.id),
      'status', _facts->>'status',
      'untouched', COALESCE((_facts->>'allowed')::boolean, false),
      'blockers', COALESCE(_facts->'blockers', '[]'::jsonb),
      'counts', COALESCE(_facts->'counts', '{}'::jsonb)));
  END LOOP;

  _started := _order.status::text <> 'open'
              OR _touched > 0
              OR EXISTS (SELECT 1 FROM public.project_time_entries WHERE order_id = _order_id)
              OR EXISTS (SELECT 1 FROM public.order_reports WHERE order_id = _order_id);

  -- Proben: entfernbar nur ohne Aufgaben dieses Auftrags und ohne Ersatzprobe-Verknüpfung.
  FOR _s IN
    SELECT os.id, os.sample_id, os.is_replacement, os.replaces_order_sample_id, os.replaced_by_order_sample_id,
           s.sample_number, s.sample_name
    FROM public.order_samples os LEFT JOIN public.samples s ON s.id = os.sample_id
    WHERE os.order_id = _order_id ORDER BY os.created_at, os.id
  LOOP
    _sample_reasons := ARRAY[]::text[];
    IF EXISTS (SELECT 1 FROM public.order_measurements WHERE order_id = _order_id
               AND (sample_id = _s.sample_id OR original_sample_id = _s.sample_id)) THEN
      _sample_reasons := _sample_reasons || 'has_tasks'::text;
    END IF;
    IF COALESCE(_s.is_replacement, false) OR _s.replaces_order_sample_id IS NOT NULL
       OR _s.replaced_by_order_sample_id IS NOT NULL THEN
      _sample_reasons := _sample_reasons || 'replacement'::text;
    END IF;
    _sample_locked := cardinality(_sample_reasons) > 0;
    _samples := _samples || jsonb_build_array(jsonb_build_object(
      'sample_id', _s.sample_id, 'sample_number', _s.sample_number, 'sample_name', _s.sample_name,
      'locked', _sample_locked, 'reasons', to_jsonb(_sample_reasons)));
  END LOOP;

  RETURN jsonb_build_object(
    'order_id', _order.id,
    'order_number', _order.order_number,
    'order_type', _order.order_type::text,
    'order_kind', _order.order_kind::text,
    'status', _order.status::text,
    'workflow_status', _order.workflow_status::text,
    'project_id', _order.project_id,
    'created_by', _order.created_by,
    'updated_at', _order.updated_at,
    'is_billed', _order.is_billed,
    'is_master', _is_master,
    'can_edit', _can_edit,
    'internal', _internal,
    'locked', _locked,
    'started', _started,
    'type_locked', _started,
    'project_locked', _started,
    'measurements', _ms,
    'samples', _samples);
END $$;
REVOKE ALL ON FUNCTION public.order_edit_facts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_edit_facts(uuid) TO authenticated;

COMMENT ON FUNCTION public.order_edit_facts(uuid) IS
  'Aufgabe 012: Sperr-Angaben für die Bearbeiten-Maske (nur lesend). Eine Wahrheit für Anzeige und Speichern.';

CREATE OR REPLACE FUNCTION public.order_edit_log_activity(
  _order_id uuid, _fields text[], _samples_added text[], _samples_removed text[],
  _template_changed boolean, _type_old text, _type_new text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _order public.measurement_orders%ROWTYPE;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Bitte erneut anmelden.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _order FROM public.measurement_orders WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auftrag nicht gefunden.' USING ERRCODE = 'P0002'; END IF;
  IF NOT (public.has_role(_uid, 'master'::public.app_role) OR _order.created_by = _uid) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Bearbeiten dieses Auftrags.' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(cardinality(_fields), 0) = 0 THEN RAISE EXCEPTION 'Keine Änderungen zu protokollieren.'; END IF;
  INSERT INTO public.activity_log (event_type, actor_user_id, order_id, project_id, metadata)
  VALUES ('order_updated', _uid, _order_id, _order.project_id,
    jsonb_build_object(
      'fields', to_jsonb(_fields),
      'samples_added', to_jsonb(COALESCE(_samples_added, ARRAY[]::text[])),
      'samples_removed', to_jsonb(COALESCE(_samples_removed, ARRAY[]::text[])),
      'template_changed', COALESCE(_template_changed, false),
      'order_type_old', _type_old,
      'order_type_new', _type_new,
      'reason', NULLIF(btrim(COALESCE(_reason, '')), '')))
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.order_edit_log_activity(uuid, text[], text[], text[], boolean, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_edit_log_activity(uuid, text[], text[], text[], boolean, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.order_edit_log_activity(uuid, text[], text[], text[], boolean, text, text, text) IS
  'Aufgabe 012: schreibt das Ereignis order_updated (activity_log erlaubt kein direktes INSERT für authenticated). Nur Ersteller/Master.';

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

  -- ---- Auftragsformular (Vorlagenwerte) ----
  IF _t IS NOT NULL AND jsonb_typeof(_t) = 'object' THEN
    _new_values := COALESCE(_t->'values', '{}'::jsonb);
    _old_tmpl := COALESCE(_order.shared_form_data->'template', '{}'::jsonb);
    IF COALESCE(_old_tmpl->'values', '{}'::jsonb) IS DISTINCT FROM _new_values THEN
      _tmpl_changed := true; _fields := _fields || 'template'::text;
      IF _started THEN _need_reason := true; END IF;
    END IF;
  END IF;

  IF cardinality(_fields) = 0 THEN
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
  PERFORM public.order_edit_log_activity(
    _order_id, _fields, _added_nums, _removed_nums, _tmpl_changed,
    CASE WHEN _type_changed THEN _order.order_type::text END,
    CASE WHEN _type_changed THEN _new_type::text END,
    _reason_txt);

  RETURN jsonb_build_object('changed', true, 'fields', to_jsonb(_fields));
END $$;
REVOKE ALL ON FUNCTION public.apply_order_changes(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_order_changes(uuid, jsonb, text) TO authenticated;

COMMENT ON FUNCTION public.apply_order_changes(uuid, jsonb, text) IS
  'Aufgabe 012: Änderungen am Auftrag (Kopfdaten, Proben, Auftragsformular) atomar anwenden, Sperren serverseitig prüfen und protokollieren.';
