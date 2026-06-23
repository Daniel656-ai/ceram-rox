-- 1) Traceability + Eindeutigkeit
ALTER TABLE public.project_knetung_materials
  ADD COLUMN IF NOT EXISTS source_inventory_movement_id uuid REFERENCES public.inventory_movements(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS project_knetung_materials_source_inv_uidx
  ON public.project_knetung_materials(source_inventory_movement_id)
  WHERE source_inventory_movement_id IS NOT NULL;

-- 2) RPC für künftige Buchungen erweitern: Quelle mitschreiben
CREATE OR REPLACE FUNCTION public.book_container_consumption(
  _container_id uuid,
  _quantity numeric,
  _movement_date date DEFAULT CURRENT_DATE,
  _project_reference text DEFAULT NULL,
  _comment text DEFAULT NULL,
  _project_id uuid DEFAULT NULL,
  _order_measurement_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_container raw_material_containers%ROWTYPE;
  v_new_qty numeric;
  v_inv_id uuid;
  v_project_number text;
  v_ref text;
  v_price numeric;
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

  SELECT * INTO v_container FROM raw_material_containers WHERE id = _container_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gebinde nicht gefunden'; END IF;
  IF v_container.current_quantity <= 0 THEN
    RAISE EXCEPTION 'Bestand des Gebindes % ist 0 – kein Verbrauch möglich', v_container.container_code;
  END IF;
  v_new_qty := v_container.current_quantity - _quantity;
  IF v_new_qty < 0 THEN
    RAISE EXCEPTION 'Verbrauchsmenge (% %) überschreitet den verfügbaren Bestand (% %) des Gebindes %',
      _quantity, v_container.unit, v_container.current_quantity, v_container.unit, v_container.container_code;
  END IF;

  IF _project_id IS NOT NULL THEN
    SELECT project_number INTO v_project_number FROM projects WHERE id = _project_id;
    IF v_project_number IS NULL THEN RAISE EXCEPTION 'Projekt nicht gefunden'; END IF;
  END IF;
  v_ref := COALESCE(_project_reference, v_project_number);

  INSERT INTO inventory_movements (raw_material_id, batch_id, movement_type, quantity, movement_date, project_reference, comment, created_by)
  VALUES (v_container.raw_material_id, v_container.batch_id, 'verbrauch', _quantity,
          COALESCE(_movement_date, CURRENT_DATE), v_ref,
          COALESCE(_comment, 'Verbrauch Gebinde ' || v_container.container_code), v_actor)
  RETURNING id INTO v_inv_id;

  INSERT INTO container_movements (container_id, movement_type, quantity, quantity_before, quantity_after, inventory_movement_id, reference, comment, created_by)
  VALUES (_container_id, 'verbrauch', _quantity, v_container.current_quantity, v_new_qty, v_inv_id, v_ref, _comment, v_actor);

  UPDATE raw_material_containers
     SET current_quantity = v_new_qty,
         status = CASE WHEN v_new_qty = 0 THEN 'leer'::container_status ELSE status END
   WHERE id = _container_id;

  IF _project_id IS NOT NULL THEN
    SELECT COALESCE(price_per_kg, 0) INTO v_price FROM raw_materials WHERE id = v_container.raw_material_id;
    INSERT INTO project_knetung_materials (project_id, raw_material_id, order_measurement_id, quantity_kg, price_per_kg, comment, created_by, source_inventory_movement_id)
    VALUES (_project_id, v_container.raw_material_id, _order_measurement_id, _quantity, COALESCE(v_price, 0),
            COALESCE(_comment, 'Automatisch aus Lagerverbrauch Gebinde ' || v_container.container_code), v_actor, v_inv_id)
    ON CONFLICT (source_inventory_movement_id) DO NOTHING;
  END IF;

  RETURN v_inv_id;
END $function$;

-- 3) Einmaliges Backfill
INSERT INTO public.project_knetung_materials
  (project_id, raw_material_id, quantity_kg, price_per_kg, comment, created_by, source_inventory_movement_id, created_at)
SELECT
  p.id,
  im.raw_material_id,
  im.quantity,
  COALESCE(rm.price_per_kg, 0),
  COALESCE('Backfill aus Lagerverbrauch ' || to_char(im.movement_date, 'YYYY-MM-DD') ||
           CASE WHEN im.comment IS NOT NULL THEN ' · ' || im.comment ELSE '' END,
           'Backfill aus Lagerverbrauch'),
  im.created_by,
  im.id,
  im.created_at
FROM public.inventory_movements im
JOIN public.raw_materials rm ON rm.id = im.raw_material_id
JOIN public.projects p
  ON p.project_number = split_part(COALESCE(im.project_reference, ''), ' / ', 1)
WHERE im.movement_type = 'verbrauch'
  AND im.project_reference IS NOT NULL
  AND length(trim(im.project_reference)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.project_knetung_materials pkm
    WHERE pkm.source_inventory_movement_id = im.id
  );