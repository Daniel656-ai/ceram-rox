
-- ========= Phase A: Flexible Zeitsteuerung =========
CREATE TYPE step_time_mode AS ENUM ('relative', 'absolute', 'condition');
CREATE TYPE step_condition_kind AS ENUM ('temperature', 'ph', 'previous_step', 'manual_release', 'custom');

ALTER TABLE public.mixture_process_steps
  ADD COLUMN time_mode step_time_mode NOT NULL DEFAULT 'relative',
  ADD COLUMN absolute_time time,
  ADD COLUMN condition_kind step_condition_kind,
  ADD COLUMN condition_value numeric,
  ADD COLUMN condition_unit text,
  ADD COLUMN condition_text text;

ALTER TABLE public.mixture_planned_measurements
  ADD COLUMN time_mode step_time_mode NOT NULL DEFAULT 'relative',
  ADD COLUMN absolute_time time,
  ADD COLUMN condition_kind step_condition_kind,
  ADD COLUMN condition_value numeric,
  ADD COLUMN condition_unit text,
  ADD COLUMN condition_text text;

-- ========= Phase B: Vorlagen, Versionierung =========
CREATE TYPE mixture_template_kind AS ENUM ('standard', 'customer', 'development', 'pilot', 'production');

ALTER TABLE public.mixtures
  ADD COLUMN is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN template_kind mixture_template_kind,
  ADD COLUMN copied_from_mixture_id uuid REFERENCES public.mixtures(id) ON DELETE SET NULL;

ALTER TABLE public.mixture_recipe_versions
  ADD COLUMN version_label text,
  ADD COLUMN change_summary text,
  ADD COLUMN change_reason text,
  ADD COLUMN parent_version_id uuid REFERENCES public.mixture_recipe_versions(id) ON DELETE SET NULL;

