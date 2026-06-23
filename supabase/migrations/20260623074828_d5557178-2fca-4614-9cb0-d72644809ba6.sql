CREATE OR REPLACE FUNCTION public.book_container_consumption(
  _container_id uuid,
  _quantity numeric,
  _movement_date date DEFAULT CURRENT_DATE,
  _project_reference text DEFAULT NULL,
  _comment text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_container raw_material_containers%ROWTYPE;
  v_new_qty numeric;
  v_inv_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentifizierung erforderlich';
  END IF;
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung für Lagerbuchungen';
  END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN
    RAISE EXCEPTION 'Verbrauchsmenge muss größer als 0 sein';
  END IF;

  -- Lock the container row to prevent concurrent overdraws
  SELECT * INTO v_container FROM raw_material_containers WHERE id = _container_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gebinde nicht gefunden';
  END IF;

  IF v_container.current_quantity <= 0 THEN
    RAISE EXCEPTION 'Bestand des Gebindes % ist 0 – kein Verbrauch möglich', v_container.container_code;
  END IF;

  v_new_qty := v_container.current_quantity - _quantity;
  IF v_new_qty < 0 THEN
    RAISE EXCEPTION 'Verbrauchsmenge (% %) überschreitet den verfügbaren Bestand (% %) des Gebindes %',
      _quantity, v_container.unit, v_container.current_quantity, v_container.unit, v_container.container_code;
  END IF;

  -- 1) Inventory movement (material-level history)
  INSERT INTO inventory_movements (
    raw_material_id, batch_id, movement_type, quantity, movement_date,
    project_reference, comment, created_by
  ) VALUES (
    v_container.raw_material_id, v_container.batch_id, 'verbrauch', _quantity,
    COALESCE(_movement_date, CURRENT_DATE), _project_reference,
    COALESCE(_comment, 'Verbrauch Gebinde ' || v_container.container_code), v_actor
  ) RETURNING id INTO v_inv_id;

  -- 2) Container movement (per-container history)
  INSERT INTO container_movements (
    container_id, movement_type, quantity, quantity_before, quantity_after,
    inventory_movement_id, reference, comment, created_by
  ) VALUES (
    _container_id, 'verbrauch', _quantity, v_container.current_quantity, v_new_qty,
    v_inv_id, _project_reference, _comment, v_actor
  );

  -- 3) Update container stock + status
  UPDATE raw_material_containers
     SET current_quantity = v_new_qty,
         status = CASE WHEN v_new_qty = 0 THEN 'leer'::container_status ELSE status END
   WHERE id = _container_id;

  RETURN v_inv_id;
END $$;

GRANT EXECUTE ON FUNCTION public.book_container_consumption(uuid, numeric, date, text, text) TO authenticated;