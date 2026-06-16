-- =============================================
-- PHASE 2: Gebinde-Bewegungen, Lagerort-Historie & Audit-Trail
-- =============================================

-- 1) Enum für Bewegungstypen pro Gebinde
DO $$ BEGIN
  CREATE TYPE public.container_movement_type AS ENUM (
    'eingang',
    'umlagerung',
    'verbrauch',
    'korrektur_plus',
    'korrektur_minus',
    'inventur',
    'entsorgung',
    'reservierung',
    'freigabe_reservierung'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Tabelle: Gebinde-Bewegungen
CREATE TABLE IF NOT EXISTS public.container_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid NOT NULL REFERENCES public.raw_material_containers(id) ON DELETE CASCADE,
  movement_type public.container_movement_type NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  quantity_before numeric,
  quantity_after numeric,
  from_location_id uuid REFERENCES public.storage_locations(id) ON DELETE SET NULL,
  to_location_id uuid REFERENCES public.storage_locations(id) ON DELETE SET NULL,
  inventory_movement_id uuid REFERENCES public.inventory_movements(id) ON DELETE SET NULL,
  reference text,
  comment text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_container_movements_container ON public.container_movements(container_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_container_movements_type ON public.container_movements(movement_type);

GRANT SELECT, INSERT ON public.container_movements TO authenticated;
GRANT ALL ON public.container_movements TO service_role;
ALTER TABLE public.container_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "container_movements_read_auth" ON public.container_movements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "container_movements_insert_manage" ON public.container_movements
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'));

-- 3) Tabelle: Lagerort-Historie
CREATE TABLE IF NOT EXISTS public.container_location_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid NOT NULL REFERENCES public.raw_material_containers(id) ON DELETE CASCADE,
  from_location_id uuid REFERENCES public.storage_locations(id) ON DELETE SET NULL,
  to_location_id uuid REFERENCES public.storage_locations(id) ON DELETE SET NULL,
  from_location_note text,
  to_location_note text,
  movement_id uuid REFERENCES public.container_movements(id) ON DELETE SET NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  comment text
);

CREATE INDEX IF NOT EXISTS idx_container_loc_history_container ON public.container_location_history(container_id, changed_at DESC);

GRANT SELECT, INSERT ON public.container_location_history TO authenticated;
GRANT ALL ON public.container_location_history TO service_role;
ALTER TABLE public.container_location_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "container_loc_history_read_auth" ON public.container_location_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "container_loc_history_insert_manage" ON public.container_location_history
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'));

-- 4) Tabelle: Audit-Trail für Gebinde-Änderungen
CREATE TABLE IF NOT EXISTS public.container_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid NOT NULL REFERENCES public.raw_material_containers(id) ON DELETE CASCADE,
  action text NOT NULL, -- 'created', 'updated', 'deleted', 'movement', 'inventory'
  field_name text,
  old_value text,
  new_value text,
  comment text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_container_audit_container ON public.container_audit_log(container_id, changed_at DESC);

GRANT SELECT, INSERT ON public.container_audit_log TO authenticated;
GRANT ALL ON public.container_audit_log TO service_role;
ALTER TABLE public.container_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "container_audit_read_auth" ON public.container_audit_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "container_audit_insert_manage" ON public.container_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'));

-- 5) Trigger: automatischer Audit-Trail bei UPDATE/INSERT/DELETE auf Containers
CREATE OR REPLACE FUNCTION public.log_container_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor uuid := COALESCE(auth.uid(), NEW.created_by);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO container_audit_log(container_id, action, comment, changed_by)
    VALUES (NEW.id, 'created', 'Gebinde angelegt: '||NEW.container_code, v_actor);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.current_quantity IS DISTINCT FROM NEW.current_quantity THEN
      INSERT INTO container_audit_log(container_id, action, field_name, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'current_quantity', OLD.current_quantity::text, NEW.current_quantity::text, v_actor);
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO container_audit_log(container_id, action, field_name, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'status', OLD.status::text, NEW.status::text, v_actor);
    END IF;
    IF OLD.location_id IS DISTINCT FROM NEW.location_id THEN
      INSERT INTO container_audit_log(container_id, action, field_name, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'location_id', OLD.location_id::text, NEW.location_id::text, v_actor);
      INSERT INTO container_location_history(container_id, from_location_id, to_location_id, from_location_note, to_location_note, changed_by)
      VALUES (NEW.id, OLD.location_id, NEW.location_id, OLD.location_note, NEW.location_note, v_actor);
    END IF;
    IF OLD.location_note IS DISTINCT FROM NEW.location_note AND OLD.location_id IS NOT DISTINCT FROM NEW.location_id THEN
      INSERT INTO container_audit_log(container_id, action, field_name, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'location_note', OLD.location_note, NEW.location_note, v_actor);
    END IF;
    IF OLD.barcode IS DISTINCT FROM NEW.barcode THEN
      INSERT INTO container_audit_log(container_id, action, field_name, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'barcode', OLD.barcode, NEW.barcode, v_actor);
    END IF;
    IF OLD.reserved_quantity IS DISTINCT FROM NEW.reserved_quantity THEN
      INSERT INTO container_audit_log(container_id, action, field_name, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'reserved_quantity', OLD.reserved_quantity::text, NEW.reserved_quantity::text, v_actor);
    END IF;
    IF OLD.notes IS DISTINCT FROM NEW.notes THEN
      INSERT INTO container_audit_log(container_id, action, field_name, old_value, new_value, changed_by)
      VALUES (NEW.id, 'updated', 'notes', OLD.notes, NEW.notes, v_actor);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO container_audit_log(container_id, action, comment, changed_by)
    VALUES (OLD.id, 'deleted', 'Gebinde gelöscht: '||OLD.container_code, COALESCE(auth.uid(), OLD.created_by));
    RETURN OLD;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_container_changes ON public.raw_material_containers;
