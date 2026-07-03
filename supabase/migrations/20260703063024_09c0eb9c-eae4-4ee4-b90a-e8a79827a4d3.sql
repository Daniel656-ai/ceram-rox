
-- Phase 1: Verwiegen (weighing) preparation
-- 1) Tara/name/default on containers
ALTER TABLE public.raw_material_containers
  ADD COLUMN IF NOT EXISTS tare_weight numeric,
  ADD COLUMN IF NOT EXISTS tare_unit text DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS container_name text,
  ADD COLUMN IF NOT EXISTS is_default_container boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expiry_date date;

-- 2) Weighing snapshot + confirmation on mixture_batch_weighings
ALTER TABLE public.mixture_batch_weighings
  ADD COLUMN IF NOT EXISTS container_id uuid REFERENCES public.raw_material_containers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS container_code_snapshot text,
  ADD COLUMN IF NOT EXISTS container_name_snapshot text,
  ADD COLUMN IF NOT EXISTS lot_number_snapshot text,
  ADD COLUMN IF NOT EXISTS tare_weight_snapshot numeric,
  ADD COLUMN IF NOT EXISTS gross_weight numeric,
  ADD COLUMN IF NOT EXISTS confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS location_snapshot text;

-- 3) RPC: start a weighing (creates batch in geplant, records weighings; NO inventory)
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
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'mixtures.produce') OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
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

-- 4) RPC: finalize weighed batch → book inventory now
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
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'mixtures.produce') OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;
  IF _produced_quantity IS NULL OR _produced_quantity <= 0 THEN
    RAISE EXCEPTION 'Hergestellte Menge muss > 0 sein';
  END IF;

  SELECT * INTO v_batch FROM mixture_batches WHERE id=_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Charge nicht gefunden'; END IF;
  IF v_batch.execution_status = 'abgeschlossen' THEN
    RAISE EXCEPTION 'Charge bereits abgeschlossen';
  END IF;

  -- For each confirmed weighing with a container, book consumption via existing FIFO RPC
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
    -- link inventory movement id (best-effort)
    SELECT inventory_movement_id INTO v_inv_id FROM container_movements WHERE id=v_mov_id;
    INSERT INTO mixture_batch_consumptions
      (mixture_batch_id, raw_material_id, raw_material_batch_id, quantity, unit, inventory_movement_id)
    VALUES
      (_batch_id, v_w.raw_material_id, v_w.raw_material_batch_id, v_w.actual_quantity, v_w.unit, v_inv_id);
  END LOOP;

  -- Also handle weighings without container (legacy path): direct inventory verbrauch
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

  -- Book produced mixture (eingang)
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

GRANT EXECUTE ON FUNCTION public.weigh_mixture_batch(uuid,text,text,text,numeric,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_mixture_batch(uuid,numeric) TO authenticated;
