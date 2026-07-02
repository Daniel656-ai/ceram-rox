
CREATE OR REPLACE FUNCTION public.record_container_movement(
  _container_id uuid,
  _movement_type container_movement_type,
  _quantity numeric DEFAULT NULL::numeric,
  _new_quantity numeric DEFAULT NULL::numeric,
  _to_location_id uuid DEFAULT NULL::uuid,
  _to_location_note text DEFAULT NULL::text,
  _reference text DEFAULT NULL::text,
  _comment text DEFAULT NULL::text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_container raw_material_containers%ROWTYPE;
  v_qty_before numeric;
  v_qty_after numeric;
  v_delta numeric := COALESCE(_quantity, 0);
  v_movement_id uuid;
  v_from_loc uuid;
  v_inv_id uuid;
  v_has_positions boolean;
  v_pos_sum numeric;
  v_remaining numeric;
  v_take numeric;
  v_pos record;
  v_ratio numeric;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentifizierung erforderlich'; END IF;
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung für Gebinde-Bewegungen';
  END IF;

  SELECT * INTO v_container FROM raw_material_containers WHERE id = _container_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gebinde nicht gefunden'; END IF;

  v_qty_before := v_container.current_quantity;
  v_from_loc := v_container.location_id;

  SELECT COALESCE(SUM(quantity),0), COUNT(*)>0
    INTO v_pos_sum, v_has_positions
    FROM container_batch_positions WHERE container_id = _container_id;

  v_qty_after := CASE _movement_type
    WHEN 'eingang'         THEN v_qty_before + v_delta
    WHEN 'verbrauch'       THEN v_qty_before - v_delta
    WHEN 'entsorgung'      THEN 0
    WHEN 'korrektur_plus'  THEN v_qty_before + v_delta
    WHEN 'korrektur_minus' THEN v_qty_before - v_delta
    WHEN 'inventur'        THEN COALESCE(_new_quantity, v_qty_before)
    WHEN 'umlagerung'      THEN v_qty_before
    WHEN 'reservierung'    THEN v_qty_before
    WHEN 'freigabe_reservierung' THEN v_qty_before
  END;

  IF v_qty_after < 0 THEN
    RAISE EXCEPTION 'Bestand würde negativ werden (% -> %)', v_qty_before, v_qty_after;
  END IF;

  -- Aggregate inventory_movement (single row for the container-level move)
  IF _movement_type IN ('eingang','verbrauch','korrektur_plus','korrektur_minus') THEN
    INSERT INTO inventory_movements (raw_material_id, batch_id, movement_type, quantity, comment, created_by)
    VALUES (v_container.raw_material_id, v_container.batch_id,
      CASE WHEN _movement_type IN ('eingang','korrektur_plus') THEN 'eingang' ELSE 'verbrauch' END,
      ABS(v_qty_after - v_qty_before),
      COALESCE(_comment, 'Gebinde '||v_container.container_code), v_actor)
    RETURNING id INTO v_inv_id;
  END IF;

  -- Save container_movement
  INSERT INTO container_movements (container_id, movement_type, quantity, quantity_before, quantity_after,
    from_location_id, to_location_id, inventory_movement_id, reference, comment, created_by)
  VALUES (_container_id, _movement_type, COALESCE(_quantity, ABS(v_qty_after - v_qty_before)),
    v_qty_before, v_qty_after, v_from_loc,
    CASE WHEN _movement_type = 'umlagerung' THEN _to_location_id ELSE NULL END,
    v_inv_id, _reference, _comment, v_actor)
  RETURNING id INTO v_movement_id;

  -- Position + container updates
  IF _movement_type = 'umlagerung' THEN
    UPDATE raw_material_containers
       SET location_id = _to_location_id,
           location_note = COALESCE(_to_location_note, location_note),
           updated_at = now()
     WHERE id = _container_id;

  ELSIF _movement_type = 'entsorgung' THEN
    IF v_has_positions THEN
      DELETE FROM container_batch_positions WHERE container_id = _container_id;
    END IF;
    UPDATE raw_material_containers
       SET current_quantity = 0, status = 'entsorgt'::container_status, updated_at = now()
     WHERE id = _container_id;

  ELSIF _movement_type = 'reservierung' THEN
    UPDATE raw_material_containers
       SET reserved_quantity = reserved_quantity + COALESCE(_quantity,0), updated_at = now()
     WHERE id = _container_id;

  ELSIF _movement_type = 'freigabe_reservierung' THEN
    UPDATE raw_material_containers
       SET reserved_quantity = GREATEST(reserved_quantity - COALESCE(_quantity,0), 0), updated_at = now()
     WHERE id = _container_id;

  ELSIF _movement_type IN ('verbrauch','korrektur_minus') THEN
    IF v_has_positions THEN
      -- FIFO across positions (oldest LOT first)
      v_remaining := v_delta;
      FOR v_pos IN
        SELECT p.id, p.batch_id, p.quantity, b.batch_number
          FROM container_batch_positions p
          JOIN raw_material_batches b ON b.id = p.batch_id
         WHERE p.container_id = _container_id AND p.quantity > 0
         ORDER BY b.delivery_date NULLS LAST, p.created_at ASC
         FOR UPDATE
      LOOP
        EXIT WHEN v_remaining <= 0;
        v_take := LEAST(v_pos.quantity, v_remaining);
        UPDATE container_batch_positions SET quantity = quantity - v_take WHERE id = v_pos.id;
        -- Per-LOT inventory movement (traceability)
        INSERT INTO inventory_movements (raw_material_id, batch_id, movement_type, quantity, comment, created_by)
        VALUES (v_container.raw_material_id, v_pos.batch_id,
          CASE WHEN _movement_type = 'verbrauch' THEN 'verbrauch' ELSE 'verbrauch' END,
          v_take,
          COALESCE(_comment,'Gebinde '||v_container.container_code)||' – LOT '||v_pos.batch_number||' (FIFO)', v_actor);
        v_remaining := v_remaining - v_take;
      END LOOP;
      -- current_quantity wird automatisch durch Positions-Trigger neu berechnet
    ELSE
      UPDATE raw_material_containers
         SET current_quantity = v_qty_after,
             status = CASE WHEN v_qty_after<=0 AND status NOT IN ('entsorgt','gesperrt') THEN 'leer'::container_status ELSE status END,
             updated_at = now()
       WHERE id = _container_id;
    END IF;

  ELSIF _movement_type IN ('eingang','korrektur_plus') THEN
    IF v_container.batch_id IS NOT NULL THEN
      -- Standard-LOT des Gebindes befüllen (Position anlegen/erhöhen)
      INSERT INTO container_batch_positions (container_id, batch_id, quantity)
      VALUES (_container_id, v_container.batch_id, v_delta)
      ON CONFLICT (container_id, batch_id)
      DO UPDATE SET quantity = container_batch_positions.quantity + EXCLUDED.quantity, updated_at = now();
    ELSE
      -- Kein Standard-LOT → nur Gesamt-Bestand hochzählen (Legacy)
      UPDATE raw_material_containers
         SET current_quantity = v_qty_after,
             status = CASE WHEN v_qty_after>0 AND status='leer'::container_status THEN 'verfuegbar'::container_status ELSE status END,
             updated_at = now()
       WHERE id = _container_id;
    END IF;

  ELSIF _movement_type = 'inventur' THEN
    IF v_has_positions AND v_pos_sum > 0 THEN
      v_ratio := v_qty_after / v_pos_sum;
      -- Positionen proportional skalieren
      UPDATE container_batch_positions
         SET quantity = ROUND(quantity * v_ratio, 6),
             updated_at = now()
       WHERE container_id = _container_id;
    ELSE
      UPDATE raw_material_containers
         SET current_quantity = v_qty_after,
             status = CASE
               WHEN v_qty_after<=0 AND status NOT IN ('entsorgt','gesperrt') THEN 'leer'::container_status
               WHEN v_qty_after>0 AND status='leer'::container_status THEN 'verfuegbar'::container_status
               ELSE status END,
             updated_at = now()
       WHERE id = _container_id;
    END IF;
  END IF;

  -- Audit
  INSERT INTO container_audit_log(container_id, action, field_name, old_value, new_value, comment, changed_by)
  VALUES (_container_id, 'movement', _movement_type::text, v_qty_before::text, v_qty_after::text, _comment, v_actor);

  RETURN v_movement_id;
END $$;
