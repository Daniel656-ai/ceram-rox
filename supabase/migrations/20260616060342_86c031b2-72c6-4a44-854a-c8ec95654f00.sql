
-- Renamed enums to avoid collision with existing mixture_batch_status
DO $$ BEGIN
  CREATE TYPE public.mixture_exec_status AS ENUM ('geplant','laufend','abgeschlossen','abgebrochen','freigegeben');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mixture_deviation_kind AS ENUM ('time','quantity','additional_raw','process');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. RECIPE VERSIONS
CREATE TABLE IF NOT EXISTS public.mixture_recipe_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mixture_id uuid NOT NULL REFERENCES public.mixtures(id) ON DELETE CASCADE,
  version_no integer NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mixture_id, version_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mixture_recipe_versions TO authenticated;
GRANT ALL ON public.mixture_recipe_versions TO service_role;
ALTER TABLE public.mixture_recipe_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipe_versions_select" ON public.mixture_recipe_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "recipe_versions_manage" ON public.mixture_recipe_versions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'));
CREATE TRIGGER trg_recipe_versions_updated BEFORE UPDATE ON public.mixture_recipe_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.mixture_recipe_items
  ADD COLUMN IF NOT EXISTS recipe_version_id uuid REFERENCES public.mixture_recipe_versions(id) ON DELETE CASCADE;

