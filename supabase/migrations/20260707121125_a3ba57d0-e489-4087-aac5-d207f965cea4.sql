
-- ============================================================
-- Restrict weighing / mixture production to 'mixtures.produce'.
-- 'raw_materials.manage' no longer implies the right to weigh
-- or produce mixture batches (it only covers raw-material master data).
-- SELECT policies are unchanged so raw-material managers can still
-- read weighing logs.
-- ============================================================

-- mixture_batches: production writes
DROP POLICY IF EXISTS "Mixture batches insert" ON public.mixture_batches;
DROP POLICY IF EXISTS "Mixture batches update" ON public.mixture_batches;
CREATE POLICY "Mixture batches insert" ON public.mixture_batches FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce'));
CREATE POLICY "Mixture batches update" ON public.mixture_batches FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce'));

-- mixture_inventory_movements
DROP POLICY IF EXISTS "Mixture movements insert" ON public.mixture_inventory_movements;
CREATE POLICY "Mixture movements insert" ON public.mixture_inventory_movements FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce'));

-- mixture_batch_consumptions
DROP POLICY IF EXISTS "Consumptions insert" ON public.mixture_batch_consumptions;
CREATE POLICY "Consumptions insert" ON public.mixture_batch_consumptions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce'));

-- mixture_batch_weighings: writes
DROP POLICY IF EXISTS weighings_manage ON public.mixture_batch_weighings;
CREATE POLICY weighings_manage ON public.mixture_batch_weighings FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce'));

-- mixture_batch_measurements: writes
DROP POLICY IF EXISTS batch_meas_manage ON public.mixture_batch_measurements;
CREATE POLICY batch_meas_manage ON public.mixture_batch_measurements FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce'));

-- mixture_batch_deviations: writes
DROP POLICY IF EXISTS dev_manage ON public.mixture_batch_deviations;
CREATE POLICY dev_manage ON public.mixture_batch_deviations FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce'));

-- mixture_batch_corrections: writes
DROP POLICY IF EXISTS "corrections insert by authorized" ON public.mixture_batch_corrections;
CREATE POLICY "corrections insert by authorized"
  ON public.mixture_batch_corrections FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'master'::app_role)
    OR has_permission(auth.uid(),'mixtures.produce')
  );

-- ============================================================
-- RPCs — remove 'raw_materials.manage' from production/weighing paths
-- ============================================================

CREATE OR REPLACE FUNCTION public.weigh_mixture_batch(
  _mixture_id uuid,
  _unit text DEFAULT 'kg',
  _concentration text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _planned_quantity numeric DEFAULT NULL,
  _weighings jsonb DEFAULT '[]'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_batch_id uuid;
  v_w jsonb;
  v_container raw_material_containers%ROWTYPE;
  v_lot text;
  v_loc text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentifizierung erforderlich'; END IF;
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'mixtures.produce')) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Verwiegen';
  END IF;

  INSERT INTO public.mixture_batches
    (mixture_id, produced_by, produced_quantity, unit, concentration, notes, execution_status, started_at)
  VALUES
    (_mixture_id, v_actor, 0, COALESCE(_unit,'kg'), _concentration, _notes, 'geplant', now())
  RETURNING id INTO v_batch_id;

  IF _weighings IS NOT NULL THEN
    FOR v_w IN SELECT * FROM jsonb_array_elements(_weighings) LOOP
      v_container := NULL;
      v_lot := NULL; v_loc := NULL;
      IF (v_w->>'container_id') IS NOT NULL AND (v_w->>'container_id') <> '' THEN
        SELECT * INTO v_container FROM raw_material_containers WHERE id=(v_w->>'container_id')::uuid;
        SELECT string_agg(b.batch_number, ', ' ORDER BY b.delivery_date NULLS LAST)
          INTO v_lot
          FROM container_batch_positions p
          JOIN raw_material_batches b ON b.id = p.batch_id
         WHERE p.container_id = v_container.id AND p.quantity > 0;
        SELECT name INTO v_loc FROM storage_locations WHERE id = v_container.location_id;
      END IF;

      INSERT INTO public.mixture_batch_weighings(
        batch_id, raw_material_id, raw_material_batch_id, container_id,
        target_quantity, actual_quantity, unit, notes,
        container_code_snapshot, container_name_snapshot, lot_number_snapshot,
        tare_weight_snapshot, gross_weight, location_snapshot,
        confirmed, confirmed_at, confirmed_by, weighed_by
      ) VALUES (
        v_batch_id,
        (v_w->>'raw_material_id')::uuid,
        NULLIF(v_w->>'raw_material_batch_id','')::uuid,
        v_container.id,
        NULLIF(v_w->>'target_quantity','')::numeric,
        COALESCE(NULLIF(v_w->>'actual_quantity','')::numeric, 0),
        COALESCE(v_w->>'unit','kg'),
        NULLIF(v_w->>'notes',''),
        v_container.container_code,
        v_container.container_name,
        v_lot,
        v_container.tare_weight,
        NULLIF(v_w->>'gross_weight','')::numeric,
        v_loc,
        COALESCE((v_w->>'confirmed')::boolean, false),
        CASE WHEN COALESCE((v_w->>'confirmed')::boolean,false) THEN now() ELSE NULL END,
        CASE WHEN COALESCE((v_w->>'confirmed')::boolean,false) THEN v_actor ELSE NULL END,
        v_actor
      );
    END LOOP;
  END IF;

  RETURN v_batch_id;
