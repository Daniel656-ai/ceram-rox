
-- Add new permission area "Knetungen und Lösungen" (mixtures)
-- Seed default permissions for system roles
INSERT INTO public.role_permissions (role_id, permission_key)
VALUES
  -- Administrator (master): full access
  ('00000000-0000-0000-0000-000000000001', 'mixtures.view'),
  ('00000000-0000-0000-0000-000000000001', 'mixtures.create'),
  ('00000000-0000-0000-0000-000000000001', 'mixtures.edit'),
  ('00000000-0000-0000-0000-000000000001', 'mixtures.delete'),
  ('00000000-0000-0000-0000-000000000001', 'mixtures.produce'),
  -- Messdienstleister (durchfuehrer): full access (produces)
  ('00000000-0000-0000-0000-000000000003', 'mixtures.view'),
  ('00000000-0000-0000-0000-000000000003', 'mixtures.create'),
  ('00000000-0000-0000-0000-000000000003', 'mixtures.edit'),
  ('00000000-0000-0000-0000-000000000003', 'mixtures.delete'),
  ('00000000-0000-0000-0000-000000000003', 'mixtures.produce'),
  -- Auftraggeber: recipes + process only, NO produce, NO delete
  ('00000000-0000-0000-0000-000000000002', 'mixtures.view'),
  ('00000000-0000-0000-0000-000000000002', 'mixtures.create'),
  ('00000000-0000-0000-0000-000000000002', 'mixtures.edit')
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- ============================================================
-- Recreate RLS policies on mixture* tables using new permissions
-- (keeping raw_materials.manage as backward-compat fallback)
-- ============================================================

-- mixtures: SELECT via view perm, write via create/edit/delete
DROP POLICY IF EXISTS "Mixtures readable by authenticated" ON public.mixtures;
DROP POLICY IF EXISTS "Mixtures writable by managers" ON public.mixtures;
CREATE POLICY "Mixtures select" ON public.mixtures FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.view') OR has_permission(auth.uid(),'raw_materials.manage'));
CREATE POLICY "Mixtures insert" ON public.mixtures FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.create') OR has_permission(auth.uid(),'raw_materials.manage'));
CREATE POLICY "Mixtures update" ON public.mixtures FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.edit') OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.edit') OR has_permission(auth.uid(),'raw_materials.manage'));
CREATE POLICY "Mixtures delete" ON public.mixtures FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.delete') OR has_permission(auth.uid(),'raw_materials.manage'));

-- mixture_recipe_items: edit/delete via mixtures.edit (recipe authoring)
DROP POLICY IF EXISTS "Recipe items readable by authenticated" ON public.mixture_recipe_items;
DROP POLICY IF EXISTS "Recipe items writable by managers" ON public.mixture_recipe_items;
CREATE POLICY "Recipe items select" ON public.mixture_recipe_items FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.view') OR has_permission(auth.uid(),'raw_materials.manage'));
CREATE POLICY "Recipe items write" ON public.mixture_recipe_items FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.edit') OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.edit') OR has_permission(auth.uid(),'raw_materials.manage'));

-- mixture_recipe_versions
DROP POLICY IF EXISTS recipe_versions_select ON public.mixture_recipe_versions;
DROP POLICY IF EXISTS recipe_versions_manage ON public.mixture_recipe_versions;
CREATE POLICY recipe_versions_select ON public.mixture_recipe_versions FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.view') OR has_permission(auth.uid(),'raw_materials.manage'));
CREATE POLICY recipe_versions_manage ON public.mixture_recipe_versions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.edit') OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.edit') OR has_permission(auth.uid(),'raw_materials.manage'));

-- mixture_process_sections
DROP POLICY IF EXISTS sections_select ON public.mixture_process_sections;
DROP POLICY IF EXISTS sections_manage ON public.mixture_process_sections;
CREATE POLICY sections_select ON public.mixture_process_sections FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.view') OR has_permission(auth.uid(),'raw_materials.manage'));
CREATE POLICY sections_manage ON public.mixture_process_sections FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.edit') OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.edit') OR has_permission(auth.uid(),'raw_materials.manage'));

-- mixture_process_steps
DROP POLICY IF EXISTS steps_select ON public.mixture_process_steps;
DROP POLICY IF EXISTS steps_manage ON public.mixture_process_steps;
CREATE POLICY steps_select ON public.mixture_process_steps FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.view') OR has_permission(auth.uid(),'raw_materials.manage'));
CREATE POLICY steps_manage ON public.mixture_process_steps FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.edit') OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.edit') OR has_permission(auth.uid(),'raw_materials.manage'));