CREATE TRIGGER trg_log_container_changes
AFTER INSERT OR UPDATE OR DELETE ON public.raw_material_containers
FOR EACH ROW EXECUTE FUNCTION public.log_container_changes();

-- 6) RPC: Bewegung registrieren (atomar: Bewegung + Bestand + Lagerort + Audit)
CREATE OR REPLACE FUNCTION public.record_container_movement(
  _container_id uuid,
  _movement_type public.container_movement_type,
  _quantity numeric DEFAULT NULL,
  _new_quantity numeric DEFAULT NULL,
  _to_location_id uuid DEFAULT NULL,
  _to_location_note text DEFAULT NULL,
  _reference text DEFAULT NULL,
  _comment text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_container raw_material_containers%ROWTYPE;
  v_qty_before numeric;
  v_qty_after numeric;
  v_delta numeric := COALESCE(_quantity, 0);
  v_movement_id uuid;
  v_from_loc uuid;
  v_inv_type text;
  v_inv_id uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentifizierung erforderlich'; END IF;
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung für Gebinde-Bewegungen';
  END IF;

  SELECT * INTO v_container FROM raw_material_containers WHERE id = _container_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gebinde nicht gefunden'; END IF;

  v_qty_before := v_container.current_quantity;
  v_from_loc := v_container.location_id;

  -- Mengenlogik
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

  IF v_qty_after < 0 THEN RAISE EXCEPTION 'Bestand würde negativ werden (% -> %)', v_qty_before, v_qty_after; END IF;

  -- Spiegel-Buchung in inventory_movements für Eingang/Verbrauch (mengenverändernd)
  IF _movement_type IN ('eingang','verbrauch') THEN
    v_inv_type := _movement_type::text;
    INSERT INTO inventory_movements (raw_material_id, batch_id, movement_type, quantity, comment, created_by)
    VALUES (v_container.raw_material_id, v_container.batch_id, v_inv_type, ABS(v_qty_after - v_qty_before),
            COALESCE(_comment, 'Gebinde '||v_container.container_code), v_actor)
    RETURNING id INTO v_inv_id;
  END IF;

  -- Bewegung speichern
  INSERT INTO container_movements (container_id, movement_type, quantity, quantity_before, quantity_after,
    from_location_id, to_location_id, inventory_movement_id, reference, comment, created_by)
  VALUES (_container_id, _movement_type, COALESCE(_quantity, ABS(v_qty_after - v_qty_before)),
    v_qty_before, v_qty_after, v_from_loc,
    CASE WHEN _movement_type = 'umlagerung' THEN _to_location_id ELSE NULL END,
    v_inv_id, _reference, _comment, v_actor)
  RETURNING id INTO v_movement_id;

  -- Container aktualisieren
  IF _movement_type = 'umlagerung' THEN
    UPDATE raw_material_containers
       SET location_id = _to_location_id,
           location_note = COALESCE(_to_location_note, location_note),
           updated_at = now()
     WHERE id = _container_id;
  ELSIF _movement_type = 'entsorgung' THEN
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
  ELSE
    UPDATE raw_material_containers
       SET current_quantity = v_qty_after,
           status = CASE WHEN v_qty_after <= 0 AND status NOT IN ('entsorgt','gesperrt') THEN 'leer'::container_status ELSE status END,
           updated_at = now()
     WHERE id = _container_id;
  END IF;

  -- Audit-Trail
  INSERT INTO container_audit_log(container_id, action, field_name, old_value, new_value, comment, changed_by)
  VALUES (_container_id, 'movement', _movement_type::text, v_qty_before::text, v_qty_after::text, _comment, v_actor);

  RETURN v_movement_id;
END $$;

GRANT EXECUTE ON FUNCTION public.record_container_movement(uuid, public.container_movement_type, numeric, numeric, uuid, text, text, text) TO authenticated;