END $$;

CREATE OR REPLACE FUNCTION public.finalize_mixture_batch(
  _batch_id uuid,
  _produced_quantity numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_batch mixture_batches%ROWTYPE;
  v_w mixture_batch_weighings%ROWTYPE;
  v_mov_id uuid;
  v_inv_id uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentifizierung erforderlich'; END IF;
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'mixtures.produce')) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Abschließen der Charge';
  END IF;
  IF _produced_quantity IS NULL OR _produced_quantity <= 0 THEN
    RAISE EXCEPTION 'Hergestellte Menge muss > 0 sein';
  END IF;

  SELECT * INTO v_batch FROM mixture_batches WHERE id=_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Charge nicht gefunden'; END IF;
  IF v_batch.execution_status = 'abgeschlossen' THEN
    RAISE EXCEPTION 'Charge bereits abgeschlossen';
  END IF;

  FOR v_w IN
    SELECT * FROM mixture_batch_weighings
     WHERE batch_id=_batch_id AND container_id IS NOT NULL AND actual_quantity > 0
  LOOP
    v_mov_id := public.record_container_movement(
      v_w.container_id,
      'verbrauch'::container_movement_type,
      v_w.actual_quantity,
      NULL, NULL, NULL,
      'MIX '||v_batch.id,
      'Chargenabschluss '||v_batch.batch_number
    );
    SELECT inventory_movement_id INTO v_inv_id FROM container_movements WHERE id=v_mov_id;
    INSERT INTO mixture_batch_consumptions
      (mixture_batch_id, raw_material_id, raw_material_batch_id, quantity, unit, inventory_movement_id)
    VALUES
      (_batch_id, v_w.raw_material_id, v_w.raw_material_batch_id, v_w.actual_quantity, v_w.unit, v_inv_id);
  END LOOP;

  FOR v_w IN
    SELECT * FROM mixture_batch_weighings
     WHERE batch_id=_batch_id AND container_id IS NULL AND actual_quantity > 0
  LOOP
    INSERT INTO inventory_movements(raw_material_id, batch_id, movement_type, quantity, comment, created_by)
    VALUES (v_w.raw_material_id, v_w.raw_material_batch_id, 'verbrauch', v_w.actual_quantity,
      'Chargenabschluss '||v_batch.batch_number, v_actor)
    RETURNING id INTO v_inv_id;
    INSERT INTO mixture_batch_consumptions
      (mixture_batch_id, raw_material_id, raw_material_batch_id, quantity, unit, inventory_movement_id)
    VALUES
      (_batch_id, v_w.raw_material_id, v_w.raw_material_batch_id, v_w.actual_quantity, v_w.unit, v_inv_id);
  END LOOP;

  UPDATE mixture_batches
     SET execution_status='abgeschlossen',
         ended_at = now(),
         produced_quantity = _produced_quantity
   WHERE id=_batch_id;

  INSERT INTO mixture_inventory_movements
    (mixture_id, mixture_batch_id, movement_type, quantity, unit, comment, created_by)
  VALUES
    (v_batch.mixture_id, _batch_id, 'eingang', _produced_quantity, v_batch.unit,
     'Chargenabschluss', v_actor);
END $$;

