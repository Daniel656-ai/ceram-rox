
-- 1) Positions table
CREATE TABLE IF NOT EXISTS public.container_batch_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid NOT NULL REFERENCES public.raw_material_containers(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.raw_material_batches(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (container_id, batch_id)
);

CREATE INDEX IF NOT EXISTS idx_cbp_container ON public.container_batch_positions(container_id);
CREATE INDEX IF NOT EXISTS idx_cbp_batch ON public.container_batch_positions(batch_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.container_batch_positions TO authenticated;
GRANT ALL ON public.container_batch_positions TO service_role;

ALTER TABLE public.container_batch_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cbp_read_auth" ON public.container_batch_positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "cbp_write_manage" ON public.container_batch_positions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.batches.manage') OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.batches.manage') OR has_permission(auth.uid(),'raw_materials.manage'));

CREATE TRIGGER trg_cbp_updated_at BEFORE UPDATE ON public.container_batch_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Seed positions from existing containers
INSERT INTO public.container_batch_positions (container_id, batch_id, quantity)
SELECT c.id, c.batch_id, c.current_quantity
FROM public.raw_material_containers c
WHERE c.batch_id IS NOT NULL
  AND c.current_quantity > 0
ON CONFLICT (container_id, batch_id) DO NOTHING;

-- 3) Trigger to keep container.current_quantity in sync with sum of positions.
--    Only recomputes when at least one position exists for the container.
CREATE OR REPLACE FUNCTION public.sync_container_quantity_from_positions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_container uuid;
  v_sum numeric;
  v_has_positions boolean;
BEGIN
  v_container := COALESCE(NEW.container_id, OLD.container_id);
  SELECT COALESCE(SUM(quantity),0), COUNT(*)>0
    INTO v_sum, v_has_positions
    FROM public.container_batch_positions
   WHERE container_id = v_container;

  IF v_has_positions THEN
    UPDATE public.raw_material_containers
       SET current_quantity = v_sum,
           status = CASE
             WHEN v_sum <= 0 AND status NOT IN ('entsorgt','gesperrt') THEN 'leer'::container_status
             WHEN v_sum > 0 AND status = 'leer'::container_status THEN 'verfuegbar'::container_status
             ELSE status
           END,
           updated_at = now()
     WHERE id = v_container;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_cbp_sync ON public.container_batch_positions;
CREATE TRIGGER trg_cbp_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.container_batch_positions
  FOR EACH ROW EXECUTE FUNCTION public.sync_container_quantity_from_positions();

-- 4) Helper view/function to list positions with batch info
CREATE OR REPLACE FUNCTION public.get_container_positions(_container_id uuid)
RETURNS TABLE(
  position_id uuid,
  batch_id uuid,
  batch_number text,
  manufacturer_batch text,
  delivery_date date,
  quantity numeric,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT p.id, p.batch_id, b.batch_number, b.manufacturer_batch, b.delivery_date, p.quantity, p.created_at
    FROM public.container_batch_positions p
    JOIN public.raw_material_batches b ON b.id = p.batch_id
   WHERE p.container_id = _container_id
   ORDER BY b.delivery_date NULLS LAST, p.created_at ASC;
$$;

-- 5) Add batch (LOT) to an existing container
CREATE OR REPLACE FUNCTION public.add_batch_to_container(
  _container_id uuid,
  _batch_id uuid,
  _quantity numeric,
  _movement_date date DEFAULT CURRENT_DATE,
  _comment text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_container raw_material_containers%ROWTYPE;
  v_batch raw_material_batches%ROWTYPE;
  v_before numeric;
  v_after numeric;
  v_inv_id uuid;
  v_mov_id uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentifizierung erforderlich'; END IF;
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'raw_materials.batches.manage') OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'Menge muss > 0 sein'; END IF;

  SELECT * INTO v_container FROM raw_material_containers WHERE id=_container_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gebinde nicht gefunden'; END IF;

  SELECT * INTO v_batch FROM raw_material_batches WHERE id=_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'LOT nicht gefunden'; END IF;

  IF v_batch.raw_material_id <> v_container.raw_material_id THEN
    RAISE EXCEPTION 'LOT gehört zu einem anderen Rohstoff – Zusammenführung nicht erlaubt';
  END IF;

  v_before := v_container.current_quantity;

  -- Upsert position
  INSERT INTO container_batch_positions (container_id, batch_id, quantity)
  VALUES (_container_id, _batch_id, _quantity)
  ON CONFLICT (container_id, batch_id)
  DO UPDATE SET quantity = container_batch_positions.quantity + EXCLUDED.quantity, updated_at = now();

  -- Set primary batch_id on container if empty (for backward compat with legacy displays)
  IF v_container.batch_id IS NULL THEN
    UPDATE raw_material_containers SET batch_id = _batch_id WHERE id = _container_id;
  END IF;

  v_after := v_before + _quantity;

  -- Inventory movement (per LOT)
  INSERT INTO inventory_movements (raw_material_id, batch_id, movement_type, quantity, movement_date, comment, created_by)
  VALUES (v_container.raw_material_id, _batch_id, 'eingang', _quantity, COALESCE(_movement_date, CURRENT_DATE),
          COALESCE(_comment, 'Wareneingang LOT '||v_batch.batch_number||' in Gebinde '||v_container.container_code), v_actor)
  RETURNING id INTO v_inv_id;

  -- Container movement (aggregate)
  INSERT INTO container_movements (container_id, movement_type, quantity, quantity_before, quantity_after,
    inventory_movement_id, reference, comment, created_by)
  VALUES (_container_id, 'eingang'::container_movement_type, _quantity, v_before, v_after,
    v_inv_id, 'LOT '||v_batch.batch_number,
    COALESCE(_comment, 'LOT '||v_batch.batch_number||' hinzugefügt'), v_actor)
  RETURNING id INTO v_mov_id;

  RETURN v_mov_id;
