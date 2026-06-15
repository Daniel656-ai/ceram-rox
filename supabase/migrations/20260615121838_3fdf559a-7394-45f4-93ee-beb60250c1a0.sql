
CREATE OR REPLACE FUNCTION public.produce_mixture_batch(
  _mixture_id uuid,
  _produced_quantity numeric,
  _unit text,
  _concentration text,
  _notes text,
  _consumptions jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentifizierung erforderlich';
  END IF;

  IF NOT (public.has_role(v_actor, 'master'::app_role) OR public.has_permission(v_actor, 'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Herstellen von Mischungen';
  END IF;

  IF _produced_quantity IS NULL OR _produced_quantity <= 0 THEN
    RAISE EXCEPTION 'Hergestellte Menge muss positiv sein';
  END IF;

  INSERT INTO public.mixture_batches (mixture_id, produced_by, produced_quantity, unit, concentration, notes)
  VALUES (_mixture_id, v_actor, _produced_quantity, COALESCE(_unit, 'kg'), _concentration, _notes)
  RETURNING id INTO v_batch_id;

  IF _consumptions IS NOT NULL THEN
    FOR v_consumption IN SELECT * FROM jsonb_array_elements(_consumptions)
    LOOP
      v_raw_material_id := (v_consumption->>'raw_material_id')::uuid;
      v_raw_material_batch_id := NULLIF(v_consumption->>'raw_material_batch_id', '')::uuid;
      v_quantity := (v_consumption->>'quantity')::numeric;
      v_unit := COALESCE(v_consumption->>'unit', 'kg');

      IF v_raw_material_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 THEN
        CONTINUE;
      END IF;

      INSERT INTO public.inventory_movements
        (raw_material_id, batch_id, movement_type, quantity, comment, created_by)
      VALUES
        (v_raw_material_id, v_raw_material_batch_id, 'verbrauch', v_quantity,
         'Mischungsherstellung Charge ' || (SELECT batch_number FROM public.mixture_batches WHERE id = v_batch_id),
         v_actor)
      RETURNING id INTO v_movement_id;

      INSERT INTO public.mixture_batch_consumptions
        (mixture_batch_id, raw_material_id, raw_material_batch_id, quantity, unit, inventory_movement_id)
      VALUES
        (v_batch_id, v_raw_material_id, v_raw_material_batch_id, v_quantity, v_unit, v_movement_id);
    END LOOP;
  END IF;

  INSERT INTO public.mixture_inventory_movements
    (mixture_id, mixture_batch_id, movement_type, quantity, unit, comment, created_by)
  VALUES
    (_mixture_id, v_batch_id, 'eingang', _produced_quantity, COALESCE(_unit, 'kg'),
     'Herstellung', v_actor);

  INSERT INTO public.activity_log (event_type, actor_user_id, metadata)
  VALUES (
    'mixture_batch_produced',
    v_actor,
    jsonb_build_object(
      'mixture_id', _mixture_id,
      'mixture_batch_id', v_batch_id,
      'produced_quantity', _produced_quantity,
      'unit', _unit,
      'concentration', _concentration
    )
  );

  RETURN v_batch_id;
END;
$$;