CREATE OR REPLACE FUNCTION public.correct_mixture_weighing(
  _weighing_id uuid,
  _new_actual_quantity numeric,
  _new_container_id uuid,
  _new_notes text,
  _reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_w mixture_batch_weighings%ROWTYPE;
  v_batch mixture_batches%ROWTYPE;
  v_delta numeric;
  v_mov_id uuid;
  v_inv_id uuid;
  v_container raw_material_containers%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentifizierung erforderlich'; END IF;
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'mixtures.produce')) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Korrigieren einer Verwiegung';
  END IF;
  IF _reason IS NULL OR btrim(_reason) = '' THEN
    RAISE EXCEPTION 'Grund für Korrektur ist erforderlich';
  END IF;

  SELECT * INTO v_w FROM mixture_batch_weighings WHERE id=_weighing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verwiegung nicht gefunden'; END IF;
  SELECT * INTO v_batch FROM mixture_batches WHERE id=v_w.batch_id FOR UPDATE;

  IF _new_notes IS DISTINCT FROM v_w.notes THEN
    INSERT INTO mixture_batch_corrections(batch_id, weighing_id, field, old_value, new_value, reason, created_by)
    VALUES (v_batch.id, v_w.id, 'notes', v_w.notes, _new_notes, _reason, v_actor);
  END IF;

  IF _new_container_id IS DISTINCT FROM v_w.container_id THEN
    IF v_batch.execution_status = 'abgeschlossen' THEN
      RAISE EXCEPTION 'Gebinde einer abgeschlossenen Charge kann nicht mehr geändert werden';
    END IF;
    INSERT INTO mixture_batch_corrections(batch_id, weighing_id, field, old_value, new_value, reason, created_by)
    VALUES (v_batch.id, v_w.id, 'container_id',
            COALESCE(v_w.container_id::text,''), COALESCE(_new_container_id::text,''),
            _reason, v_actor);
    IF _new_container_id IS NOT NULL THEN
      SELECT * INTO v_container FROM raw_material_containers WHERE id=_new_container_id;
      UPDATE mixture_batch_weighings SET
        container_id = _new_container_id,
        container_code_snapshot = v_container.container_code,
        container_name_snapshot = v_container.container_name,
        tare_weight_snapshot = v_container.tare_weight
      WHERE id = v_w.id;
    ELSE
      UPDATE mixture_batch_weighings SET container_id = NULL WHERE id = v_w.id;
    END IF;
  END IF;

  v_delta := COALESCE(_new_actual_quantity,0) - COALESCE(v_w.actual_quantity,0);
  IF v_delta <> 0 THEN
    INSERT INTO mixture_batch_corrections(batch_id, weighing_id, field, old_value, new_value, delta, reason, created_by)
    VALUES (v_batch.id, v_w.id, 'actual_quantity',
            v_w.actual_quantity::text, _new_actual_quantity::text, v_delta, _reason, v_actor);

    IF v_batch.execution_status = 'abgeschlossen' AND v_w.container_id IS NOT NULL THEN
      IF v_delta > 0 THEN
        v_mov_id := public.record_container_movement(
          v_w.container_id, 'verbrauch'::container_movement_type, v_delta,
          NULL, NULL, NULL,
          'MIX '||v_batch.id, 'Korrektur Verwiegung: '||_reason
        );
      ELSE
        v_mov_id := public.record_container_movement(
          v_w.container_id, 'korrektur_plus'::container_movement_type, abs(v_delta),
          NULL, NULL, NULL,
          'MIX '||v_batch.id, 'Korrektur Verwiegung (Rücknahme): '||_reason
        );
      END IF;
      SELECT inventory_movement_id INTO v_inv_id FROM container_movements WHERE id=v_mov_id;
      INSERT INTO mixture_batch_consumptions
        (mixture_batch_id, raw_material_id, raw_material_batch_id, quantity, unit, inventory_movement_id)
      VALUES
        (v_batch.id, v_w.raw_material_id, v_w.raw_material_batch_id, v_delta, v_w.unit, v_inv_id);
    END IF;

    UPDATE mixture_batch_weighings SET actual_quantity = _new_actual_quantity WHERE id = v_w.id;
  END IF;

  IF _new_notes IS DISTINCT FROM v_w.notes THEN
    UPDATE mixture_batch_weighings SET notes = _new_notes WHERE id = v_w.id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.correct_mixture_batch_quantity(
  _batch_id uuid,
  _new_produced_quantity numeric,
  _reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_batch mixture_batches%ROWTYPE;
  v_delta numeric;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentifizierung erforderlich'; END IF;
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'mixtures.produce')) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Korrigieren der Chargenmenge';
  END IF;
  IF _reason IS NULL OR btrim(_reason) = '' THEN
    RAISE EXCEPTION 'Grund für Korrektur ist erforderlich';
  END IF;
  IF _new_produced_quantity IS NULL OR _new_produced_quantity < 0 THEN
    RAISE EXCEPTION 'Ungültige Menge';
  END IF;

  SELECT * INTO v_batch FROM mixture_batches WHERE id=_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Charge nicht gefunden'; END IF;

  v_delta := _new_produced_quantity - COALESCE(v_batch.produced_quantity,0);

  INSERT INTO mixture_batch_corrections(batch_id, field, old_value, new_value, delta, reason, created_by)
  VALUES (_batch_id, 'produced_quantity',
          v_batch.produced_quantity::text, _new_produced_quantity::text, v_delta, _reason, v_actor);

  UPDATE mixture_batches SET produced_quantity = _new_produced_quantity WHERE id=_batch_id;

  IF v_batch.execution_status = 'abgeschlossen' AND v_delta <> 0 THEN
    INSERT INTO mixture_inventory_movements
      (mixture_id, mixture_batch_id, movement_type, quantity, unit, comment, created_by)
    VALUES
      (v_batch.mixture_id, _batch_id,
       CASE WHEN v_delta > 0 THEN 'eingang' ELSE 'ausgang' END,
       abs(v_delta), v_batch.unit,
       'Mengenkorrektur: '||_reason, v_actor);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.produce_mixture_batch(_mixture_id uuid, _produced_quantity numeric, _unit text, _concentration text, _notes text, _consumptions jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_batch_id uuid;
  v_consumption jsonb;
  v_raw_material_id uuid;
  v_raw_material_batch_id uuid;
  v_quantity numeric;
  v_unit text;
  v_movement_id uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentifizierung erforderlich'; END IF;
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'mixtures.produce')) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Herstellen von Knetungen/Lösungen';
  END IF;
  IF _produced_quantity IS NULL OR _produced_quantity <= 0 THEN
    RAISE EXCEPTION 'Hergestellte Menge muss positiv sein';
  END IF;
  INSERT INTO public.mixture_batches (mixture_id, produced_by, produced_quantity, unit, concentration, notes)
  VALUES (_mixture_id, v_actor, _produced_quantity, COALESCE(_unit,'kg'), _concentration, _notes)
  RETURNING id INTO v_batch_id;
  IF _consumptions IS NOT NULL THEN
    FOR v_consumption IN SELECT * FROM jsonb_array_elements(_consumptions) LOOP
      v_raw_material_id := (v_consumption->>'raw_material_id')::uuid;
      v_raw_material_batch_id := NULLIF(v_consumption->>'raw_material_batch_id','')::uuid;
      v_quantity := (v_consumption->>'quantity')::numeric;
      v_unit := COALESCE(v_consumption->>'unit','kg');
      IF v_raw_material_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 THEN CONTINUE; END IF;
      INSERT INTO public.inventory_movements (raw_material_id, batch_id, movement_type, quantity, comment, created_by)
      VALUES (v_raw_material_id, v_raw_material_batch_id, 'verbrauch', v_quantity,
        'Knetungsherstellung Charge '||(SELECT batch_number FROM public.mixture_batches WHERE id = v_batch_id), v_actor)
      RETURNING id INTO v_movement_id;
      INSERT INTO public.mixture_batch_consumptions (mixture_batch_id, raw_material_id, raw_material_batch_id, quantity, unit, inventory_movement_id)
      VALUES (v_batch_id, v_raw_material_id, v_raw_material_batch_id, v_quantity, v_unit, v_movement_id);
    END LOOP;
  END IF;
  INSERT INTO public.mixture_inventory_movements (mixture_id, mixture_batch_id, movement_type, quantity, unit, comment, created_by)
  VALUES (_mixture_id, v_batch_id, 'eingang', _produced_quantity, COALESCE(_unit,'kg'), 'Herstellung', v_actor);
  INSERT INTO public.activity_log (event_type, actor_user_id, metadata)
  VALUES ('mixture_batch_produced', v_actor,
    jsonb_build_object('mixture_id', _mixture_id, 'mixture_batch_id', v_batch_id,
      'produced_quantity', _produced_quantity, 'unit', _unit, 'concentration', _concentration));
  RETURN v_batch_id;
