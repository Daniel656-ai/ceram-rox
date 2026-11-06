ALTER TABLE public.measurement_result_corrections
  DROP CONSTRAINT IF EXISTS measurement_result_corrections_change_type_check;

ALTER TABLE public.measurement_result_corrections
  ADD CONSTRAINT measurement_result_corrections_change_type_check
  CHECK (change_type = ANY (ARRAY[
    'value'::text,
    'sample_reassignment'::text,
    'ergänzt'::text,
    'entfernt'::text,
    'datei_ersetzt'::text,
    'datei_ergaenzt'::text,
    'dokument_ersetzt'::text,
    'dokument_ergaenzt'::text
  ]));

CREATE OR REPLACE FUNCTION public.rox_jsonb_diff(a jsonb, b jsonb, p text DEFAULT '')
RETURNS TABLE(path text, change text, old_value jsonb, new_value jsonb)
LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE
  k text; ea jsonb; eb jsonb; i int; id text;
  a_noid jsonb := '[]'::jsonb; b_noid jsonb := '[]'::jsonb;
  dup text;
BEGIN
  IF a IS NOT NULL AND jsonb_typeof(a) = 'null' THEN a := NULL; END IF;
  IF b IS NOT NULL AND jsonb_typeof(b) = 'null' THEN b := NULL; END IF;
  IF a IS NOT DISTINCT FROM b THEN RETURN; END IF;
  IF a IS NULL THEN RETURN QUERY SELECT p, 'added'::text, NULL::jsonb, b; RETURN; END IF;
  IF b IS NULL THEN RETURN QUERY SELECT p, 'removed'::text, a, NULL::jsonb; RETURN; END IF;
  IF jsonb_typeof(a) <> jsonb_typeof(b) THEN
    RETURN QUERY SELECT p, 'modified'::text, a, b; RETURN;
  END IF;

  IF jsonb_typeof(a) = 'object' THEN
    FOR k IN SELECT x FROM (SELECT jsonb_object_keys(a) x UNION SELECT jsonb_object_keys(b)) s ORDER BY x LOOP
      RETURN QUERY SELECT * FROM public.rox_jsonb_diff(a->k, b->k, p || '.' || k);
    END LOOP;
    RETURN;
  END IF;

  IF jsonb_typeof(a) = 'array' THEN
    SELECT x INTO dup FROM (
      SELECT COALESCE(e->>'__instance_id', e->>'__id') x FROM jsonb_array_elements(a) e
       WHERE jsonb_typeof(e) = 'object' AND COALESCE(e->>'__instance_id', e->>'__id') IS NOT NULL
      ) s GROUP BY x HAVING count(*) > 1 LIMIT 1;
    IF dup IS NULL THEN
      SELECT x INTO dup FROM (
        SELECT COALESCE(e->>'__instance_id', e->>'__id') x FROM jsonb_array_elements(b) e
         WHERE jsonb_typeof(e) = 'object' AND COALESCE(e->>'__instance_id', e->>'__id') IS NOT NULL
        ) s GROUP BY x HAVING count(*) > 1 LIMIT 1;
    END IF;
    IF dup IS NOT NULL THEN
      RETURN QUERY SELECT p || '[' || dup || ']', 'ambiguous_id'::text, a, b; RETURN;
    END IF;

    FOR ea IN SELECT e FROM jsonb_array_elements(a) e LOOP
      IF jsonb_typeof(ea) <> 'object' THEN a_noid := a_noid || jsonb_build_array(ea); CONTINUE; END IF;
      id := COALESCE(ea->>'__instance_id', ea->>'__id');
      IF id IS NULL THEN a_noid := a_noid || jsonb_build_array(ea); CONTINUE; END IF;
      eb := NULL;
      SELECT x INTO eb FROM jsonb_array_elements(b) x
       WHERE jsonb_typeof(x) = 'object' AND COALESCE(x->>'__instance_id', x->>'__id') = id;
      IF eb IS NULL THEN
        RETURN QUERY SELECT p || '[' || id || ']', 'removed'::text, ea, NULL::jsonb;
      ELSE
        RETURN QUERY SELECT * FROM public.rox_jsonb_diff(ea, eb, p || '[' || id || ']');
      END IF;
    END LOOP;
    FOR eb IN SELECT e FROM jsonb_array_elements(b) e LOOP
      IF jsonb_typeof(eb) <> 'object' OR COALESCE(eb->>'__instance_id', eb->>'__id') IS NULL THEN
        b_noid := b_noid || jsonb_build_array(eb); CONTINUE;
      END IF;
      id := COALESCE(eb->>'__instance_id', eb->>'__id');
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(a) x
                      WHERE jsonb_typeof(x) = 'object' AND COALESCE(x->>'__instance_id', x->>'__id') = id) THEN
        RETURN QUERY SELECT p || '[' || id || ']', 'added'::text, NULL::jsonb, eb;
      END IF;
    END LOOP;

    FOR i IN 0 .. GREATEST(jsonb_array_length(a_noid), jsonb_array_length(b_noid)) - 1 LOOP
      RETURN QUERY SELECT * FROM public.rox_jsonb_diff(a_noid->i, b_noid->i, p || '[#' || i || ']');
    END LOOP;
    RETURN;
  END IF;

  RETURN QUERY SELECT p, 'modified'::text, a, b;
END; $$;

