-- ============================================================================
-- ROX: Additives Schema und atomare RPC zur Ergebnisaenderung und -ergaenzung
-- Verifiziert gegen das reale Web-Schema (30.10.2026):
--  - measurement_results: keine text_value-Spalte, instance_context NOT NULL DEFAULT '{}'
--  - measurement_result_corrections: CHECK(change_type IN ('value','sample_reassignment')),
--    reason NOT NULL CHECK length>0, changed_by uuid NOT NULL (kein FK, traegt auth.uid())
--  - measurement_raw_datasets: point_count int NOT NULL, created_by -> profiles(id)
--  - measurement_raw_series: UNIQUE(dataset_id, chunk_index), rows jsonb NOT NULL
--  - Keine Dubletten in (order_measurement_id, result_name, COALESCE(instance_key,''))
-- ============================================================================

-- 1. Additive Spalte text_value auf measurement_results
ALTER TABLE public.measurement_results
  ADD COLUMN IF NOT EXISTS text_value text NULL;

-- 2. Erweiterung des change_type Constraints auf measurement_result_corrections
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'measurement_result_corrections_change_type_check'
      AND conrelid = 'public.measurement_result_corrections'::regclass
  ) THEN
    ALTER TABLE public.measurement_result_corrections
      DROP CONSTRAINT measurement_result_corrections_change_type_check;
  END IF;

  ALTER TABLE public.measurement_result_corrections
    ADD CONSTRAINT measurement_result_corrections_change_type_check
    CHECK (change_type = ANY (ARRAY['value'::text, 'sample_reassignment'::text, 'ergänzt'::text]));
END $$;

-- 3. Additive Spalten auf measurement_result_corrections
ALTER TABLE public.measurement_result_corrections
  ADD COLUMN IF NOT EXISTS operation_id uuid NULL,
  ADD COLUMN IF NOT EXISTS raw_dataset_id uuid NULL;

-- 4. Additive Spalten auf measurement_raw_datasets zur Versionshistorie
ALTER TABLE public.measurement_raw_datasets
  ADD COLUMN IF NOT EXISTS replaces_dataset_id uuid NULL REFERENCES public.measurement_raw_datasets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_at timestamp with time zone NULL,
  ADD COLUMN IF NOT EXISTS operation_id uuid NULL;

-- 5. Tabelle fuer Operationsprotokollierung und Idempotenz
CREATE TABLE IF NOT EXISTS public.measurement_import_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL UNIQUE,
  order_measurement_id uuid NOT NULL REFERENCES public.order_measurements(id) ON DELETE CASCADE,
  payload_hash text NOT NULL,
  reason text NOT NULL,
  raw_dataset_id uuid NULL REFERENCES public.measurement_raw_datasets(id) ON DELETE SET NULL,
  replaces_dataset_id uuid NULL REFERENCES public.measurement_raw_datasets(id) ON DELETE SET NULL,
  affected_count integer NOT NULL DEFAULT 0,
  added_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  unchanged_count integer NOT NULL DEFAULT 0,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Grants (Data API erhaelt keine Default-Privilegien auf public)
GRANT SELECT ON public.measurement_import_operations TO authenticated;
GRANT ALL ON public.measurement_import_operations TO service_role;

-- RLS auf Operations-Tabelle aktivieren (Muster wie measurement_result_corrections)
ALTER TABLE public.measurement_import_operations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'measurement_import_operations'
      AND policyname = 'mio_read'
  ) THEN
    CREATE POLICY mio_read ON public.measurement_import_operations
      FOR SELECT TO authenticated
      USING (
        has_role(auth.uid(), 'master'::app_role)
        OR is_assigned_to_measurement(auth.uid(), order_measurement_id)
        OR is_order_creator_via_measurement(auth.uid(), order_measurement_id)
      );
  END IF;
END $$;