-- mixture_planned_measurements
DROP POLICY IF EXISTS planned_meas_select ON public.mixture_planned_measurements;
DROP POLICY IF EXISTS planned_meas_manage ON public.mixture_planned_measurements;
CREATE POLICY planned_meas_select ON public.mixture_planned_measurements FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.view') OR has_permission(auth.uid(),'raw_materials.manage'));
CREATE POLICY planned_meas_manage ON public.mixture_planned_measurements FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.edit') OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.edit') OR has_permission(auth.uid(),'raw_materials.manage'));

-- mixture_batches: production-related; require mixtures.produce
DROP POLICY IF EXISTS "Mixture batches readable by authenticated" ON public.mixture_batches;
DROP POLICY IF EXISTS "Mixture batches insert by managers" ON public.mixture_batches;
DROP POLICY IF EXISTS "Mixture batches update by managers" ON public.mixture_batches;
CREATE POLICY "Mixture batches select" ON public.mixture_batches FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.view') OR has_permission(auth.uid(),'raw_materials.manage'));
CREATE POLICY "Mixture batches insert" ON public.mixture_batches FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce') OR has_permission(auth.uid(),'raw_materials.manage'));
CREATE POLICY "Mixture batches update" ON public.mixture_batches FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce') OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce') OR has_permission(auth.uid(),'raw_materials.manage'));

-- mixture_inventory_movements
DROP POLICY IF EXISTS "Mixture movements readable by authenticated" ON public.mixture_inventory_movements;
DROP POLICY IF EXISTS "Mixture movements insert by managers" ON public.mixture_inventory_movements;
CREATE POLICY "Mixture movements select" ON public.mixture_inventory_movements FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.view') OR has_permission(auth.uid(),'raw_materials.manage'));
CREATE POLICY "Mixture movements insert" ON public.mixture_inventory_movements FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce') OR has_permission(auth.uid(),'raw_materials.manage'));

-- mixture_batch_consumptions
DROP POLICY IF EXISTS "Consumptions readable by authenticated" ON public.mixture_batch_consumptions;
DROP POLICY IF EXISTS "Consumptions insert by managers" ON public.mixture_batch_consumptions;
CREATE POLICY "Consumptions select" ON public.mixture_batch_consumptions FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.view') OR has_permission(auth.uid(),'raw_materials.manage'));
CREATE POLICY "Consumptions insert" ON public.mixture_batch_consumptions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce') OR has_permission(auth.uid(),'raw_materials.manage'));

-- mixture_batch_weighings
DROP POLICY IF EXISTS weighings_select ON public.mixture_batch_weighings;
DROP POLICY IF EXISTS weighings_manage ON public.mixture_batch_weighings;
CREATE POLICY weighings_select ON public.mixture_batch_weighings FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.view') OR has_permission(auth.uid(),'raw_materials.manage'));
CREATE POLICY weighings_manage ON public.mixture_batch_weighings FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce') OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce') OR has_permission(auth.uid(),'raw_materials.manage'));

-- mixture_batch_measurements
DROP POLICY IF EXISTS batch_meas_select ON public.mixture_batch_measurements;
DROP POLICY IF EXISTS batch_meas_manage ON public.mixture_batch_measurements;
CREATE POLICY batch_meas_select ON public.mixture_batch_measurements FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.view') OR has_permission(auth.uid(),'raw_materials.manage'));
CREATE POLICY batch_meas_manage ON public.mixture_batch_measurements FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce') OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce') OR has_permission(auth.uid(),'raw_materials.manage'));

-- mixture_batch_deviations
DROP POLICY IF EXISTS dev_select ON public.mixture_batch_deviations;
DROP POLICY IF EXISTS dev_manage ON public.mixture_batch_deviations;
CREATE POLICY dev_select ON public.mixture_batch_deviations FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.view') OR has_permission(auth.uid(),'raw_materials.manage'));
CREATE POLICY dev_manage ON public.mixture_batch_deviations FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce') OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'mixtures.produce') OR has_permission(auth.uid(),'raw_materials.manage'));

-- ============================================================
-- Update SECURITY DEFINER functions to honor new permissions
-- ============================================================