CREATE OR REPLACE FUNCTION public.rox_result_definition(_service_id uuid, _result_name text)
RETURNS TABLE(known boolean, official boolean, label text, unit text, kind text, form_id uuid, field_key text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_form uuid; v_key text; v_rest text; v_fid text;
BEGIN
  IF _result_name LIKE 'form:%' THEN
    v_rest := substr(_result_name, 6);
    v_fid := split_part(v_rest, ':', 1);
    IF v_fid !~ '^[0-9a-f-]{36}$' THEN RETURN QUERY SELECT false,NULL::boolean,NULL,NULL,NULL,NULL::uuid,NULL; RETURN; END IF;
    v_form := v_fid::uuid;
    v_key := substr(v_rest, length(v_fid) + 2);
    IF NOT EXISTS (SELECT 1 FROM service_form_links WHERE service_id = _service_id AND form_definition_id = v_form) THEN
      RETURN QUERY SELECT false,NULL::boolean,NULL,NULL,NULL,v_form,v_key; RETURN;
    END IF;
    IF v_key ~ '^[^\[\]]+\[[^\]]+\]\..+$' THEN
      IF EXISTS (SELECT 1 FROM form_fields f WHERE f.form_id = v_form AND f.field_type = 'measurement_block'
                  AND COALESCE(f.metadata->'measurement_block'->>'storage_key', f.field_key) = split_part(v_key, '[', 1)) THEN
        RETURN QUERY SELECT true, NULL::boolean, NULL::text, NULL::text, 'block_entry'::text, v_form, v_key;
      ELSE
        RETURN QUERY SELECT false,NULL::boolean,NULL,NULL,NULL,v_form,v_key;
      END IF;
      RETURN;
    END IF;
    RETURN QUERY SELECT true, COALESCE(f.is_result,false), COALESCE(f.result_label,f.display_name,f.field_key), f.unit,
                        'form_field'::text, v_form, v_key
      FROM form_fields f
     WHERE f.form_id = v_form AND f.field_key = v_key AND f.field_type <> 'measurement_block'
       AND COALESCE(f.metadata->>'global_field_source','') <> 'constant'
       AND NOT EXISTS (SELECT 1 FROM form_fields p WHERE p.id = f.parent_field_id AND p.field_type = 'measurement_block')
     LIMIT 1;
    IF FOUND THEN RETURN; END IF;
    RETURN QUERY SELECT true, COALESCE(c.is_result,false), COALESCE(c.result_label,c.display_name,c.calc_key), c.unit,
                        'form_calc'::text, v_form, v_key
      FROM form_calculations c WHERE c.form_id = v_form AND c.calc_key = v_key LIMIT 1;
    IF NOT FOUND THEN RETURN QUERY SELECT false,NULL::boolean,NULL,NULL,NULL,v_form,v_key; END IF;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, COALESCE(s.is_result,false), COALESCE(s.result_label,s.display_name,s.field_key), s.unit,
                      'service'::text, NULL::uuid, s.field_key
    FROM service_data_fields s
   WHERE s.service_id = _service_id AND s.field_key = _result_name AND COALESCE(s.archived,false) = false
   LIMIT 1;
  IF NOT FOUND THEN RETURN QUERY SELECT false,NULL::boolean,NULL,NULL,NULL,NULL::uuid,NULL; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.rox_is_calc_condition_met(
  _measurement_id uuid, _form_id uuid, _cond_key text, _values jsonb, _remove jsonb
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_target_name text := 'form:' || _form_id || ':' || _cond_key;
  v_val_elem jsonb;
  v_old_mr measurement_results%ROWTYPE;
  v_has_val boolean;
  v_num numeric; v_txt text; v_rem text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(_remove, '[]'::jsonb)) rm
     WHERE rm->>'result_name' = v_target_name AND COALESCE(rm->>'instance_key','') = ''
  ) THEN
    RETURN false;
  END IF;

  SELECT elem INTO v_val_elem
    FROM jsonb_array_elements(COALESCE(_values, '[]'::jsonb)) elem
   WHERE elem->>'result_name' = v_target_name AND COALESCE(elem->>'instance_key','') = ''
   LIMIT 1;

  IF v_val_elem IS NOT NULL THEN
    SELECT * INTO v_old_mr FROM measurement_results
     WHERE order_measurement_id = _measurement_id AND result_name = v_target_name AND COALESCE(instance_key,'') = '';

    v_num := CASE WHEN v_val_elem ? 'value' THEN (v_val_elem->>'value')::numeric ELSE v_old_mr.value END;
    v_txt := CASE WHEN v_val_elem ? 'text_value' THEN v_val_elem->>'text_value' ELSE v_old_mr.text_value END;
    v_rem := CASE WHEN v_val_elem ? 'remarks' THEN v_val_elem->>'remarks' ELSE v_old_mr.remarks END;

    RETURN (v_num IS NOT NULL) OR (v_txt IS NOT NULL AND btrim(v_txt) <> '') OR (v_rem IS NOT NULL AND btrim(v_rem) <> '');
  END IF;

  SELECT (value IS NOT NULL OR (text_value IS NOT NULL AND btrim(text_value) <> '') OR (remarks IS NOT NULL AND btrim(remarks) <> ''))
    INTO v_has_val
    FROM measurement_results
   WHERE order_measurement_id = _measurement_id AND result_name = v_target_name AND COALESCE(instance_key,'') = '';

  RETURN COALESCE(v_has_val, false);
END; $$;

CREATE OR REPLACE FUNCTION public.rox_assert_storage_object(
  _bucket text, _path text, _measurement_id uuid, _field_key text, _uid uuid
) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'storage' AS $$
DECLARE v_owner uuid; v_parts text[];
BEGIN
  IF _path IS NULL OR _path ~ '(^/|\.\.|//)' THEN RAISE EXCEPTION 'Ungueltiger Dateipfad'; END IF;
  v_parts := string_to_array(_path, '/');
  IF _bucket = 'order-uploads' THEN
    IF array_length(v_parts,1) <> 4 OR v_parts[1] <> 'orders' OR v_parts[2] <> _measurement_id::text
       OR v_parts[3] <> _field_key THEN
      RAISE EXCEPTION 'Dateipfad entspricht nicht orders/<Dienstleistung>/<Feld>/<Datei>';
    END IF;
  ELSIF _bucket = 'measurement-documents' THEN
    IF array_length(v_parts,1) <> 3 OR v_parts[1] <> _uid::text OR v_parts[2] <> _measurement_id::text THEN
      RAISE EXCEPTION 'Dokumentpfad entspricht nicht <Benutzer>/<Dienstleistung>/<Datei>';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unzulaessiger Speicherbereich %', _bucket;
  END IF;
  SELECT owner INTO v_owner FROM storage.objects WHERE bucket_id = _bucket AND name = _path;
  IF NOT FOUND THEN RAISE EXCEPTION 'Datei ist im Speicher nicht vorhanden'; END IF;
  IF v_owner IS DISTINCT FROM _uid THEN RAISE EXCEPTION 'Datei wurde nicht vom korrigierenden Benutzer hochgeladen'; END IF;
  IF EXISTS (SELECT 1 FROM order_upload_files WHERE storage_path = _path)
     OR EXISTS (SELECT 1 FROM documents WHERE storage_path = _path) THEN
    RAISE EXCEPTION 'Datei ist bereits einem Eintrag zugeordnet';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.rox_file_versions(_measurement_id uuid)