-- 6. Eindeutiger Index auf kanonischer Identitaet zur Dublettenvermeidung
--    (Web-DB verifiziert: 0 Dubletten, 50 Zeilen)
CREATE UNIQUE INDEX IF NOT EXISTS uq_measurement_results_identity
  ON public.measurement_results (order_measurement_id, result_name, COALESCE(instance_key, ''));

-- 7. Atomare RPC-Funktion replace_measurement_results
CREATE OR REPLACE FUNCTION public.replace_measurement_results(
  p_order_measurement_id uuid,
  p_operation_id uuid,
  p_results jsonb,
  p_reason text,
  p_new_raw_dataset_id uuid DEFAULT NULL,
  p_replaces_dataset_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_meas public.order_measurements%ROWTYPE;
  v_user_id uuid;
  v_profile_id uuid;
  v_is_locked boolean;
  v_prior_bypass text;
  v_payload_hash text;
  v_existing_op public.measurement_import_operations%ROWTYPE;
  v_new_ds public.measurement_raw_datasets%ROWTYPE;
  v_old_ds public.measurement_raw_datasets%ROWTYPE;
  v_case_id uuid;

  v_res_elem jsonb;
  v_result_name text;
  v_instance_key text;
  v_instance_label text;
  v_display_label text;
  v_unit text;
  v_remarks text;
  v_has_numeric boolean;
  v_has_text boolean;
  v_new_num numeric;
  v_new_text text;

  v_existing_res public.measurement_results%ROWTYPE;
  v_target_res_id uuid;
  v_is_official boolean;
  v_value_changed boolean;

  v_added_count integer := 0;
  v_updated_count integer := 0;
  v_unchanged_count integer := 0;
  v_affected_count integer := 0;
  v_expected_chunks integer;
  v_actual_chunks integer;
  v_actual_points integer;
  v_min_chunk integer;
  v_max_chunk integer;
  v_chunks_valid boolean;
  v_keys_seen text[] := ARRAY[]::text[];
  v_canonical_key text;
BEGIN
  -- 1. Benutzer & Authentifizierung pruefen
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nicht authentifiziert' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_user_id LIMIT 1;

  -- 2. Pflichtparameter pruefen
  IF p_order_measurement_id IS NULL THEN
    RAISE EXCEPTION 'order_measurement_id ist erforderlich';
  END IF;
  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION 'operation_id ist erforderlich';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Eine Begruendung ist erforderlich';
  END IF;
  IF p_results IS NULL OR jsonb_typeof(p_results) <> 'array' THEN
    RAISE EXCEPTION 'results muss ein JSON-Array sein';
  END IF;

  -- 3. Transaktionsweite Advisory-Locks in deterministischer Reihenfolge
  PERFORM pg_advisory_xact_lock(hashtext('op_id'), hashtext(p_operation_id::text));
  PERFORM pg_advisory_xact_lock(hashtext('order_meas'), hashtext(p_order_measurement_id::text));

  -- 4. Payload-Hash berechnen & Idempotenz pruefen
  v_payload_hash := encode(
    sha256(
      convert_to(
        jsonb_build_object(
          'order_measurement_id', p_order_measurement_id,
          'results', p_results,
          'reason', btrim(p_reason),
          'new_raw_dataset_id', p_new_raw_dataset_id,
          'replaces_dataset_id', p_replaces_dataset_id
        )::text,
        'UTF8'
      )
    ),
    'hex'
  );

  SELECT * INTO v_existing_op
  FROM public.measurement_import_operations
  WHERE operation_id = p_operation_id;

  IF FOUND THEN
    IF v_existing_op.payload_hash = v_payload_hash THEN
      RETURN jsonb_build_object(
        'success', true,
        'already_completed', true,
        'operation_id', p_operation_id,
        'added_count', v_existing_op.added_count,
        'updated_count', v_existing_op.updated_count,
        'unchanged_count', v_existing_op.unchanged_count,
        'affected_count', v_existing_op.affected_count,
        'raw_dataset_id', v_existing_op.raw_dataset_id
      );
    ELSE
      RAISE EXCEPTION 'Operation-ID % wurde bereits mit abweichendem Payload ausgefuehrt', p_operation_id;
    END IF;
  END IF;

  -- 5. Dienstleistung & Auftragsstatus laden
  SELECT * INTO v_meas
  FROM public.order_measurements
  WHERE id = p_order_measurement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dienstleistung nicht gefunden: %', p_order_measurement_id;
  END IF;

  v_is_locked := public.is_order_locked(v_meas.order_id);

  -- 6. Berechtigung pruefen (keine Erweiterung bestehender Rechte)
  IF v_is_locked THEN
    IF NOT public.can_correct_results(v_user_id) THEN
      RAISE EXCEPTION 'Keine Berechtigung zur Korrektur abgeschlossener Auftraege'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSE
    IF NOT (has_role(v_user_id, 'master'::app_role)
            OR is_assigned_to_measurement(v_user_id, p_order_measurement_id)
            OR public.can_correct_results(v_user_id)) THEN
      RAISE EXCEPTION 'Keine Berechtigung zur Ergebnisbearbeitung dieser Dienstleistung'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- 7. Rohdatenvalidierung (falls angegeben)
  IF p_replaces_dataset_id IS NOT NULL AND p_new_raw_dataset_id IS NULL THEN
    RAISE EXCEPTION 'Abloesung eines Rohdatensatzes erfordert die Angabe eines neuen Rohdatensatzes';
  END IF;

  IF p_new_raw_dataset_id IS NOT NULL THEN
    SELECT * INTO v_new_ds
    FROM public.measurement_raw_datasets
    WHERE id = p_new_raw_dataset_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Neuer Rohdatensatz nicht gefunden: %', p_new_raw_dataset_id;
    END IF;

    -- Zugehoerigkeit zu Messung, Probe und Dienstleistung
    IF v_new_ds.order_measurement_id <> p_order_measurement_id THEN
      RAISE EXCEPTION 'Neuer Rohdatensatz gehoert nicht zu dieser Dienstleistung';
    END IF;
    IF v_new_ds.sample_id IS NOT NULL AND v_meas.sample_id IS NOT NULL
       AND v_new_ds.sample_id <> v_meas.sample_id THEN
      RAISE EXCEPTION 'Neuer Rohdatensatz gehoert nicht zur Probe dieser Dienstleistung';
    END IF;
    IF v_new_ds.service_id IS NOT NULL AND v_meas.service_id IS NOT NULL
       AND v_new_ds.service_id <> v_meas.service_id THEN
      RAISE EXCEPTION 'Neuer Rohdatensatz gehoert nicht zur Leistung dieser Dienstleistung';
    END IF;

    IF v_new_ds.point_count <= 0 THEN
      RAISE EXCEPTION 'Neuer Rohdatensatz enthaelt keine Datenpunkte (point_count <= 0)';
    END IF;

    v_expected_chunks := CEIL(v_new_ds.point_count::numeric / 2000.0);

    SELECT
      COUNT(*),
      COALESCE(SUM(jsonb_array_length(rows)), 0),
      bool_and(jsonb_typeof(rows) = 'array'),
      MIN(chunk_index),
      MAX(chunk_index)
    INTO v_actual_chunks, v_actual_points, v_chunks_valid, v_min_chunk, v_max_chunk
    FROM public.measurement_raw_series
    WHERE dataset_id = p_new_raw_dataset_id;

    IF v_actual_chunks <> v_expected_chunks THEN
      RAISE EXCEPTION 'Rohdaten-Chunk-Anzahl fehlerhaft (erwartet %, vorhanden %)', v_expected_chunks, v_actual_chunks;
    END IF;

    -- Lueckenlose Chunk-Indizes 0..N-1 (UNIQUE(dataset_id, chunk_index) garantiert Eindeutigkeit)
    IF v_min_chunk IS DISTINCT FROM 0 OR v_max_chunk IS DISTINCT FROM (v_expected_chunks - 1) THEN
      RAISE EXCEPTION 'Rohdaten-Chunk-Indizes nicht lueckenlos (erwartet 0..%, vorhanden %..%)',
        v_expected_chunks - 1, v_min_chunk, v_max_chunk;
    END IF;

    IF v_actual_points <> v_new_ds.point_count THEN
      RAISE EXCEPTION 'Rohdaten-Punktanzahl fehlerhaft (erwartet %, vorhanden %)', v_new_ds.point_count, v_actual_points;
    END IF;

    IF NOT COALESCE(v_chunks_valid, false) THEN
      RAISE EXCEPTION 'Rohdaten-Chunks enthalten ungueltige JSON-Strukturen';
    END IF;

    IF p_replaces_dataset_id IS NOT NULL THEN
      IF p_replaces_dataset_id = p_new_raw_dataset_id THEN
        RAISE EXCEPTION 'Ein Rohdatensatz kann sich nicht selbst abloesen';
      END IF;

      SELECT * INTO v_old_ds
      FROM public.measurement_raw_datasets
      WHERE id = p_replaces_dataset_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Abzuloesender Rohdatensatz nicht gefunden: %', p_replaces_dataset_id;
      END IF;

      IF v_old_ds.order_measurement_id <> p_order_measurement_id THEN
        RAISE EXCEPTION 'Abzuloesender Rohdatensatz gehoert nicht zu dieser Dienstleistung';
      END IF;

      IF v_old_ds.superseded_at IS NOT NULL THEN
        RAISE EXCEPTION 'Rohdatensatz % wurde bereits am % abgeloest', p_replaces_dataset_id, v_old_ds.superseded_at;
      END IF;
    END IF;
  END IF;

  -- 8. Messfall-ID ermitteln (fuer is_official Pruefung), nur bei vorhandenem Rohdatensatz
  v_case_id := NULL;
  IF p_new_raw_dataset_id IS NOT NULL AND v_new_ds.case_instance_id IS NOT NULL THEN
    SELECT case_id INTO v_case_id
    FROM public.measurement_case_instances
    WHERE id = v_new_ds.case_instance_id
    LIMIT 1;
  END IF;

  -- 9. Transaktionslokalen Order-Lock-Bypass aktivieren
  v_prior_bypass := current_setting('app.bypass_order_lock', true);
  PERFORM set_config('app.bypass_order_lock', 'on', true);

  -- 10. Iteration ueber alle Ergebniszeilen
  FOR v_res_elem IN SELECT * FROM jsonb_array_elements(p_results)
  LOOP
    v_result_name := btrim(COALESCE(v_res_elem->>'result_name', ''));
    IF length(v_result_name) = 0 THEN
      RAISE EXCEPTION 'result_name darf nicht leer sein';
    END IF;

    v_instance_key := NULLIF(btrim(COALESCE(v_res_elem->>'instance_key', '')), '');
    v_instance_label := NULLIF(btrim(COALESCE(v_res_elem->>'instance_label', '')), '');
    v_display_label := NULLIF(btrim(COALESCE(v_res_elem->>'display_label', '')), '');
    v_unit := NULLIF(btrim(COALESCE(v_res_elem->>'unit', '')), '');
    v_remarks := NULLIF(btrim(COALESCE(v_res_elem->>'remarks', '')), '');

    -- Dublettenpruefung im Eingabe-Payload (kanonische Identitaet wie UNIQUE-Index)
    v_canonical_key := v_result_name || '::' || COALESCE(v_instance_key, '');
    IF v_canonical_key = ANY(v_keys_seen) THEN
      RAISE EXCEPTION 'Dublette im Payload fuer Parameter % (Instanz: %)', v_result_name, COALESCE(v_instance_key, '-');
    END IF;
    v_keys_seen := array_append(v_keys_seen, v_canonical_key);

    -- Werteextraktion & Typvalidierung
    v_has_numeric := (v_res_elem ? 'value') AND (v_res_elem->'value' IS NOT NULL) AND (jsonb_typeof(v_res_elem->'value') <> 'null');
    v_has_text := (v_res_elem ? 'text_value') AND (v_res_elem->'text_value' IS NOT NULL) AND (jsonb_typeof(v_res_elem->'text_value') <> 'null');

    IF v_has_numeric AND v_has_text THEN
      RAISE EXCEPTION 'Widerspruechliche Eingabe fuer %: value und text_value duerfen nicht gleichzeitig angegeben werden', v_result_name;
    END IF;

    IF NOT v_has_numeric AND NOT v_has_text THEN
      RAISE EXCEPTION 'Kein Wert angegeben fuer %: entweder value oder text_value ist erforderlich', v_result_name;
    END IF;

    IF v_has_numeric THEN
      BEGIN
        v_new_num := (v_res_elem->>'value')::numeric;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Ungueltiger numerischer Wert fuer %: %', v_result_name, v_res_elem->>'value';
      END;
      v_new_text := NULL;
    ELSE
      v_new_text := btrim(v_res_elem->>'text_value');
      IF length(v_new_text) = 0 THEN
        RAISE EXCEPTION 'text_value fuer % darf nicht leer sein', v_result_name;
      END IF;
      v_new_num := NULL;
    END IF;

    -- Bestehende Ergebniszeile suchen (kanonische Identitaet: NULL und '' gleichbehandelt)
    SELECT * INTO v_existing_res
    FROM public.measurement_results
    WHERE order_measurement_id = p_order_measurement_id
      AND result_name = v_result_name
      AND COALESCE(instance_key, '') = COALESCE(v_instance_key, '')
    FOR UPDATE;

    IF FOUND THEN
      -- Pruefen, ob echter Wertunterschied vorliegt
      v_value_changed := (v_existing_res.value IS DISTINCT FROM v_new_num)
                      OR (v_existing_res.text_value IS DISTINCT FROM v_new_text);

      IF v_value_changed THEN
        UPDATE public.measurement_results
        SET
          value = v_new_num,
          text_value = v_new_text,
          unit = COALESCE(v_unit, v_existing_res.unit),
          display_label = COALESCE(v_display_label, v_existing_res.display_label),
          instance_label = COALESCE(v_instance_label, v_existing_res.instance_label),
          remarks = COALESCE(v_remarks, v_existing_res.remarks),
          updated_at = now()
        WHERE id = v_existing_res.id;

        INSERT INTO public.measurement_result_corrections (
          change_type, order_id, order_measurement_id, measurement_result_id, service_id,
          parameter_name, parameter_label, unit,
          old_value, new_value, old_text, new_text,
          old_sample_id, new_sample_id,
          reason, changed_by, changed_at,
          operation_id, raw_dataset_id
        ) VALUES (
          'value', v_meas.order_id, p_order_measurement_id, v_existing_res.id, v_meas.service_id,
          v_result_name, COALESCE(v_display_label, v_existing_res.display_label, v_result_name),
          COALESCE(v_unit, v_existing_res.unit),
          v_existing_res.value, v_new_num, v_existing_res.text_value, v_new_text,
          v_meas.sample_id, v_meas.sample_id,
          btrim(p_reason), v_user_id, now(),
          p_operation_id, p_new_raw_dataset_id
        );

        v_updated_count := v_updated_count + 1;
      ELSE
        -- Wert unveraendert: KEINE Metadaten-Aenderung ohne Historie (erster Umsetzungsschritt)
        v_unchanged_count := v_unchanged_count + 1;
      END IF;

    ELSE
      -- Neue Ergebniszeile ergaenzen: is_official serverseitig ermitteln
      v_is_official := false;

      IF EXISTS (
        SELECT 1 FROM public.service_parameter_definitions
        WHERE service_id = v_meas.service_id
          AND parameter_name = v_result_name
          AND parameter_category = 'output'
      ) OR EXISTS (
        SELECT 1 FROM public.service_data_fields
        WHERE service_id = v_meas.service_id
          AND field_key = v_result_name
          AND is_result = true
      ) OR (
        v_case_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.measurement_case_elements
          WHERE case_id = v_case_id
            AND element_key = v_result_name
            AND is_official = true
        )
      ) THEN
        v_is_official := true;
      END IF;

      INSERT INTO public.measurement_results (
        order_measurement_id, result_name, instance_key, instance_label,
        display_label, unit, value, text_value, remarks,
        is_official, created_at, updated_at
      ) VALUES (
        p_order_measurement_id, v_result_name, v_instance_key, v_instance_label,
        COALESCE(v_display_label, v_result_name), v_unit, v_new_num, v_new_text, v_remarks,
        v_is_official, now(), now()
      ) RETURNING id INTO v_target_res_id;

      INSERT INTO public.measurement_result_corrections (
        change_type, order_id, order_measurement_id, measurement_result_id, service_id,
        parameter_name, parameter_label, unit,
        old_value, new_value, old_text, new_text,
        old_sample_id, new_sample_id,
        reason, changed_by, changed_at,
        operation_id, raw_dataset_id
      ) VALUES (
        'ergänzt', v_meas.order_id, p_order_measurement_id, v_target_res_id, v_meas.service_id,
        v_result_name, COALESCE(v_display_label, v_result_name), v_unit,
        NULL, v_new_num, NULL, v_new_text,
        v_meas.sample_id, v_meas.sample_id,
        btrim(p_reason), v_user_id, now(),
        p_operation_id, p_new_raw_dataset_id
      );

      v_added_count := v_added_count + 1;
    END IF;
  END LOOP;

  v_affected_count := v_added_count + v_updated_count;

  -- 11. Rohdatensaetze verknuepfen und abloesen (falls vorhanden)
  IF p_new_raw_dataset_id IS NOT NULL THEN
    UPDATE public.measurement_raw_datasets
    SET
      operation_id = p_operation_id,
      replaces_dataset_id = p_replaces_dataset_id,
      updated_at = now()
    WHERE id = p_new_raw_dataset_id;

    IF p_replaces_dataset_id IS NOT NULL THEN
      UPDATE public.measurement_raw_datasets
      SET
        superseded_at = now(),
        updated_at = now()
      WHERE id = p_replaces_dataset_id;
    END IF;
  END IF;

  -- 12. Operationsprotokoll schreiben
  INSERT INTO public.measurement_import_operations (
    operation_id, order_measurement_id, payload_hash, reason,
    raw_dataset_id, replaces_dataset_id,
    affected_count, added_count, updated_count, unchanged_count,
    created_by, created_by_user_id, created_at
  ) VALUES (
    p_operation_id, p_order_measurement_id, v_payload_hash, btrim(p_reason),
    p_new_raw_dataset_id, p_replaces_dataset_id,
    v_affected_count, v_added_count, v_updated_count, v_unchanged_count,
    v_profile_id, v_user_id, now()
  );

  -- 13. Urspruenglichen Order-Lock-Bypass-Zustand wiederherstellen
  IF v_prior_bypass IS NULL OR v_prior_bypass = '' THEN
    PERFORM set_config('app.bypass_order_lock', 'off', true);
  ELSE
    PERFORM set_config('app.bypass_order_lock', v_prior_bypass, true);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_completed', false,
    'operation_id', p_operation_id,
    'added_count', v_added_count,
    'updated_count', v_updated_count,
    'unchanged_count', v_unchanged_count,
    'affected_count', v_affected_count,
    'raw_dataset_id', p_new_raw_dataset_id
  );
END;
$function$;

-- 8. Berechtigungen der RPC-Funktion
REVOKE ALL ON FUNCTION public.replace_measurement_results(uuid, uuid, jsonb, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_measurement_results(uuid, uuid, jsonb, text, uuid, uuid) TO authenticated;