CREATE OR REPLACE FUNCTION public.produce_mixture_batch(_mixture_id uuid, _produced_quantity numeric, _unit text, _concentration text, _notes text, _consumptions jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentifizierung erforderlich'; END IF;
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'mixtures.produce') OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung zum Herstellen von Knetungen/Lösungen';
  END IF;
  IF _produced_quantity IS NULL OR _produced_quantity <= 0 THEN
    RAISE EXCEPTION 'Hergestellte Menge muss positiv sein';
  END IF;
  INSERT INTO public.mixture_batches (mixture_id, produced_by, produced_quantity, unit, concentration, notes)
  VALUES (_mixture_id, v_actor, _produced_quantity, COALESCE(_unit,'kg'), _concentration, _notes)
  RETURNING id INTO v_batch_id;
  IF _consumptions IS NOT NULL THEN
    FOR v_consumption IN SELECT * FROM jsonb_array_elements(_consumptions) LOOP
      v_raw_material_id := (v_consumption->>'raw_material_id')::uuid;
      v_raw_material_batch_id := NULLIF(v_consumption->>'raw_material_batch_id','')::uuid;
      v_quantity := (v_consumption->>'quantity')::numeric;
      v_unit := COALESCE(v_consumption->>'unit','kg');
      IF v_raw_material_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 THEN CONTINUE; END IF;
      INSERT INTO public.inventory_movements (raw_material_id, batch_id, movement_type, quantity, comment, created_by)
      VALUES (v_raw_material_id, v_raw_material_batch_id, 'verbrauch', v_quantity,
        'Knetungsherstellung Charge '||(SELECT batch_number FROM public.mixture_batches WHERE id = v_batch_id), v_actor)
      RETURNING id INTO v_movement_id;
      INSERT INTO public.mixture_batch_consumptions (mixture_batch_id, raw_material_id, raw_material_batch_id, quantity, unit, inventory_movement_id)
      VALUES (v_batch_id, v_raw_material_id, v_raw_material_batch_id, v_quantity, v_unit, v_movement_id);
    END LOOP;
  END IF;
  INSERT INTO public.mixture_inventory_movements (mixture_id, mixture_batch_id, movement_type, quantity, unit, comment, created_by)
  VALUES (_mixture_id, v_batch_id, 'eingang', _produced_quantity, COALESCE(_unit,'kg'), 'Herstellung', v_actor);
  INSERT INTO public.activity_log (event_type, actor_user_id, metadata)
  VALUES ('mixture_batch_produced', v_actor,
    jsonb_build_object('mixture_id', _mixture_id, 'mixture_batch_id', v_batch_id,
      'produced_quantity', _produced_quantity, 'unit', _unit, 'concentration', _concentration));
  RETURN v_batch_id;
END $function$;

CREATE OR REPLACE FUNCTION public.complete_mixture_batch(_batch_id uuid, _produced_quantity numeric DEFAULT NULL::numeric)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_actor uuid := auth.uid(); v_mix uuid; v_qty numeric; v_unit text;
BEGIN
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'mixtures.produce') OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  UPDATE mixture_batches SET execution_status='abgeschlossen', ended_at=now(),
    produced_quantity=COALESCE(_produced_quantity, produced_quantity)
   WHERE id=_batch_id RETURNING mixture_id, produced_quantity, unit INTO v_mix, v_qty, v_unit;
  IF NOT EXISTS (SELECT 1 FROM mixture_inventory_movements WHERE mixture_batch_id=_batch_id AND movement_type='eingang') THEN
    INSERT INTO mixture_inventory_movements (mixture_id, mixture_batch_id, movement_type, quantity, unit, comment, created_by)
    VALUES (v_mix, _batch_id, 'eingang', COALESCE(v_qty,0), COALESCE(v_unit,'kg'), 'Charge abgeschlossen', v_actor);
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.release_mixture_batch(_batch_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_actor uuid := auth.uid(); v_producer uuid;
BEGIN
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'mixtures.produce') OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  SELECT produced_by INTO v_producer FROM mixture_batches WHERE id=_batch_id;
  IF v_producer = v_actor THEN
    RAISE EXCEPTION '4-Augen-Prinzip: Freigabe durch zweite Person erforderlich';
  END IF;
  UPDATE mixture_batches SET execution_status='freigegeben', released_at=now(), released_by=v_actor
   WHERE id=_batch_id AND execution_status='abgeschlossen';
END $function$;

CREATE OR REPLACE FUNCTION public.activate_mixture_recipe_version(_version_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_mix uuid; v_actor uuid := auth.uid();
BEGIN
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'mixtures.edit') OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  SELECT mixture_id INTO v_mix FROM mixture_recipe_versions WHERE id=_version_id;
  UPDATE mixture_recipe_versions SET is_active=(id=_version_id) WHERE mixture_id=v_mix;