RETURNS TABLE(kind text, file_id uuid, is_current boolean, replaced_by uuid, replaced_at timestamptz, replace_reason text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  WITH rep AS (
    SELECT f->>'kind' AS kind, (f->>'old_id')::uuid AS old_id, (f->>'new_id')::uuid AS new_id,
           a.created_at, a.metadata->>'reason' AS reason
      FROM activity_log a, jsonb_array_elements(COALESCE(a.metadata->'files','[]'::jsonb)) f
     WHERE a.event_type = 'measurement_amended' AND a.order_measurement_id = _measurement_id
       AND f->>'old_id' IS NOT NULL)
  SELECT 'upload'::text AS kind, u.id, r.new_id IS NULL AS is_current, r.new_id AS replaced_by, r.created_at AS replaced_at, r.reason AS replace_reason
    FROM order_upload_files u LEFT JOIN rep r ON r.kind = 'upload' AND r.old_id = u.id
   WHERE u.measurement_id = _measurement_id
   UNION ALL
  SELECT 'document'::text AS kind, d.id, r.new_id IS NULL AS is_current, r.new_id AS replaced_by, r.created_at AS replaced_at, r.reason AS replace_reason
    FROM documents d LEFT JOIN rep r ON r.kind = 'document' AND r.old_id = d.id
   WHERE d.order_measurement_id = _measurement_id;
$$;

CREATE OR REPLACE FUNCTION public.amend_completed_measurement(
  p_order_measurement_id uuid,
  p_operation_id uuid,
  p_reason text,
  p_values jsonb DEFAULT '[]'::jsonb,
  p_remove jsonb DEFAULT '[]'::jsonb,
  p_files  jsonb DEFAULT '[]'::jsonb,
  p_new_raw_dataset_id uuid DEFAULT NULL,
  p_replaces_dataset_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid(); v_profile uuid;
  v_meas order_measurements%ROWTYPE; v_order measurement_orders%ROWTYPE;
  v_hash text; v_prev measurement_import_operations%ROWTYPE; v_prior text;
  v_new_ds measurement_raw_datasets%ROWTYPE; v_old_ds measurement_raw_datasets%ROWTYPE;
  e jsonb; f jsonb; v_old measurement_results%ROWTYPE; v_def record;
  v_name text; v_ik text; v_num numeric; v_txt text; v_rem text;
  v_keys text[] := ARRAY[]::text[]; v_rem_keys text[] := ARRAY[]::text[]; v_ck text;
  v_seen_upload_old_ids text[] := ARRAY[]::text[];
  v_seen_doc_old_ids text[] := ARRAY[]::text[];
  v_seen_storage_paths text[] := ARRAY[]::text[];
  v_changes jsonb := '[]'::jsonb; v_files_log jsonb := '[]'::jsonb; v_diff jsonb;
  v_upd int := 0; v_add int := 0; v_del int := 0; v_fc int := 0; v_unch int := 0;
  v_old_up order_upload_files%ROWTYPE; v_old_doc documents%ROWTYPE; v_new_id uuid;
  v_calc_ok boolean; v_cond text; v_log uuid;
  v_f_path text; v_f_name text; v_f_kind text; v_f_key text; v_f_size bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet' USING ERRCODE='insufficient_privilege'; END IF;
  IF p_order_measurement_id IS NULL OR p_operation_id IS NULL THEN RAISE EXCEPTION 'Dienstleistung und Operations-ID erforderlich'; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN RAISE EXCEPTION 'Eine Begruendung ist erforderlich'; END IF;
  IF jsonb_typeof(COALESCE(p_values,'[]')) <> 'array' OR jsonb_typeof(COALESCE(p_remove,'[]')) <> 'array'
     OR jsonb_typeof(COALESCE(p_files,'[]')) <> 'array' THEN RAISE EXCEPTION 'Ungueltige Eingabestruktur'; END IF;

  SELECT id INTO v_profile FROM profiles WHERE user_id = v_uid LIMIT 1;

  PERFORM pg_advisory_xact_lock(hashtext('op_id'), hashtext(p_operation_id::text));
  PERFORM pg_advisory_xact_lock(hashtext('order_meas'), hashtext(p_order_measurement_id::text));
  v_hash := encode(sha256(convert_to(jsonb_build_object('m',p_order_measurement_id,'r',btrim(p_reason),
    'v',p_values,'d',p_remove,'f',p_files,'n',p_new_raw_dataset_id,'o',p_replaces_dataset_id)::text,'UTF8')),'hex');
  SELECT * INTO v_prev FROM measurement_import_operations WHERE operation_id = p_operation_id;
  IF FOUND THEN
    IF v_prev.payload_hash = v_hash AND v_prev.order_measurement_id = p_order_measurement_id THEN
      RETURN jsonb_build_object('success',true,'already_completed',true,'operation_id',p_operation_id);
    END IF;
    RAISE EXCEPTION 'Operations-ID wurde bereits mit abweichendem Inhalt verwendet';
  END IF;

  SELECT * INTO v_meas FROM order_measurements WHERE id = p_order_measurement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dienstleistung nicht gefunden'; END IF;
  SELECT * INTO v_order FROM measurement_orders WHERE id = v_meas.order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auftrag zur Dienstleistung nicht gefunden'; END IF;
  IF v_meas.status <> 'completed' THEN RAISE EXCEPTION 'Nur abgeschlossene Dienstleistungen koennen nachtraeglich bearbeitet werden'; END IF;

  IF NOT (v_meas.assigned_to = v_uid OR public.can_correct_results(v_uid)) THEN
    RAISE EXCEPTION 'Keine Berechtigung zur Korrektur dieser Dienstleistung' USING ERRCODE='insufficient_privilege';
  END IF;

  IF p_replaces_dataset_id IS NOT NULL AND p_new_raw_dataset_id IS NULL THEN RAISE EXCEPTION 'Abloesung erfordert einen neuen Rohdatensatz'; END IF;
  IF p_new_raw_dataset_id IS NOT NULL THEN
    IF p_new_raw_dataset_id = p_replaces_dataset_id THEN RAISE EXCEPTION 'Rohdatensatz kann sich nicht selbst abloesen'; END IF;
    SELECT * INTO v_new_ds FROM measurement_raw_datasets WHERE id = p_new_raw_dataset_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Neuer Rohdatensatz nicht gefunden'; END IF;
    IF v_new_ds.order_measurement_id <> v_meas.id THEN RAISE EXCEPTION 'Neuer Rohdatensatz gehoert nicht zu dieser Dienstleistung'; END IF;
    IF v_new_ds.sample_id IS NOT NULL AND v_new_ds.sample_id IS DISTINCT FROM v_meas.sample_id THEN RAISE EXCEPTION 'Neuer Rohdatensatz gehoert zu einer anderen Probe'; END IF;
    IF v_new_ds.service_id IS NOT NULL AND v_new_ds.service_id <> v_meas.service_id THEN RAISE EXCEPTION 'Neuer Rohdatensatz gehoert zu einer anderen Leistung'; END IF;
    IF v_new_ds.superseded_at IS NOT NULL OR v_new_ds.replaces_dataset_id IS NOT NULL OR v_new_ds.operation_id IS NOT NULL THEN
      RAISE EXCEPTION 'Neuer Rohdatensatz ist bereits versioniert oder abgeloest'; END IF;
    IF v_new_ds.point_count <= 0 THEN RAISE EXCEPTION 'Neuer Rohdatensatz enthaelt keine Datenpunkte'; END IF;
    IF NOT EXISTS (SELECT 1 FROM measurement_raw_series s WHERE s.dataset_id = p_new_raw_dataset_id) THEN
      RAISE EXCEPTION 'Neuer Rohdatensatz enthaelt keine gespeicherten Daten-Chunks'; END IF;
    IF (SELECT COALESCE(SUM(jsonb_array_length(s.rows)),0) FROM measurement_raw_series s WHERE s.dataset_id = p_new_raw_dataset_id) <> v_new_ds.point_count THEN
      RAISE EXCEPTION 'Anzahl der Datenpunkte stimmt nicht mit den gespeicherten Chunks ueberein'; END IF;
    IF p_replaces_dataset_id IS NOT NULL THEN
      SELECT * INTO v_old_ds FROM measurement_raw_datasets WHERE id = p_replaces_dataset_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Abzuloesender Rohdatensatz nicht gefunden'; END IF;
      IF v_old_ds.order_measurement_id <> v_meas.id THEN RAISE EXCEPTION 'Abzuloesender Rohdatensatz gehoert nicht zu dieser Dienstleistung'; END IF;
      IF v_old_ds.superseded_at IS NOT NULL THEN RAISE EXCEPTION 'Abzuloesender Rohdatensatz ist nicht mehr aktuell'; END IF;
      IF EXISTS (SELECT 1 FROM measurement_raw_datasets WHERE replaces_dataset_id = p_replaces_dataset_id) THEN
        RAISE EXCEPTION 'Rohdatensatz hat bereits einen Nachfolger'; END IF;
    END IF;
  END IF;

  FOR e IN SELECT * FROM jsonb_array_elements(COALESCE(p_remove,'[]')) LOOP
    v_name := btrim(COALESCE(e->>'result_name',''));
    v_ik := NULLIF(btrim(COALESCE(e->>'instance_key','')),'') ;
    IF v_name = '' THEN RAISE EXCEPTION 'result_name in p_remove darf nicht leer sein'; END IF;
    v_ck := v_name || '::' || COALESCE(v_ik,'');
    IF v_ck = ANY(v_rem_keys) THEN RAISE EXCEPTION 'Doppelter Eintrag in p_remove fuer %', v_name; END IF;
    v_rem_keys := v_rem_keys || v_ck;
  END LOOP;

  FOR e IN SELECT * FROM jsonb_array_elements(COALESCE(p_values,'[]')) LOOP
    IF jsonb_typeof(e) <> 'object' THEN RAISE EXCEPTION 'Ungueltiger Werteeintrag'; END IF;
    v_name := btrim(COALESCE(e->>'result_name',''));
    v_ik := NULLIF(btrim(COALESCE(e->>'instance_key','')),'') ;
    IF v_name = '' THEN RAISE EXCEPTION 'result_name darf nicht leer sein'; END IF;
    v_ck := v_name || '::' || COALESCE(v_ik,'');
    IF v_ck = ANY(v_keys) THEN RAISE EXCEPTION 'Doppelter Eintrag fuer % in p_values', v_name; END IF;
    IF v_ck = ANY(v_rem_keys) THEN RAISE EXCEPTION 'Feld % gleichzeitig geaendert und entfernt', v_name; END IF;
    v_keys := v_keys || v_ck;
    IF e ? 'value' AND jsonb_typeof(e->'value') NOT IN ('number','null') THEN RAISE EXCEPTION 'value fuer % muss Zahl oder null sein', v_name; END IF;
    IF e ? 'text_value' AND jsonb_typeof(e->'text_value') NOT IN ('string','null') THEN RAISE EXCEPTION 'text_value fuer % muss Text oder null sein', v_name; END IF;
    IF e ? 'remarks' AND jsonb_typeof(e->'remarks') NOT IN ('string','null') THEN RAISE EXCEPTION 'remarks fuer % muss Text oder null sein', v_name; END IF;
    IF (e ? 'value') AND (e->'value' IS NOT NULL) AND (jsonb_typeof(e->'value') <> 'null')
       AND (e ? 'text_value') AND (e->'text_value' IS NOT NULL) AND (jsonb_typeof(e->'text_value') <> 'null') THEN
      RAISE EXCEPTION 'Widerspruch fuer %: value und text_value duerfen nicht gleichzeitig angegeben werden', v_name;
    END IF;
  END LOOP;

  FOR f IN SELECT * FROM jsonb_array_elements(COALESCE(p_files,'[]')) LOOP
    IF jsonb_typeof(f) <> 'object' THEN RAISE EXCEPTION 'Ungueltiger Dateieintrag'; END IF;
    v_f_kind := f->>'kind';
    v_f_path := f->>'storage_path';
    v_f_name := btrim(COALESCE(f->>'file_name',''));
    IF v_f_kind NOT IN ('upload', 'document') THEN RAISE EXCEPTION 'Unbekannte Dateiart %', v_f_kind; END IF;
    IF v_f_path IS NULL OR length(btrim(v_f_path)) = 0 THEN RAISE EXCEPTION 'storage_path ist erforderlich'; END IF;
    IF v_f_name = '' THEN RAISE EXCEPTION 'file_name darf nicht leer sein'; END IF;

    IF v_f_path = ANY(v_seen_storage_paths) THEN
      RAISE EXCEPTION 'Doppelter storage_path im Payload: %', v_f_path;
    END IF;
    v_seen_storage_paths := v_seen_storage_paths || v_f_path;

    IF f ? 'file_size_bytes' AND f->'file_size_bytes' IS NOT NULL AND jsonb_typeof(f->'file_size_bytes') <> 'null' THEN
      BEGIN
        v_f_size := (f->>'file_size_bytes')::bigint;
        IF v_f_size < 0 THEN RAISE EXCEPTION 'negative_size'; END IF;
      EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'file_size_bytes muss eine nicht-negative Ganzzahl sein';
      END;
    END IF;

    IF f->>'old_id' IS NOT NULL AND length(btrim(f->>'old_id')) > 0 THEN
      IF v_f_kind = 'upload' THEN
        IF (f->>'old_id') = ANY(v_seen_upload_old_ids) THEN
          RAISE EXCEPTION 'Datei % wird im selben Payload mehrfach ersetzt', f->>'old_id';
        END IF;
        v_seen_upload_old_ids := v_seen_upload_old_ids || (f->>'old_id');
      ELSIF v_f_kind = 'document' THEN
        IF (f->>'old_id') = ANY(v_seen_doc_old_ids) THEN
          RAISE EXCEPTION 'Dokument % wird im selben Payload mehrfach ersetzt', f->>'old_id';
        END IF;
        v_seen_doc_old_ids := v_seen_doc_old_ids || (f->>'old_id');
      END IF;
    END IF;
  END LOOP;

  v_prior := current_setting('app.bypass_order_lock', true);
  PERFORM set_config('app.bypass_order_lock', 'on', true);

  FOR e IN SELECT * FROM jsonb_array_elements(COALESCE(p_values,'[]')) LOOP
    v_name := btrim(COALESCE(e->>'result_name',''));
    v_ik := NULLIF(btrim(COALESCE(e->>'instance_key','')),'') ;

    SELECT * INTO v_old FROM measurement_results
     WHERE order_measurement_id = v_meas.id AND result_name = v_name AND COALESCE(instance_key,'') = COALESCE(v_ik,'')
     FOR UPDATE;

    v_num := CASE WHEN e ? 'value' THEN (e->>'value')::numeric ELSE v_old.value END;
    v_txt := CASE WHEN e ? 'text_value' THEN e->>'text_value' ELSE v_old.text_value END;
    v_rem := CASE WHEN e ? 'remarks' THEN e->>'remarks' ELSE v_old.remarks END;
    IF v_num IS NULL AND v_txt IS NULL AND v_rem IS NULL THEN
      RAISE EXCEPTION 'Feld % waere danach leer – zum Entfernen p_remove verwenden', v_name; END IF;
    IF v_rem IS NOT NULL AND left(btrim(v_rem),1) IN ('[','{') THEN
      BEGIN PERFORM v_rem::jsonb; EXCEPTION WHEN others THEN RAISE EXCEPTION 'Ungueltige Strukturdaten fuer %', v_name; END;
    END IF;

    IF v_old.id IS NOT NULL THEN
      IF v_old.value IS NOT DISTINCT FROM v_num AND v_old.text_value IS NOT DISTINCT FROM v_txt
         AND v_old.remarks IS NOT DISTINCT FROM v_rem THEN v_unch := v_unch + 1; CONTINUE; END IF;
      v_diff := NULL;
      IF left(btrim(COALESCE(v_old.remarks,'')),1) IN ('[','{') OR left(btrim(COALESCE(v_rem,'')),1) IN ('[','{') THEN
        SELECT jsonb_agg(jsonb_build_object('path',d.path,'change',d.change,'old',d.old_value,'new',d.new_value) ORDER BY d.path)
          INTO v_diff
          FROM public.rox_jsonb_diff(
            CASE WHEN left(btrim(COALESCE(v_old.remarks,'')),1) IN ('[','{') THEN v_old.remarks::jsonb ELSE to_jsonb(v_old.remarks) END,
            CASE WHEN left(btrim(COALESCE(v_rem,'')),1) IN ('[','{') THEN v_rem::jsonb ELSE to_jsonb(v_rem) END) d;
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v_diff,'[]')) x WHERE x->>'change' = 'ambiguous_id') THEN
          RAISE EXCEPTION 'Feld %: doppelte Eintrags-IDs, Aenderung nicht eindeutig nachvollziehbar', v_name; END IF;
      END IF;

      SELECT * INTO v_def FROM public.rox_result_definition(v_meas.service_id, v_name);
      IF v_def.kind = 'form_calc' THEN
        v_calc_ok := true;
        FOR v_cond IN SELECT jsonb_array_elements_text(COALESCE(c.metadata->'result_conditions','[]'::jsonb))
                        FROM form_calculations c WHERE c.form_id = v_def.form_id AND c.calc_key = v_def.field_key LOOP
          IF NOT public.rox_is_calc_condition_met(v_meas.id, v_def.form_id, v_cond, p_values, p_remove) THEN
            v_calc_ok := false;
          END IF;
        END LOOP;
        UPDATE measurement_results SET value = v_num, text_value = v_txt, remarks = v_rem, is_official = (COALESCE(v_def.official,false) AND v_calc_ok), updated_at = now() WHERE id = v_old.id;
      ELSE
        UPDATE measurement_results SET value = v_num, text_value = v_txt, remarks = v_rem, updated_at = now() WHERE id = v_old.id;
      END IF;

      INSERT INTO measurement_result_corrections(change_type, order_id, order_measurement_id, measurement_result_id,
        service_id, parameter_name, parameter_label, unit, old_value, new_value, old_text, new_text,
        old_sample_id, new_sample_id, reason, changed_by, changed_at, operation_id, raw_dataset_id)
      VALUES ('value', v_meas.order_id, v_meas.id, v_old.id, v_meas.service_id, v_name,
        COALESCE(v_old.display_label, v_name), v_old.unit, v_old.value, v_num,
        COALESCE(v_old.text_value, v_old.remarks), COALESCE(v_txt, v_rem),
        v_meas.sample_id, v_meas.sample_id, btrim(p_reason), v_uid, now(), p_operation_id, p_new_raw_dataset_id);
      v_upd := v_upd + 1;
      v_changes := v_changes || jsonb_build_object('result_name',v_name,'instance_key',v_ik,'label',v_old.display_label,
        'change','modified','structure_diff',v_diff);
    ELSE
      SELECT * INTO v_def FROM public.rox_result_definition(v_meas.service_id, v_name);
      IF NOT COALESCE(v_def.known,false) THEN RAISE EXCEPTION 'Unbekanntes Feld % – nicht in der Formulardefinition', v_name; END IF;
      IF v_def.kind = 'block_entry' THEN
        RAISE EXCEPTION 'Neues Messblock-Ergebnis % kann nachtraeglich noch nicht ergaenzt werden (Entscheidung G1: Sperre aktiv)', v_name;
      END IF;
      v_calc_ok := true;
      IF v_def.kind = 'form_calc' THEN
        FOR v_cond IN SELECT jsonb_array_elements_text(COALESCE(c.metadata->'result_conditions','[]'::jsonb))
                        FROM form_calculations c WHERE c.form_id = v_def.form_id AND c.calc_key = v_def.field_key LOOP
          IF NOT public.rox_is_calc_condition_met(v_meas.id, v_def.form_id, v_cond, p_values, p_remove) THEN
            v_calc_ok := false;
          END IF;
        END LOOP;
      END IF;
      INSERT INTO measurement_results(order_measurement_id, result_name, instance_key, display_label, unit,
        value, text_value, remarks, is_official, measured_by, measured_at)
      VALUES (v_meas.id, v_name, v_ik, v_def.label, v_def.unit, v_num, v_txt, v_rem,
        COALESCE(v_def.official,false) AND v_calc_ok, v_uid, current_date)
      RETURNING * INTO v_old;
      INSERT INTO measurement_result_corrections(change_type, order_id, order_measurement_id, measurement_result_id,
        service_id, parameter_name, parameter_label, unit, new_value, new_text,
        old_sample_id, new_sample_id, reason, changed_by, changed_at, operation_id, raw_dataset_id)
      VALUES ('ergänzt', v_meas.order_id, v_meas.id, v_old.id, v_meas.service_id, v_name, v_old.display_label, v_old.unit,
        v_num, COALESCE(v_txt, v_rem), v_meas.sample_id, v_meas.sample_id, btrim(p_reason), v_uid, now(), p_operation_id, p_new_raw_dataset_id);
      v_add := v_add + 1;
      v_changes := v_changes || jsonb_build_object('result_name',v_name,'instance_key',v_ik,'label',v_old.display_label,
        'change','added','official',v_old.is_official);
    END IF;
  END LOOP;

  FOR e IN SELECT * FROM jsonb_array_elements(COALESCE(p_remove,'[]')) LOOP
    v_name := btrim(COALESCE(e->>'result_name',''));
    v_ik := NULLIF(btrim(COALESCE(e->>'instance_key','')),'') ;
    SELECT * INTO v_old FROM measurement_results
     WHERE order_measurement_id = v_meas.id AND result_name = v_name AND COALESCE(instance_key,'') = COALESCE(v_ik,'') FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Zu entfernendes Feld % existiert nicht', v_name; END IF;
    INSERT INTO measurement_result_corrections(change_type, order_id, order_measurement_id, measurement_result_id,
      service_id, parameter_name, parameter_label, unit, old_value, old_text,
      old_sample_id, new_sample_id, reason, changed_by, changed_at, operation_id)
    VALUES ('entfernt', v_meas.order_id, v_meas.id, NULL, v_meas.service_id, v_name, COALESCE(v_old.display_label, v_name),
      v_old.unit, v_old.value, COALESCE(v_old.text_value, v_old.remarks),
      v_meas.sample_id, v_meas.sample_id, btrim(p_reason), v_uid, now(), p_operation_id);
    DELETE FROM measurement_results WHERE id = v_old.id;
    v_del := v_del + 1;
    v_changes := v_changes || jsonb_build_object('result_name',v_name,'instance_key',v_ik,'label',v_old.display_label,
      'change','removed','was_official',v_old.is_official,'old_value',v_old.value,'old_text',COALESCE(v_old.text_value,v_old.remarks));
  END LOOP;

  FOR f IN SELECT * FROM jsonb_array_elements(COALESCE(p_files,'[]')) LOOP
    IF f->>'kind' = 'upload' THEN
      v_old_up := NULL;
      IF f->>'old_id' IS NOT NULL AND length(btrim(f->>'old_id')) > 0 THEN
        SELECT * INTO v_old_up FROM order_upload_files WHERE id = (f->>'old_id')::uuid FOR UPDATE;
        IF NOT FOUND OR v_old_up.measurement_id <> v_meas.id THEN RAISE EXCEPTION 'Zu ersetzende Datei gehoert nicht zu dieser Dienstleistung'; END IF;
        IF COALESCE(f->>'field_key', v_old_up.field_key) <> v_old_up.field_key
           OR (f ? 'entry_index' AND (f->>'entry_index')::int IS DISTINCT FROM v_old_up.entry_index) THEN
          RAISE EXCEPTION 'Ersatzdatei muss zum urspruenglichen Feld gehoeren'; END IF;
        IF EXISTS (SELECT 1 FROM public.rox_file_versions(v_meas.id) x WHERE x.kind='upload' AND x.file_id = v_old_up.id AND NOT x.is_current) THEN
          RAISE EXCEPTION 'Datei % wurde bereits ersetzt', v_old_up.file_name; END IF;
      ELSE
        v_f_key := f->>'field_key';
        IF v_f_key IS NULL OR length(btrim(v_f_key)) = 0 THEN RAISE EXCEPTION 'field_key fuer neue Datei erforderlich'; END IF;
        IF NOT EXISTS (SELECT 1 FROM service_data_fields s WHERE s.service_id = v_meas.service_id
                         AND s.field_key = v_f_key AND s.field_type IN ('file','image') AND COALESCE(s.archived,false)=false)
           AND NOT EXISTS (SELECT 1 FROM form_fields ff JOIN service_form_links l ON l.form_definition_id = ff.form_id
                         WHERE l.service_id = v_meas.service_id AND ff.field_key = v_f_key
                           AND ff.field_type IN ('file','image','upload')) THEN
          RAISE EXCEPTION 'Feld % ist kein Dateifeld dieser Dienstleistung', v_f_key; END IF;
      END IF;

      PERFORM public.rox_assert_storage_object('order-uploads', f->>'storage_path', v_meas.id,
                                               COALESCE(v_old_up.field_key, f->>'field_key'), v_uid);
      INSERT INTO order_upload_files(measurement_id, field_key, entry_index, storage_path, file_name, file_type, file_size_bytes, uploaded_by)
      VALUES (v_meas.id, COALESCE(v_old_up.field_key, f->>'field_key'),
              COALESCE(v_old_up.entry_index, (f->>'entry_index')::int), f->>'storage_path', f->>'file_name',
              f->>'file_type', (f->>'file_size_bytes')::bigint, v_uid)
      RETURNING id INTO v_new_id;

      IF v_old_up.id IS NOT NULL THEN
        INSERT INTO measurement_result_corrections(change_type, order_id, order_measurement_id, service_id, parameter_name,
          parameter_label, old_text, new_text, old_sample_id, new_sample_id, reason, changed_by, changed_at, operation_id)
        VALUES ('datei_ersetzt', v_meas.order_id, v_meas.id, v_meas.service_id, v_old_up.field_key,
          'Datei', v_old_up.file_name, f->>'file_name', v_meas.sample_id, v_meas.sample_id, btrim(p_reason), v_uid, now(), p_operation_id);
        v_files_log := v_files_log || jsonb_build_object('kind','upload','action','replaced','old_id',v_old_up.id,'new_id',v_new_id,
          'field_key',v_old_up.field_key,'old_name',v_old_up.file_name,'new_name',f->>'file_name');
      ELSE
        INSERT INTO measurement_result_corrections(change_type, order_id, order_measurement_id, service_id, parameter_name,
          parameter_label, old_text, new_text, old_sample_id, new_sample_id, reason, changed_by, changed_at, operation_id)
        VALUES ('datei_ergaenzt', v_meas.order_id, v_meas.id, v_meas.service_id, f->>'field_key',
          'Datei', NULL, f->>'file_name', v_meas.sample_id, v_meas.sample_id, btrim(p_reason), v_uid, now(), p_operation_id);
        v_files_log := v_files_log || jsonb_build_object('kind','upload','action','added','old_id',NULL,'new_id',v_new_id,
          'field_key',f->>'field_key','old_name',NULL,'new_name',f->>'file_name');
      END IF;

    ELSIF f->>'kind' = 'document' THEN
      v_old_doc := NULL;
      IF f->>'old_id' IS NOT NULL AND length(btrim(f->>'old_id')) > 0 THEN
        SELECT * INTO v_old_doc FROM documents WHERE id = (f->>'old_id')::uuid FOR UPDATE;
        IF NOT FOUND OR v_old_doc.order_measurement_id <> v_meas.id THEN RAISE EXCEPTION 'Zu ersetzendes Dokument gehoert nicht zu dieser Dienstleistung'; END IF;
        IF EXISTS (SELECT 1 FROM public.rox_file_versions(v_meas.id) x WHERE x.kind='document' AND x.file_id = v_old_doc.id AND NOT x.is_current) THEN
          RAISE EXCEPTION 'Dokument % wurde bereits ersetzt', v_old_doc.file_name; END IF;
      END IF;
      PERFORM public.rox_assert_storage_object('measurement-documents', f->>'storage_path', v_meas.id, NULL, v_uid);
      INSERT INTO documents(order_measurement_id, file_name, file_type, storage_path, uploaded_by)
      VALUES (v_meas.id, f->>'file_name', f->>'file_type', f->>'storage_path', v_uid)
      RETURNING id INTO v_new_id;

      IF v_old_doc.id IS NOT NULL THEN
        INSERT INTO measurement_result_corrections(change_type, order_id, order_measurement_id, service_id, parameter_name,
          parameter_label, old_text, new_text, old_sample_id, new_sample_id, reason, changed_by, changed_at, operation_id)
        VALUES ('dokument_ersetzt', v_meas.order_id, v_meas.id, v_meas.service_id, 'Messdokument', 'Messdokument',
          v_old_doc.file_name, f->>'file_name', v_meas.sample_id, v_meas.sample_id, btrim(p_reason), v_uid, now(), p_operation_id);
        v_files_log := v_files_log || jsonb_build_object('kind','document','action','replaced','old_id',v_old_doc.id,'new_id',v_new_id,
          'old_name',v_old_doc.file_name,'new_name',f->>'file_name');
      ELSE
        INSERT INTO measurement_result_corrections(change_type, order_id, order_measurement_id, service_id, parameter_name,
          parameter_label, old_text, new_text, old_sample_id, new_sample_id, reason, changed_by, changed_at, operation_id)
        VALUES ('dokument_ergaenzt', v_meas.order_id, v_meas.id, v_meas.service_id, 'Messdokument', 'Messdokument',
          NULL, f->>'file_name', v_meas.sample_id, v_meas.sample_id, btrim(p_reason), v_uid, now(), p_operation_id);
        v_files_log := v_files_log || jsonb_build_object('kind','document','action','added','old_id',NULL,'new_id',v_new_id,
          'old_name',NULL,'new_name',f->>'file_name');
      END IF;
    END IF;
    v_fc := v_fc + 1;
  END LOOP;

  IF p_new_raw_dataset_id IS NOT NULL THEN
    UPDATE measurement_raw_datasets SET replaces_dataset_id = p_replaces_dataset_id, operation_id = p_operation_id, updated_at = now()
     WHERE id = p_new_raw_dataset_id;
    IF p_replaces_dataset_id IS NOT NULL THEN
      UPDATE measurement_raw_datasets SET superseded_at = now(), updated_at = now() WHERE id = p_replaces_dataset_id;
    END IF;
  END IF;

  IF v_upd + v_add + v_del + v_fc = 0 AND p_new_raw_dataset_id IS NULL THEN
    RAISE EXCEPTION 'Keine Aenderungen gegenueber dem gespeicherten Stand'; END IF;

  INSERT INTO activity_log(event_type, actor_user_id, order_id, order_measurement_id, project_id, service_id, metadata)
  VALUES ('measurement_amended', v_uid, v_meas.order_id, v_meas.id, v_order.project_id, v_meas.service_id,
    jsonb_build_object('operation_id',p_operation_id,'reason',btrim(p_reason),
      'updated',v_upd,'added',v_add,'removed',v_del,'files',v_files_log,'changes',v_changes,
      'raw_dataset',jsonb_build_object('new',p_new_raw_dataset_id,'replaces',p_replaces_dataset_id),
      'status',v_meas.status,'sample_id',v_meas.sample_id,'assigned_to',v_meas.assigned_to))
  RETURNING id INTO v_log;

  INSERT INTO measurement_import_operations(operation_id, order_measurement_id, payload_hash, reason, raw_dataset_id,
    replaces_dataset_id, affected_count, added_count, updated_count, unchanged_count, created_by, created_by_user_id)
  VALUES (p_operation_id, v_meas.id, v_hash, btrim(p_reason), p_new_raw_dataset_id, p_replaces_dataset_id,
    v_upd + v_add + v_del + v_fc, v_add, v_upd, v_unch, v_profile, v_uid);

  PERFORM set_config('app.bypass_order_lock', COALESCE(NULLIF(v_prior,''),'off'), true);
  RETURN jsonb_build_object('success',true,'already_completed',false,'operation_id',p_operation_id,'activity_id',v_log,
    'updated',v_upd,'added',v_add,'removed',v_del,'files',v_fc,'unchanged',v_unch);