END $$;

-- 6) Replace book_container_consumption with FIFO across positions
CREATE OR REPLACE FUNCTION public.book_container_consumption(
  _container_id uuid,
  _quantity numeric,
  _movement_date date DEFAULT CURRENT_DATE,
  _project_reference text DEFAULT NULL,
  _comment text DEFAULT NULL,
  _project_id uuid DEFAULT NULL,
  _order_measurement_id uuid DEFAULT NULL,
  _allocations jsonb DEFAULT NULL  -- optional manual override: [{"batch_id":"..","quantity":..}]
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_container raw_material_containers%ROWTYPE;
  v_before numeric;
  v_after numeric;
  v_remaining numeric;
  v_take numeric;
  v_inv_id uuid;
  v_mov_id uuid;
  v_project_number text;
  v_ref text;
  v_price numeric;
  v_pos record;
  v_alloc jsonb;
  v_alloc_sum numeric := 0;
  v_batch record;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentifizierung erforderlich'; END IF;
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung für Lagerbuchungen';
  END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'Verbrauchsmenge muss > 0 sein'; END IF;

  SELECT * INTO v_container FROM raw_material_containers WHERE id=_container_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gebinde nicht gefunden'; END IF;

  v_before := v_container.current_quantity;
  IF v_before < _quantity THEN
    RAISE EXCEPTION 'Verbrauchsmenge (%) überschreitet Bestand (%) des Gebindes %', _quantity, v_before, v_container.container_code;
  END IF;

  IF _project_id IS NOT NULL THEN
    SELECT project_number INTO v_project_number FROM projects WHERE id=_project_id;
    IF v_project_number IS NULL THEN RAISE EXCEPTION 'Projekt nicht gefunden'; END IF;
  END IF;
  v_ref := COALESCE(_project_reference, v_project_number);
  SELECT COALESCE(price_per_kg,0) INTO v_price FROM raw_materials WHERE id=v_container.raw_material_id;
  v_after := v_before - _quantity;

  -- Aggregate container_movement first (for FK reference)
  INSERT INTO container_movements (container_id, movement_type, quantity, quantity_before, quantity_after, reference, comment, created_by)
  VALUES (_container_id, 'verbrauch'::container_movement_type, _quantity, v_before, v_after,
    v_ref, COALESCE(_comment, 'Verbrauch Gebinde '||v_container.container_code), v_actor)
  RETURNING id INTO v_mov_id;

  -- Validate manual allocations if provided
  IF _allocations IS NOT NULL AND jsonb_array_length(_allocations) > 0 THEN
    SELECT COALESCE(SUM((elem->>'quantity')::numeric),0) INTO v_alloc_sum
      FROM jsonb_array_elements(_allocations) elem;
    IF ROUND(v_alloc_sum::numeric, 6) <> ROUND(_quantity::numeric, 6) THEN
      RAISE EXCEPTION 'Manuelle Aufteilung (%) entspricht nicht der Verbrauchsmenge (%)', v_alloc_sum, _quantity;
    END IF;

    FOR v_alloc IN SELECT * FROM jsonb_array_elements(_allocations) LOOP
      DECLARE
        a_batch uuid := (v_alloc->>'batch_id')::uuid;
        a_qty numeric := (v_alloc->>'quantity')::numeric;
        a_pos_qty numeric;
      BEGIN
        IF a_qty <= 0 THEN CONTINUE; END IF;
        SELECT quantity INTO a_pos_qty FROM container_batch_positions
         WHERE container_id=_container_id AND batch_id=a_batch FOR UPDATE;
        IF a_pos_qty IS NULL THEN RAISE EXCEPTION 'LOT nicht im Gebinde vorhanden'; END IF;
        IF a_pos_qty < a_qty THEN RAISE EXCEPTION 'LOT-Bestand (%) reicht für Zuteilung (%) nicht', a_pos_qty, a_qty; END IF;

        UPDATE container_batch_positions SET quantity = quantity - a_qty
         WHERE container_id=_container_id AND batch_id=a_batch;

        SELECT * INTO v_batch FROM raw_material_batches WHERE id=a_batch;
        INSERT INTO inventory_movements (raw_material_id, batch_id, movement_type, quantity, movement_date, project_reference, comment, created_by)
        VALUES (v_container.raw_material_id, a_batch, 'verbrauch', a_qty, COALESCE(_movement_date,CURRENT_DATE), v_ref,
          COALESCE(_comment,'Verbrauch Gebinde '||v_container.container_code)||' – LOT '||v_batch.batch_number, v_actor)
        RETURNING id INTO v_inv_id;

        IF _project_id IS NOT NULL THEN
          INSERT INTO project_knetung_materials (project_id, raw_material_id, order_measurement_id, quantity_kg, price_per_kg, comment, created_by, source_inventory_movement_id)
          VALUES (_project_id, v_container.raw_material_id, _order_measurement_id, a_qty, COALESCE(v_price,0),
            COALESCE(_comment,'Automatisch aus Lagerverbrauch Gebinde '||v_container.container_code)||' – LOT '||v_batch.batch_number, v_actor, v_inv_id);
        END IF;
      END;
    END LOOP;
  ELSE
    -- FIFO across positions (oldest delivery first)
    v_remaining := _quantity;
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

      INSERT INTO inventory_movements (raw_material_id, batch_id, movement_type, quantity, movement_date, project_reference, comment, created_by)
      VALUES (v_container.raw_material_id, v_pos.batch_id, 'verbrauch', v_take, COALESCE(_movement_date,CURRENT_DATE), v_ref,
        COALESCE(_comment,'Verbrauch Gebinde '||v_container.container_code)||' – LOT '||v_pos.batch_number||' (FIFO)', v_actor)
      RETURNING id INTO v_inv_id;

      IF _project_id IS NOT NULL THEN
        INSERT INTO project_knetung_materials (project_id, raw_material_id, order_measurement_id, quantity_kg, price_per_kg, comment, created_by, source_inventory_movement_id)
        VALUES (_project_id, v_container.raw_material_id, _order_measurement_id, v_take, COALESCE(v_price,0),
          COALESCE(_comment,'Automatisch aus Lagerverbrauch Gebinde '||v_container.container_code)||' – LOT '||v_pos.batch_number||' (FIFO)', v_actor, v_inv_id);
      END IF;

      v_remaining := v_remaining - v_take;
    END LOOP;

    -- Legacy container without positions: fall back to old single-batch behavior
    IF v_remaining > 0 THEN
      IF v_container.batch_id IS NOT NULL THEN
        INSERT INTO inventory_movements (raw_material_id, batch_id, movement_type, quantity, movement_date, project_reference, comment, created_by)
        VALUES (v_container.raw_material_id, v_container.batch_id, 'verbrauch', v_remaining, COALESCE(_movement_date,CURRENT_DATE), v_ref,
          COALESCE(_comment,'Verbrauch Gebinde '||v_container.container_code), v_actor)
        RETURNING id INTO v_inv_id;
        IF _project_id IS NOT NULL THEN
          INSERT INTO project_knetung_materials (project_id, raw_material_id, order_measurement_id, quantity_kg, price_per_kg, comment, created_by, source_inventory_movement_id)
          VALUES (_project_id, v_container.raw_material_id, _order_measurement_id, v_remaining, COALESCE(v_price,0),
            COALESCE(_comment,'Automatisch aus Lagerverbrauch Gebinde '||v_container.container_code), v_actor, v_inv_id);
        END IF;
      END IF;
      -- Manually adjust container qty since no positions exist
      UPDATE raw_material_containers
         SET current_quantity = v_after,
             status = CASE WHEN v_after<=0 THEN 'leer'::container_status ELSE status END
       WHERE id = _container_id;
    END IF;
  END IF;

  -- Attach one inventory_movement id to aggregate row (last one for reference)
  UPDATE container_movements SET inventory_movement_id = v_inv_id WHERE id = v_mov_id;

  RETURN v_mov_id;
END $$;