END $function$;

CREATE OR REPLACE FUNCTION public.copy_mixture(_source_id uuid, _new_name text, _new_number text DEFAULT NULL::text, _as_template boolean DEFAULT false)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_new_mixture uuid;
  v_source_version uuid;
  v_new_version uuid;
  v_section record;
  v_new_section uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'mixtures.create') OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;
  INSERT INTO mixtures (name, mixture_number, description, category, unit, target_concentration, created_by, copied_from_mixture_id, is_template, template_kind)
  SELECT _new_name, _new_number, description, category, unit, target_concentration, v_actor, _source_id,
         _as_template, CASE WHEN _as_template THEN template_kind ELSE NULL END
  FROM mixtures WHERE id=_source_id RETURNING id INTO v_new_mixture;
  SELECT id INTO v_source_version FROM mixture_recipe_versions WHERE mixture_id=_source_id AND is_active=true LIMIT 1;
  IF v_source_version IS NULL THEN
    SELECT id INTO v_source_version FROM mixture_recipe_versions WHERE mixture_id=_source_id ORDER BY version_no DESC LIMIT 1;
  END IF;
  INSERT INTO mixture_recipe_versions (mixture_id, version_no, version_label, is_active, notes, created_by, change_summary)
  VALUES (v_new_mixture, 1, '1.0', true, 'Kopiert aus Mischung', v_actor, 'Initiale Kopie') RETURNING id INTO v_new_version;
  IF v_source_version IS NOT NULL THEN
    INSERT INTO mixture_recipe_items (mixture_id, raw_material_id, quantity, unit, position, notes, recipe_version_id)
    SELECT v_new_mixture, raw_material_id, quantity, unit, position, notes, v_new_version
    FROM mixture_recipe_items WHERE recipe_version_id=v_source_version;
    FOR v_section IN SELECT * FROM mixture_process_sections WHERE recipe_version_id=v_source_version ORDER BY sort_order LOOP
      INSERT INTO mixture_process_sections (recipe_version_id, sort_order, name, description, planned_duration_min, target_temperature, target_unit, remarks)
      VALUES (v_new_version, v_section.sort_order, v_section.name, v_section.description, v_section.planned_duration_min, v_section.target_temperature, v_section.target_unit, v_section.remarks)
      RETURNING id INTO v_new_section;
      INSERT INTO mixture_process_steps (section_id, sort_order, raw_material_id, instruction, planned_quantity, unit, offset_minutes, window_minutes, time_mode, absolute_time, condition_kind, condition_value, condition_unit, condition_text)
      SELECT v_new_section, sort_order, raw_material_id, instruction, planned_quantity, unit, offset_minutes, window_minutes, time_mode, absolute_time, condition_kind, condition_value, condition_unit, condition_text
      FROM mixture_process_steps WHERE section_id=v_section.id;
      INSERT INTO mixture_planned_measurements (section_id, parameter_name, unit, target_value, tolerance, offset_minutes, sort_order, time_mode, absolute_time, condition_kind, condition_value, condition_unit, condition_text)
      SELECT v_new_section, parameter_name, unit, target_value, tolerance, offset_minutes, sort_order, time_mode, absolute_time, condition_kind, condition_value, condition_unit, condition_text
      FROM mixture_planned_measurements WHERE section_id=v_section.id;
    END LOOP;
  END IF;
  RETURN v_new_mixture;
END $function$;

