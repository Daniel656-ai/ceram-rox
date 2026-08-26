-- 1. Erweiterung der Lot-Positionen
ALTER TABLE public.container_batch_positions
  ADD COLUMN IF NOT EXISTS initial_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS added_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS position_no integer,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aktiv';

ALTER TABLE public.container_batch_positions
  DROP CONSTRAINT IF EXISTS container_batch_positions_quantity_nonneg;
ALTER TABLE public.container_batch_positions
  ADD CONSTRAINT container_batch_positions_quantity_nonneg CHECK (quantity >= 0);

ALTER TABLE public.container_batch_positions
  DROP CONSTRAINT IF EXISTS container_batch_positions_status_check;
ALTER TABLE public.container_batch_positions
  ADD CONSTRAINT container_batch_positions_status_check CHECK (status IN ('aktiv','aufgebraucht'));

-- Backfill bestehender Positionen (Mengen bleiben unverändert)
UPDATE public.container_batch_positions p
   SET initial_quantity = GREATEST(p.quantity, p.initial_quantity),
       added_at = p.created_at
 WHERE p.initial_quantity = 0;

UPDATE public.container_batch_positions p
   SET position_no = s.rn
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY container_id ORDER BY created_at, id) rn
      FROM public.container_batch_positions
  ) s
 WHERE s.id = p.id AND p.position_no IS NULL;

UPDATE public.container_batch_positions
   SET status = CASE WHEN quantity > 0 THEN 'aktiv' ELSE 'aufgebraucht' END;

-- 2. Alt-Gebinde ohne Position, aber mit Lot: als erste Lot-Position übernehmen
INSERT INTO public.container_batch_positions (container_id, batch_id, quantity, initial_quantity, added_at, position_no, status)
SELECT c.id, c.batch_id, GREATEST(COALESCE(c.current_quantity,0),0),
       GREATEST(COALESCE(c.initial_quantity, c.current_quantity, 0),0),
       c.created_at, 1,
       CASE WHEN COALESCE(c.current_quantity,0) > 0 THEN 'aktiv' ELSE 'aufgebraucht' END
  FROM public.raw_material_containers c
 WHERE c.batch_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.container_batch_positions p WHERE p.container_id = c.id)
ON CONFLICT (container_id, batch_id) DO NOTHING;

-- 3. Status automatisch pflegen
CREATE OR REPLACE FUNCTION public.cbp_set_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.position_no IS NULL THEN
    SELECT COALESCE(MAX(position_no),0) + 1 INTO NEW.position_no
      FROM public.container_batch_positions WHERE container_id = NEW.container_id;
  END IF;
  NEW.status := CASE WHEN NEW.quantity > 0 THEN 'aktiv' ELSE 'aufgebraucht' END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cbp_status ON public.container_batch_positions;
CREATE TRIGGER trg_cbp_status
BEFORE INSERT OR UPDATE ON public.container_batch_positions
FOR EACH ROW EXECUTE FUNCTION public.cbp_set_status();