-- 2. PROCESS SECTIONS
CREATE TABLE IF NOT EXISTS public.mixture_process_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_version_id uuid NOT NULL REFERENCES public.mixture_recipe_versions(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  description text,
  planned_duration_min integer,
  target_temperature numeric,
  target_unit text DEFAULT '°C',
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mixture_process_sections TO authenticated;
GRANT ALL ON public.mixture_process_sections TO service_role;
ALTER TABLE public.mixture_process_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sections_select" ON public.mixture_process_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "sections_manage" ON public.mixture_process_sections FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'));
CREATE TRIGGER trg_sections_updated BEFORE UPDATE ON public.mixture_process_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. PROCESS STEPS
CREATE TABLE IF NOT EXISTS public.mixture_process_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.mixture_process_sections(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  raw_material_id uuid REFERENCES public.raw_materials(id) ON DELETE SET NULL,
  instruction text,
  planned_quantity numeric,
  unit text,
  offset_minutes integer,
  window_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mixture_process_steps TO authenticated;
GRANT ALL ON public.mixture_process_steps TO service_role;
ALTER TABLE public.mixture_process_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "steps_select" ON public.mixture_process_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "steps_manage" ON public.mixture_process_steps FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'));
CREATE TRIGGER trg_steps_updated BEFORE UPDATE ON public.mixture_process_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. PLANNED MEASUREMENTS
CREATE TABLE IF NOT EXISTS public.mixture_planned_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.mixture_process_sections(id) ON DELETE CASCADE,
  parameter_name text NOT NULL,
  unit text,
  target_value numeric,
  tolerance numeric,
  offset_minutes integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mixture_planned_measurements TO authenticated;
GRANT ALL ON public.mixture_planned_measurements TO service_role;
ALTER TABLE public.mixture_planned_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planned_meas_select" ON public.mixture_planned_measurements FOR SELECT TO authenticated USING (true);
CREATE POLICY "planned_meas_manage" ON public.mixture_planned_measurements FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'));
CREATE TRIGGER trg_planned_meas_updated BEFORE UPDATE ON public.mixture_planned_measurements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. EXTEND mixture_batches
ALTER TABLE public.mixture_batches
  ADD COLUMN IF NOT EXISTS recipe_version_id uuid REFERENCES public.mixture_recipe_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS execution_status public.mixture_exec_status NOT NULL DEFAULT 'geplant',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_by uuid REFERENCES auth.users(id);

-- 6. WEIGHINGS
CREATE TABLE IF NOT EXISTS public.mixture_batch_weighings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.mixture_batches(id) ON DELETE CASCADE,
  step_id uuid REFERENCES public.mixture_process_steps(id) ON DELETE SET NULL,
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id),
  raw_material_batch_id uuid REFERENCES public.raw_material_batches(id),
  target_quantity numeric,
  actual_quantity numeric NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  deviation_abs numeric GENERATED ALWAYS AS (actual_quantity - COALESCE(target_quantity,actual_quantity)) STORED,
  deviation_pct numeric GENERATED ALWAYS AS (
    CASE WHEN target_quantity IS NULL OR target_quantity = 0 THEN NULL
    ELSE round(((actual_quantity - target_quantity) / target_quantity) * 100, 4) END
  ) STORED,
  weighed_at timestamptz NOT NULL DEFAULT now(),
  weighed_by uuid REFERENCES auth.users(id),
  inventory_movement_id uuid REFERENCES public.inventory_movements(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mixture_batch_weighings TO authenticated;
GRANT ALL ON public.mixture_batch_weighings TO service_role;
ALTER TABLE public.mixture_batch_weighings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weighings_select" ON public.mixture_batch_weighings FOR SELECT TO authenticated USING (true);
CREATE POLICY "weighings_manage" ON public.mixture_batch_weighings FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'));

-- 7. BATCH MEASUREMENTS
CREATE TABLE IF NOT EXISTS public.mixture_batch_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.mixture_batches(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.mixture_process_sections(id) ON DELETE SET NULL,
  planned_measurement_id uuid REFERENCES public.mixture_planned_measurements(id) ON DELETE SET NULL,
  parameter_name text NOT NULL,
  unit text,
  target_value numeric,
  actual_value numeric NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now(),
  measured_by uuid REFERENCES auth.users(id),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mixture_batch_measurements TO authenticated;
GRANT ALL ON public.mixture_batch_measurements TO service_role;
ALTER TABLE public.mixture_batch_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batch_meas_select" ON public.mixture_batch_measurements FOR SELECT TO authenticated USING (true);
CREATE POLICY "batch_meas_manage" ON public.mixture_batch_measurements FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'));

-- 8. DEVIATIONS
CREATE TABLE IF NOT EXISTS public.mixture_batch_deviations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.mixture_batches(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.mixture_process_sections(id) ON DELETE SET NULL,
  kind public.mixture_deviation_kind NOT NULL,
  old_value text,
  new_value text,
  reason text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mixture_batch_deviations TO authenticated;
GRANT ALL ON public.mixture_batch_deviations TO service_role;
ALTER TABLE public.mixture_batch_deviations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev_select" ON public.mixture_batch_deviations FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev_manage" ON public.mixture_batch_deviations FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'));

-- RPCs
CREATE OR REPLACE FUNCTION public.create_mixture_recipe_version(_mixture_id uuid, _copy_from uuid DEFAULT NULL, _notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); v_next int; v_new uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  SELECT COALESCE(MAX(version_no),0)+1 INTO v_next FROM mixture_recipe_versions WHERE mixture_id = _mixture_id;
  INSERT INTO mixture_recipe_versions(mixture_id, version_no, is_active, notes, created_by)
  VALUES (_mixture_id, v_next, v_next = 1, _notes, v_actor) RETURNING id INTO v_new;
  IF _copy_from IS NOT NULL THEN
    INSERT INTO mixture_recipe_items (mixture_id, raw_material_id, quantity, unit, position, notes, recipe_version_id)
    SELECT mixture_id, raw_material_id, quantity, unit, position, notes, v_new
    FROM mixture_recipe_items WHERE recipe_version_id = _copy_from;
    INSERT INTO mixture_process_sections (recipe_version_id, sort_order, name, description, planned_duration_min, target_temperature, target_unit, remarks)
    SELECT v_new, sort_order, name, description, planned_duration_min, target_temperature, target_unit, remarks
    FROM mixture_process_sections WHERE recipe_version_id = _copy_from;
  END IF;
  RETURN v_new;
END $$;

CREATE OR REPLACE FUNCTION public.activate_mixture_recipe_version(_version_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mix uuid; v_actor uuid := auth.uid();
BEGIN
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  SELECT mixture_id INTO v_mix FROM mixture_recipe_versions WHERE id = _version_id;
  UPDATE mixture_recipe_versions SET is_active = (id = _version_id) WHERE mixture_id = v_mix;
END $$;

CREATE OR REPLACE FUNCTION public.start_mixture_batch(_batch_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  UPDATE mixture_batches
     SET execution_status = 'laufend', started_at = COALESCE(started_at, now())
   WHERE id = _batch_id AND execution_status IN ('geplant');
END $$;

CREATE OR REPLACE FUNCTION public.record_mixture_weighing(
  _batch_id uuid, _step_id uuid, _raw_material_id uuid, _raw_material_batch_id uuid,
  _target_quantity numeric, _actual_quantity numeric, _unit text, _notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); v_movement uuid; v_weighing uuid; v_batch_no text;
BEGIN
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  IF _actual_quantity IS NULL OR _actual_quantity <= 0 THEN RAISE EXCEPTION 'Menge muss > 0 sein'; END IF;
  SELECT batch_number INTO v_batch_no FROM mixture_batches WHERE id = _batch_id;
  INSERT INTO inventory_movements (raw_material_id, batch_id, movement_type, quantity, comment, created_by)
  VALUES (_raw_material_id, _raw_material_batch_id, 'verbrauch', _actual_quantity,
          'Verwiegung Charge '||COALESCE(v_batch_no,_batch_id::text), v_actor)
  RETURNING id INTO v_movement;
  INSERT INTO mixture_batch_weighings (batch_id, step_id, raw_material_id, raw_material_batch_id,
    target_quantity, actual_quantity, unit, weighed_by, inventory_movement_id, notes)
  VALUES (_batch_id, _step_id, _raw_material_id, _raw_material_batch_id,
    _target_quantity, _actual_quantity, COALESCE(_unit,'kg'), v_actor, v_movement, _notes)
  RETURNING id INTO v_weighing;
  RETURN v_weighing;
END $$;

CREATE OR REPLACE FUNCTION public.complete_mixture_batch(_batch_id uuid, _produced_quantity numeric DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); v_mix uuid; v_qty numeric; v_unit text;
BEGIN
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  UPDATE mixture_batches
     SET execution_status = 'abgeschlossen', ended_at = now(),
         produced_quantity = COALESCE(_produced_quantity, produced_quantity)
   WHERE id = _batch_id
   RETURNING mixture_id, produced_quantity, unit INTO v_mix, v_qty, v_unit;
  IF NOT EXISTS (SELECT 1 FROM mixture_inventory_movements WHERE mixture_batch_id = _batch_id AND movement_type = 'eingang') THEN
    INSERT INTO mixture_inventory_movements (mixture_id, mixture_batch_id, movement_type, quantity, unit, comment, created_by)
    VALUES (v_mix, _batch_id, 'eingang', COALESCE(v_qty,0), COALESCE(v_unit,'kg'), 'Charge abgeschlossen', v_actor);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.release_mixture_batch(_batch_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); v_producer uuid;
BEGIN
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  SELECT produced_by INTO v_producer FROM mixture_batches WHERE id = _batch_id;
  IF v_producer = v_actor THEN
    RAISE EXCEPTION '4-Augen-Prinzip: Freigabe durch zweite Person erforderlich';
  END IF;
  UPDATE mixture_batches
     SET execution_status = 'freigegeben', released_at = now(), released_by = v_actor
   WHERE id = _batch_id AND execution_status = 'abgeschlossen';
END $$;

CREATE OR REPLACE FUNCTION public.mixture_recipe_availability(_version_id uuid, _scale numeric DEFAULT 1)
RETURNS TABLE(raw_material_id uuid, material_name text, material_number text, required numeric, available numeric, missing numeric, unit text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH need AS (
    SELECT ri.raw_material_id, SUM(ri.quantity)::numeric * _scale AS required, MAX(ri.unit) AS unit
    FROM mixture_recipe_items ri
    WHERE ri.recipe_version_id = _version_id
    GROUP BY ri.raw_material_id
  ),
  stock AS (
    SELECT im.raw_material_id,
           COALESCE(SUM(CASE WHEN im.movement_type::text IN ('eingang','korrektur_plus','retoure') THEN im.quantity
                             WHEN im.movement_type::text IN ('verbrauch','korrektur_minus','schwund') THEN -im.quantity
                             ELSE 0 END),0) AS available
    FROM inventory_movements im
    GROUP BY im.raw_material_id
  )
  SELECT n.raw_material_id, rm.material_name, rm.material_number,
         n.required, COALESCE(s.available,0) AS available,
         GREATEST(n.required - COALESCE(s.available,0),0) AS missing,
         COALESCE(n.unit, rm.unit) AS unit
  FROM need n
  JOIN raw_materials rm ON rm.id = n.raw_material_id
  LEFT JOIN stock s ON s.raw_material_id = n.raw_material_id;
$$;