END $function$;

CREATE OR REPLACE FUNCTION public.complete_mixture_batch(_batch_id uuid, _produced_quantity numeric DEFAULT NULL::numeric)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_actor uuid := auth.uid(); v_mix uuid; v_qty numeric; v_unit text;
BEGIN
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'mixtures.produce')) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  UPDATE mixture_batches SET execution_status='abgeschlossen', ended_at=now(),
    produced_quantity=COALESCE(_produced_quantity, produced_quantity)
   WHERE id=_batch_id RETURNING mixture_id, produced_quantity, unit INTO v_mix, v_qty, v_unit;
  IF NOT EXISTS (SELECT 1 FROM mixture_inventory_movements WHERE mixture_batch_id=_batch_id AND movement_type='eingang') THEN
    INSERT INTO mixture_inventory_movements (mixture_id, mixture_batch_id, movement_type, quantity, unit, comment, created_by)
    VALUES (v_mix, _batch_id, 'eingang', COALESCE(v_qty,0), COALESCE(v_unit,'kg'), 'Charge abgeschlossen', v_actor);
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.release_mixture_batch(_batch_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_actor uuid := auth.uid(); v_producer uuid;
BEGIN
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'mixtures.produce')) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  SELECT produced_by INTO v_producer FROM mixture_batches WHERE id=_batch_id;
  IF v_producer = v_actor THEN
    RAISE EXCEPTION '4-Augen-Prinzip: Freigabe durch zweite Person erforderlich';
  END IF;
  UPDATE mixture_batches SET execution_status='freigegeben', released_at=now(), released_by=v_actor
   WHERE id=_batch_id AND execution_status='abgeschlossen';