END; $$;

CREATE OR REPLACE FUNCTION public.rox_is_versioned_file(_kind text, _id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM activity_log a, jsonb_array_elements(COALESCE(a.metadata->'files','[]'::jsonb)) f
     WHERE a.event_type = 'measurement_amended' AND f->>'kind' = _kind
       AND (f->>'old_id' = _id::text OR f->>'new_id' = _id::text));
$$;

CREATE OR REPLACE FUNCTION public.rox_guard_versioned_file_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF public.rox_is_versioned_file(CASE TG_TABLE_NAME WHEN 'documents' THEN 'document' ELSE 'upload' END, OLD.id) THEN
    RAISE EXCEPTION 'Datei ist Teil einer dokumentierten Korrektur und darf nicht geloescht werden'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_versioned_upload_delete ON public.order_upload_files;
CREATE TRIGGER trg_guard_versioned_upload_delete BEFORE DELETE ON public.order_upload_files
  FOR EACH ROW EXECUTE FUNCTION public.rox_guard_versioned_file_delete();

DROP TRIGGER IF EXISTS trg_guard_versioned_document_delete ON public.documents;
CREATE TRIGGER trg_guard_versioned_document_delete BEFORE DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.rox_guard_versioned_file_delete();

CREATE OR REPLACE FUNCTION public.rox_is_versioned_storage_path(_bucket text, _path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT (_bucket = 'order-uploads' AND EXISTS (SELECT 1 FROM order_upload_files u
            WHERE u.storage_path = _path AND public.rox_is_versioned_file('upload', u.id)))
      OR (_bucket = 'measurement-documents' AND EXISTS (SELECT 1 FROM documents d
            WHERE d.storage_path = _path AND public.rox_is_versioned_file('document', d.id)));
$$;

DROP POLICY IF EXISTS "Versioned correction files are not deletable" ON storage.objects;
CREATE POLICY "Versioned correction files are not deletable" ON storage.objects
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.rox_is_versioned_storage_path(bucket_id, name));

REVOKE ALL ON FUNCTION public.rox_jsonb_diff(jsonb,jsonb,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rox_result_definition(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rox_is_calc_condition_met(uuid,uuid,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rox_assert_storage_object(text,text,uuid,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rox_is_versioned_file(text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rox_is_versioned_storage_path(text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rox_guard_versioned_file_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rox_file_versions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.amend_completed_measurement(uuid,uuid,text,jsonb,jsonb,jsonb,uuid,uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rox_jsonb_diff(jsonb,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rox_is_versioned_file(text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rox_is_versioned_storage_path(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rox_file_versions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.amend_completed_measurement(uuid,uuid,text,jsonb,jsonb,jsonb,uuid,uuid) TO authenticated;