CREATE OR REPLACE FUNCTION public.create_mixture_recipe_version(_mixture_id uuid, _copy_from uuid DEFAULT NULL::uuid, _notes text DEFAULT NULL::text, _version_label text DEFAULT NULL::text, _change_summary text DEFAULT NULL::text, _change_reason text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_actor uuid := auth.uid(); v_next int; v_new uuid; v_section record; v_new_section uuid; v_label text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'mixtures.edit') OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  SELECT COALESCE(MAX(version_no),0)+1 INTO v_next FROM mixture_recipe_versions WHERE mixture_id=_mixture_id;
  v_label := COALESCE(_version_label, v_next||'.0');
  INSERT INTO mixture_recipe_versions(mixture_id, version_no, version_label, is_active, notes, created_by, change_summary, change_reason, parent_version_id)
  VALUES (_mixture_id, v_next, v_label, v_next=1, _notes, v_actor, _change_summary, _change_reason, _copy_from)
  RETURNING id INTO v_new;
  IF _copy_from IS NOT NULL THEN
    INSERT INTO mixture_recipe_items (mixture_id, raw_material_id, quantity, unit, position, notes, recipe_version_id)
    SELECT mixture_id, raw_material_id, quantity, unit, position, notes, v_new
    FROM mixture_recipe_items WHERE recipe_version_id=_copy_from;
    FOR v_section IN SELECT * FROM mixture_process_sections WHERE recipe_version_id=_copy_from ORDER BY sort_order LOOP
      INSERT INTO mixture_process_sections (recipe_version_id, sort_order, name, description, planned_duration_min, target_temperature, target_unit, remarks)
      VALUES (v_new, v_section.sort_order, v_section.name, v_section.description, v_section.planned_duration_min, v_section.target_temperature, v_section.target_unit, v_section.remarks)
      RETURNING id INTO v_new_section;
      INSERT INTO mixture_process_steps (section_id, sort_order, raw_material_id, instruction, planned_quantity, unit, offset_minutes, window_minutes, time_mode, absolute_time, condition_kind, condition_value, condition_unit, condition_text)
      SELECT v_new_section, sort_order, raw_material_id, instruction, planned_quantity, unit, offset_minutes, window_minutes, time_mode, absolute_time, condition_kind, condition_value, condition_unit, condition_text
      FROM mixture_process_steps WHERE section_id=v_section.id;
      INSERT INTO mixture_planned_measurements (section_id, parameter_name, unit, target_value, tolerance, offset_minutes, sort_order, time_mode, absolute_time, condition_kind, condition_value, condition_unit, condition_text)
      SELECT v_new_section, parameter_name, unit, target_value, tolerance, offset_minutes, sort_order, time_mode, absolute_time, condition_kind, condition_value, condition_unit, condition_text
      FROM mixture_planned_measurements WHERE section_id=v_section.id;
    END LOOP;
  END IF;
  RETURN v_new;
END $function$;

CREATE OR REPLACE FUNCTION public.record_mixture_weighing(_batch_id uuid, _step_id uuid, _raw_material_id uuid, _raw_material_batch_id uuid, _target_quantity numeric, _actual_quantity numeric, _unit text, _notes text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_actor uuid := auth.uid(); v_movement uuid; v_weighing uuid; v_batch_no text;
BEGIN
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'mixtures.produce') OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  IF _actual_quantity IS NULL OR _actual_quantity <= 0 THEN RAISE EXCEPTION 'Menge muss > 0 sein'; END IF;
  SELECT batch_number INTO v_batch_no FROM mixture_batches WHERE id=_batch_id;
  INSERT INTO inventory_movements (raw_material_id, batch_id, movement_type, quantity, comment, created_by)
  VALUES (_raw_material_id, _raw_material_batch_id, 'verbrauch', _actual_quantity,
    'Knetungsherstellung Charge '||COALESCE(v_batch_no,_batch_id::text), v_actor)
  RETURNING id INTO v_movement;
  INSERT INTO mixture_batch_consumptions (mixture_batch_id, raw_material_id, raw_material_batch_id, quantity, unit, inventory_movement_id)
  VALUES (_batch_id, _raw_material_id, _raw_material_batch_id, _actual_quantity, COALESCE(_unit,'kg'), v_movement);
  INSERT INTO mixture_batch_weighings (batch_id, step_id, raw_material_id, raw_material_batch_id, target_quantity, actual_quantity, unit, notes, performed_by, inventory_movement_id)
  VALUES (_batch_id, _step_id, _raw_material_id, _raw_material_batch_id, _target_quantity, _actual_quantity, COALESCE(_unit,'kg'), _notes, v_actor, v_movement)
  RETURNING id INTO v_weighing;
  RETURN v_weighing;
END $function$;

CREATE OR REPLACE FUNCTION public.start_mixture_batch(_mixture_id uuid, _recipe_version_id uuid, _planned_quantity numeric, _unit text DEFAULT 'kg'::text, _scale_factor numeric DEFAULT 1)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_actor uuid := auth.uid(); v_id uuid;
BEGIN
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'mixtures.produce') OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  INSERT INTO mixture_batches (mixture_id, recipe_version_id, produced_by, produced_quantity, planned_quantity, scale_factor, unit, execution_status, started_at)
  VALUES (_mixture_id, _recipe_version_id, v_actor, 0, _planned_quantity, _scale_factor, _unit, 'in_arbeit', now())
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;
