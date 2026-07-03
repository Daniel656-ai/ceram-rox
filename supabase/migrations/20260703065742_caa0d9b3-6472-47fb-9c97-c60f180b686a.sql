
-- Phase 2: Live corrections & audit for weighed/finalized batches

-- 1) Corrections log
CREATE TABLE IF NOT EXISTS public.mixture_batch_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.mixture_batches(id) ON DELETE CASCADE,
  weighing_id uuid REFERENCES public.mixture_batch_weighings(id) ON DELETE SET NULL,
  field text NOT NULL,             -- 'actual_quantity' | 'container_id' | 'notes' | 'produced_quantity'
  old_value text,
  new_value text,
  delta numeric,                   -- for quantity changes
  reason text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.mixture_batch_corrections TO authenticated;
GRANT ALL ON public.mixture_batch_corrections TO service_role;

ALTER TABLE public.mixture_batch_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "corrections readable by authorized"
  ON public.mixture_batch_corrections FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(),'master'::app_role)
    OR has_permission(auth.uid(),'mixtures.produce')
    OR has_permission(auth.uid(),'mixtures.view')
    OR has_permission(auth.uid(),'raw_materials.manage')
  );

CREATE POLICY "corrections insert by authorized"
  ON public.mixture_batch_corrections FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'master'::app_role)
    OR has_permission(auth.uid(),'mixtures.produce')
    OR has_permission(auth.uid(),'raw_materials.manage')
  );

-- 2) RPC: correct a single weighing on an existing batch
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
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'mixtures.produce') OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;
  IF _reason IS NULL OR btrim(_reason) = '' THEN
    RAISE EXCEPTION 'Grund für Korrektur ist erforderlich';
  END IF;

  SELECT * INTO v_w FROM mixture_batch_weighings WHERE id=_weighing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verwiegung nicht gefunden'; END IF;
  SELECT * INTO v_batch FROM mixture_batches WHERE id=v_w.batch_id FOR UPDATE;

  -- notes change
  IF _new_notes IS DISTINCT FROM v_w.notes THEN
    INSERT INTO mixture_batch_corrections(batch_id, weighing_id, field, old_value, new_value, reason, created_by)
    VALUES (v_batch.id, v_w.id, 'notes', v_w.notes, _new_notes, _reason, v_actor);
  END IF;

  -- container change (only allowed if not yet finalized OR no consumption booked yet)
  IF _new_container_id IS DISTINCT FROM v_w.container_id THEN
    IF v_batch.execution_status = 'abgeschlossen' THEN
      RAISE EXCEPTION 'Gebinde einer abgeschlossenen Charge kann nicht mehr geändert werden';
    END IF;
    INSERT INTO mixture_batch_corrections(batch_id, weighing_id, field, old_value, new_value, reason, created_by)
    VALUES (v_batch.id, v_w.id, 'container_id',
            COALESCE(v_w.container_id::text,''), COALESCE(_new_container_id::text,''),
            _reason, v_actor);
    -- refresh snapshots
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

  -- quantity change
  v_delta := COALESCE(_new_actual_quantity,0) - COALESCE(v_w.actual_quantity,0);
  IF v_delta <> 0 THEN
    INSERT INTO mixture_batch_corrections(batch_id, weighing_id, field, old_value, new_value, delta, reason, created_by)
    VALUES (v_batch.id, v_w.id, 'actual_quantity',
            v_w.actual_quantity::text, _new_actual_quantity::text, v_delta, _reason, v_actor);

    -- If batch already finalized → book delta as additional movement
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

GRANT EXECUTE ON FUNCTION public.correct_mixture_weighing(uuid, numeric, uuid, text, text) TO authenticated;

-- 3) RPC: correct produced quantity of a finalized batch
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
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'mixtures.produce') OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
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

GRANT EXECUTE ON FUNCTION public.correct_mixture_batch_quantity(uuid, numeric, text) TO authenticated;