-- 4. Lot-Positionen lesen (inkl. aufgebrauchter Lots für die Historie)
DROP FUNCTION IF EXISTS public.get_container_positions(uuid);
CREATE OR REPLACE FUNCTION public.get_container_positions(_container_id uuid, _include_depleted boolean DEFAULT true)
RETURNS TABLE(
  position_id uuid,
  batch_id uuid,
  batch_number text,
  manufacturer_batch text,
  delivery_date date,
  quantity numeric,
  initial_quantity numeric,
  added_at timestamptz,
  position_no integer,
  status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.batch_id, b.batch_number, b.manufacturer_batch, b.delivery_date,
         p.quantity, p.initial_quantity, p.added_at, p.position_no, p.status, p.created_at
    FROM public.container_batch_positions p
    JOIN public.raw_material_batches b ON b.id = p.batch_id
   WHERE p.container_id = _container_id
     AND (_include_depleted OR p.quantity > 0)
   ORDER BY p.added_at ASC, p.position_no ASC, p.created_at ASC;
$$;

-- 5. Neues Lot in bestehendes Gebinde: Zugangsdatum + Zugangsmenge festhalten
CREATE OR REPLACE FUNCTION public.add_batch_to_container(_container_id uuid, _batch_id uuid, _quantity numeric, _movement_date date DEFAULT CURRENT_DATE, _comment text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'Zugangsmenge muss > 0 sein'; END IF;

  SELECT * INTO v_container FROM raw_material_containers WHERE id=_container_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gebinde nicht gefunden'; END IF;

  SELECT * INTO v_batch FROM raw_material_batches WHERE id=_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'LOT nicht gefunden'; END IF;

  IF v_batch.raw_material_id <> v_container.raw_material_id THEN
    RAISE EXCEPTION 'LOT gehört zu einem anderen Rohstoff – Zusammenführung nicht erlaubt';
  END IF;

  v_before := v_container.current_quantity;

  INSERT INTO container_batch_positions (container_id, batch_id, quantity, initial_quantity, added_at)
  VALUES (_container_id, _batch_id, _quantity, _quantity,
          COALESCE(_movement_date::timestamptz, now()))
  ON CONFLICT (container_id, batch_id)
  DO UPDATE SET quantity = container_batch_positions.quantity + EXCLUDED.quantity,
                initial_quantity = container_batch_positions.initial_quantity + EXCLUDED.quantity,
                updated_at = now();

  IF v_container.batch_id IS NULL THEN
    UPDATE raw_material_containers SET batch_id = _batch_id WHERE id = _container_id;
  END IF;

  v_after := v_before + _quantity;

  INSERT INTO inventory_movements (raw_material_id, batch_id, movement_type, quantity, movement_date, comment, created_by)
  VALUES (v_container.raw_material_id, _batch_id, 'eingang', _quantity, COALESCE(_movement_date, CURRENT_DATE),
          COALESCE(_comment, 'Wareneingang LOT '||v_batch.batch_number||' in Gebinde '||v_container.container_code), v_actor)
  RETURNING id INTO v_inv_id;

  INSERT INTO container_movements (container_id, movement_type, quantity, quantity_before, quantity_after,
    inventory_movement_id, reference, comment, created_by)
  VALUES (_container_id, 'eingang'::container_movement_type, _quantity, v_before, v_after,
    v_inv_id, 'LOT '||v_batch.batch_number,
    COALESCE(_comment, 'LOT '||v_batch.batch_number||' hinzugefügt'), v_actor)
  RETURNING id INTO v_mov_id;

  RETURN v_mov_id;
END $function$;

-- 6. FIFO nach tatsächlichem Zugang zum Gebinde
CREATE OR REPLACE FUNCTION public.book_container_consumption(_container_id uuid, _quantity numeric, _movement_date date DEFAULT CURRENT_DATE, _project_reference text DEFAULT NULL::text, _comment text DEFAULT NULL::text, _project_id uuid DEFAULT NULL::uuid, _order_measurement_id uuid DEFAULT NULL::uuid, _allocations jsonb DEFAULT NULL::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  INSERT INTO container_movements (container_id, movement_type, quantity, quantity_before, quantity_after, reference, comment, created_by)
  VALUES (_container_id, 'verbrauch'::container_movement_type, _quantity, v_before, v_after,
    v_ref, COALESCE(_comment, 'Verbrauch Gebinde '||v_container.container_code), v_actor)
  RETURNING id INTO v_mov_id;

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
        IF a_pos_qty <= 0 THEN RAISE EXCEPTION 'LOT ist aufgebraucht und kann nicht entnommen werden'; END IF;
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
    v_remaining := _quantity;
    FOR v_pos IN
      SELECT p.id, p.batch_id, p.quantity, b.batch_number
        FROM container_batch_positions p
        JOIN raw_material_batches b ON b.id = p.batch_id
       WHERE p.container_id = _container_id AND p.quantity > 0
       ORDER BY p.added_at ASC, p.position_no ASC, p.created_at ASC
       FOR UPDATE OF p
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
      UPDATE raw_material_containers
         SET current_quantity = v_after,
             status = CASE WHEN v_after<=0 THEN 'leer'::container_status ELSE status END
       WHERE id = _container_id;
    END IF;
  END IF;

  UPDATE container_movements SET inventory_movement_id = v_inv_id WHERE id = v_mov_id;

  RETURN v_mov_id;
END $function$;