-- ========= RPC: Mischung duplizieren =========
CREATE OR REPLACE FUNCTION public.copy_mixture(_source_id uuid, _new_name text, _new_number text DEFAULT NULL, _as_template boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_new_mixture uuid;
  v_source_version uuid;
  v_new_version uuid;
  v_section record;
  v_new_section uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung';
  END IF;

  -- Mischung kopieren
  INSERT INTO mixtures (name, mixture_number, description, category, unit, target_concentration, created_by, copied_from_mixture_id, is_template, template_kind)
  SELECT _new_name, _new_number, description, category, unit, target_concentration, v_actor, _source_id,
         _as_template, CASE WHEN _as_template THEN template_kind ELSE NULL END
  FROM mixtures WHERE id = _source_id
  RETURNING id INTO v_new_mixture;

  -- Aktive Quell-Version holen (Fallback: höchste)
  SELECT id INTO v_source_version FROM mixture_recipe_versions
   WHERE mixture_id = _source_id AND is_active = true LIMIT 1;
  IF v_source_version IS NULL THEN
    SELECT id INTO v_source_version FROM mixture_recipe_versions
     WHERE mixture_id = _source_id ORDER BY version_no DESC LIMIT 1;
  END IF;

  -- Neue Version 1 anlegen
  INSERT INTO mixture_recipe_versions (mixture_id, version_no, version_label, is_active, notes, created_by, change_summary)
  VALUES (v_new_mixture, 1, '1.0', true, 'Kopiert aus Mischung', v_actor, 'Initiale Kopie')
  RETURNING id INTO v_new_version;

  IF v_source_version IS NOT NULL THEN
    -- Rezepturpositionen
    INSERT INTO mixture_recipe_items (mixture_id, raw_material_id, quantity, unit, position, notes, recipe_version_id)
    SELECT v_new_mixture, raw_material_id, quantity, unit, position, notes, v_new_version
    FROM mixture_recipe_items WHERE recipe_version_id = v_source_version;

    -- Prozessabschnitte + Steps + Messungen
    FOR v_section IN
      SELECT * FROM mixture_process_sections WHERE recipe_version_id = v_source_version ORDER BY sort_order
    LOOP
      INSERT INTO mixture_process_sections (recipe_version_id, sort_order, name, description, planned_duration_min, target_temperature, target_unit, remarks)
      VALUES (v_new_version, v_section.sort_order, v_section.name, v_section.description, v_section.planned_duration_min, v_section.target_temperature, v_section.target_unit, v_section.remarks)
      RETURNING id INTO v_new_section;

      INSERT INTO mixture_process_steps (section_id, sort_order, raw_material_id, instruction, planned_quantity, unit, offset_minutes, window_minutes,
        time_mode, absolute_time, condition_kind, condition_value, condition_unit, condition_text)
      SELECT v_new_section, sort_order, raw_material_id, instruction, planned_quantity, unit, offset_minutes, window_minutes,
        time_mode, absolute_time, condition_kind, condition_value, condition_unit, condition_text
      FROM mixture_process_steps WHERE section_id = v_section.id;

      INSERT INTO mixture_planned_measurements (section_id, parameter_name, unit, target_value, tolerance, offset_minutes, sort_order,
        time_mode, absolute_time, condition_kind, condition_value, condition_unit, condition_text)
      SELECT v_new_section, parameter_name, unit, target_value, tolerance, offset_minutes, sort_order,
        time_mode, absolute_time, condition_kind, condition_value, condition_unit, condition_text
      FROM mixture_planned_measurements WHERE section_id = v_section.id;
    END LOOP;
  END IF;

  RETURN v_new_mixture;
END $$;

-- ========= RPC: Neue Version anlegen (überschrieben mit zusätzlichen Feldern) =========
CREATE OR REPLACE FUNCTION public.create_mixture_recipe_version(
  _mixture_id uuid,
  _copy_from uuid DEFAULT NULL,
  _notes text DEFAULT NULL,
  _version_label text DEFAULT NULL,
  _change_summary text DEFAULT NULL,
  _change_reason text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_actor uuid := auth.uid(); v_next int; v_new uuid; v_section record; v_new_section uuid; v_label text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  IF NOT (has_role(v_actor,'master'::app_role) OR has_permission(v_actor,'raw_materials.manage')) THEN
    RAISE EXCEPTION 'Keine Berechtigung'; END IF;
  SELECT COALESCE(MAX(version_no),0)+1 INTO v_next FROM mixture_recipe_versions WHERE mixture_id = _mixture_id;
  v_label := COALESCE(_version_label, v_next || '.0');
  INSERT INTO mixture_recipe_versions(mixture_id, version_no, version_label, is_active, notes, created_by, change_summary, change_reason, parent_version_id)
  VALUES (_mixture_id, v_next, v_label, v_next = 1, _notes, v_actor, _change_summary, _change_reason, _copy_from)
  RETURNING id INTO v_new;
  IF _copy_from IS NOT NULL THEN
    INSERT INTO mixture_recipe_items (mixture_id, raw_material_id, quantity, unit, position, notes, recipe_version_id)
    SELECT mixture_id, raw_material_id, quantity, unit, position, notes, v_new
    FROM mixture_recipe_items WHERE recipe_version_id = _copy_from;

    FOR v_section IN
      SELECT * FROM mixture_process_sections WHERE recipe_version_id = _copy_from ORDER BY sort_order
    LOOP
      INSERT INTO mixture_process_sections (recipe_version_id, sort_order, name, description, planned_duration_min, target_temperature, target_unit, remarks)
      VALUES (v_new, v_section.sort_order, v_section.name, v_section.description, v_section.planned_duration_min, v_section.target_temperature, v_section.target_unit, v_section.remarks)
      RETURNING id INTO v_new_section;

      INSERT INTO mixture_process_steps (section_id, sort_order, raw_material_id, instruction, planned_quantity, unit, offset_minutes, window_minutes,
        time_mode, absolute_time, condition_kind, condition_value, condition_unit, condition_text)
      SELECT v_new_section, sort_order, raw_material_id, instruction, planned_quantity, unit, offset_minutes, window_minutes,
        time_mode, absolute_time, condition_kind, condition_value, condition_unit, condition_text
      FROM mixture_process_steps WHERE section_id = v_section.id;

      INSERT INTO mixture_planned_measurements (section_id, parameter_name, unit, target_value, tolerance, offset_minutes, sort_order,
        time_mode, absolute_time, condition_kind, condition_value, condition_unit, condition_text)
      SELECT v_new_section, parameter_name, unit, target_value, tolerance, offset_minutes, sort_order,
        time_mode, absolute_time, condition_kind, condition_value, condition_unit, condition_text
      FROM mixture_planned_measurements WHERE section_id = v_section.id;
    END LOOP;
  END IF;
  RETURN v_new;
END $$;

-- ========= RPC: Versionsvergleich =========
CREATE OR REPLACE FUNCTION public.diff_recipe_versions(_version_a uuid, _version_b uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_items jsonb; v_sections jsonb;
BEGIN
  -- Rohstoffe diff (per raw_material_id)
  WITH a AS (SELECT raw_material_id, quantity, unit, position, notes FROM mixture_recipe_items WHERE recipe_version_id = _version_a),
       b AS (SELECT raw_material_id, quantity, unit, position, notes FROM mixture_recipe_items WHERE recipe_version_id = _version_b)
  SELECT jsonb_build_object(
    'added', COALESCE((SELECT jsonb_agg(jsonb_build_object('raw_material_id', b.raw_material_id, 'material_name', rm.material_name, 'quantity', b.quantity, 'unit', b.unit))
                       FROM b LEFT JOIN raw_materials rm ON rm.id = b.raw_material_id
                       WHERE NOT EXISTS (SELECT 1 FROM a WHERE a.raw_material_id = b.raw_material_id)), '[]'::jsonb),
    'removed', COALESCE((SELECT jsonb_agg(jsonb_build_object('raw_material_id', a.raw_material_id, 'material_name', rm.material_name, 'quantity', a.quantity, 'unit', a.unit))
                         FROM a LEFT JOIN raw_materials rm ON rm.id = a.raw_material_id
                         WHERE NOT EXISTS (SELECT 1 FROM b WHERE b.raw_material_id = a.raw_material_id)), '[]'::jsonb),
    'changed', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                            'raw_material_id', a.raw_material_id,
                            'material_name', rm.material_name,
                            'old_quantity', a.quantity, 'new_quantity', b.quantity,
                            'old_unit', a.unit, 'new_unit', b.unit))
                         FROM a JOIN b USING (raw_material_id)
                         LEFT JOIN raw_materials rm ON rm.id = a.raw_material_id
                         WHERE a.quantity IS DISTINCT FROM b.quantity OR a.unit IS DISTINCT FROM b.unit), '[]'::jsonb)
  ) INTO v_items;

  -- Sections diff (per name)
  WITH a AS (SELECT name, planned_duration_min, target_temperature FROM mixture_process_sections WHERE recipe_version_id = _version_a),
       b AS (SELECT name, planned_duration_min, target_temperature FROM mixture_process_sections WHERE recipe_version_id = _version_b)
  SELECT jsonb_build_object(
    'added', COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM b WHERE NOT EXISTS (SELECT 1 FROM a WHERE a.name = b.name)), '[]'::jsonb),
    'removed', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM a WHERE NOT EXISTS (SELECT 1 FROM b WHERE b.name = a.name)), '[]'::jsonb),
    'changed', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                            'name', a.name,
                            'old_duration', a.planned_duration_min, 'new_duration', b.planned_duration_min,
                            'old_temperature', a.target_temperature, 'new_temperature', b.target_temperature))
                         FROM a JOIN b USING (name)
                         WHERE a.planned_duration_min IS DISTINCT FROM b.planned_duration_min
                            OR a.target_temperature IS DISTINCT FROM b.target_temperature), '[]'::jsonb)
  ) INTO v_sections;

  RETURN jsonb_build_object('items', v_items, 'sections', v_sections);
END $$;