END $function$;

CREATE OR REPLACE FUNCTION public.record_mixture_weighing(_batch_id uuid, _step_id uuid, _raw_material_id uuid, _raw_material_batch_id uuid, _target_quantity numeric, _actual_quantity numeric, _unit text, _notes text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_actor uuid := auth.uid(); v_movement uuid; v_weighing uuid; v_batch_no text;
BEGIN
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'mixtures.produce')) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Verwiegen'; END IF;
  IF _actual_quantity IS NULL OR _actual_quantity <= 0 THEN RAISE EXCEPTION 'Menge muss > 0 sein'; END IF;
  SELECT batch_number INTO v_batch_no FROM mixture_batches WHERE id=_batch_id;
  INSERT INTO inventory_movements (raw_material_id, batch_id, movement_type, quantity, comment, created_by)
  VALUES (_raw_material_id, _raw_material_batch_id, 'verbrauch', _actual_quantity,
    'Knetungsherstellung Charge '||COALESCE(v_batch_no,_batch_id::text), v_actor)
  RETURNING id INTO v_movement;
  INSERT INTO mixture_batch_consumptions (mixture_batch_id, raw_material_id, raw_material_batch_id, quantity, unit, inventory_movement_id)
  VALUES (_batch_id, _raw_material_id, _raw_material_batch_id, _actual_quantity, COALESCE(_unit,'kg'), v_movement);
  INSERT INTO mixture_batch_weighings (batch_id, step_id, raw_material_id, raw_material_batch_id, target_quantity, actual_quantity, unit, notes, performed_by, inventory_movement_id)
  VALUES (_batch_id, _step_id, _raw_material_id, _raw_material_batch_id, _target_quantity, _actual_quantity, COALESCE(_unit,'kg'), _notes, v_actor, v_movement)
  RETURNING id INTO v_weighing;
  RETURN v_weighing;
END $function$;

CREATE OR REPLACE FUNCTION public.start_mixture_batch(_mixture_id uuid, _recipe_version_id uuid, _planned_quantity numeric, _unit text DEFAULT 'kg'::text, _scale_factor numeric DEFAULT 1)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_actor uuid := auth.uid(); v_id uuid;
BEGIN
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'mixtures.produce')) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  INSERT INTO mixture_batches (mixture_id, recipe_version_id, produced_by, produced_quantity, planned_quantity, scale_factor, unit, execution_status, started_at)
  VALUES (_mixture_id, _recipe_version_id, v_actor, 0, _planned_quantity, _scale_factor, _unit, 'in_arbeit', now())
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;
