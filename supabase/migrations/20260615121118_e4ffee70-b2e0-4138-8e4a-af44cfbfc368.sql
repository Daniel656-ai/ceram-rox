
-- ============================================================
-- MIXTURES & SOLUTIONS
-- ============================================================

CREATE TYPE public.mixture_category AS ENUM ('mischung', 'loesung');
CREATE TYPE public.mixture_batch_status AS ENUM ('produced', 'discarded');
CREATE TYPE public.mixture_movement_type AS ENUM ('eingang', 'ausgang');

-- ---------- mixtures ----------
CREATE TABLE public.mixtures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mixture_number text,
  description text,
  category public.mixture_category NOT NULL DEFAULT 'mischung',
  unit text NOT NULL DEFAULT 'kg',
  target_concentration text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mixtures TO authenticated;
GRANT ALL ON public.mixtures TO service_role;
ALTER TABLE public.mixtures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mixtures readable by authenticated"
  ON public.mixtures FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Mixtures writable by managers"
  ON public.mixtures FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'raw_materials.manage'))
  WITH CHECK (public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'raw_materials.manage'));

CREATE TRIGGER mixtures_updated_at
  BEFORE UPDATE ON public.mixtures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ---------- mixture_recipe_items ----------
CREATE TABLE public.mixture_recipe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mixture_id uuid NOT NULL REFERENCES public.mixtures(id) ON DELETE CASCADE,
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'kg',
  position int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mixture_recipe_items_mixture_idx ON public.mixture_recipe_items(mixture_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mixture_recipe_items TO authenticated;
GRANT ALL ON public.mixture_recipe_items TO service_role;
ALTER TABLE public.mixture_recipe_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipe items readable by authenticated"
  ON public.mixture_recipe_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Recipe items writable by managers"
  ON public.mixture_recipe_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'raw_materials.manage'))
  WITH CHECK (public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'raw_materials.manage'));

CREATE TRIGGER mixture_recipe_items_updated_at
  BEFORE UPDATE ON public.mixture_recipe_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ---------- mixture_batches ----------
CREATE TABLE public.mixture_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mixture_id uuid NOT NULL REFERENCES public.mixtures(id) ON DELETE RESTRICT,
  batch_number text NOT NULL UNIQUE,
  produced_at timestamptz NOT NULL DEFAULT now(),
  produced_by uuid NOT NULL REFERENCES auth.users(id),
  produced_quantity numeric NOT NULL CHECK (produced_quantity > 0),
  unit text NOT NULL DEFAULT 'kg',
  concentration text,
  notes text,
  status public.mixture_batch_status NOT NULL DEFAULT 'produced',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mixture_batches_mixture_idx ON public.mixture_batches(mixture_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mixture_batches TO authenticated;
GRANT ALL ON public.mixture_batches TO service_role;
ALTER TABLE public.mixture_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mixture batches readable by authenticated"
  ON public.mixture_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Mixture batches insert by managers"
  ON public.mixture_batches FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'raw_materials.manage'));
CREATE POLICY "Mixture batches update by managers"
  ON public.mixture_batches FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'raw_materials.manage'))
  WITH CHECK (public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'raw_materials.manage'));
-- No DELETE policy on purpose: protocols are audit-relevant and not deletable from the UI.

CREATE TRIGGER mixture_batches_updated_at
  BEFORE UPDATE ON public.mixture_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ---------- batch number generator ----------
CREATE OR REPLACE FUNCTION public.generate_mixture_batch_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_yy text;
  next_val int;
BEGIN
  IF NEW.batch_number IS NOT NULL AND length(NEW.batch_number) > 0 THEN
    RETURN NEW;
  END IF;

  current_yy := to_char(now(), 'YY');
  PERFORM pg_advisory_xact_lock(hashtext('mixture_batch_number_' || current_yy));

  SELECT COALESCE(MAX(substring(batch_number from 6)::int), 0) + 1
  INTO next_val
  FROM public.mixture_batches
  WHERE batch_number LIKE 'MIX' || current_yy || '%';

  NEW.batch_number := 'MIX' || current_yy || lpad(next_val::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER mixture_batches_generate_number
  BEFORE INSERT ON public.mixture_batches
  FOR EACH ROW EXECUTE FUNCTION public.generate_mixture_batch_number();


-- ---------- mixture_batch_consumptions ----------
CREATE TABLE public.mixture_batch_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mixture_batch_id uuid NOT NULL REFERENCES public.mixture_batches(id) ON DELETE CASCADE,
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE RESTRICT,
  raw_material_batch_id uuid REFERENCES public.raw_material_batches(id) ON DELETE SET NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'kg',
  inventory_movement_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mixture_batch_consumptions_batch_idx ON public.mixture_batch_consumptions(mixture_batch_id);
CREATE INDEX mixture_batch_consumptions_material_idx ON public.mixture_batch_consumptions(raw_material_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mixture_batch_consumptions TO authenticated;
GRANT ALL ON public.mixture_batch_consumptions TO service_role;
ALTER TABLE public.mixture_batch_consumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consumptions readable by authenticated"
  ON public.mixture_batch_consumptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Consumptions insert by managers"
  ON public.mixture_batch_consumptions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'raw_materials.manage'));


-- ---------- mixture_inventory_movements ----------
CREATE TABLE public.mixture_inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mixture_id uuid NOT NULL REFERENCES public.mixtures(id) ON DELETE CASCADE,
  mixture_batch_id uuid REFERENCES public.mixture_batches(id) ON DELETE SET NULL,
  movement_type public.mixture_movement_type NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'kg',
  movement_date timestamptz NOT NULL DEFAULT now(),
  comment text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mixture_inventory_movements_mixture_idx ON public.mixture_inventory_movements(mixture_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mixture_inventory_movements TO authenticated;
GRANT ALL ON public.mixture_inventory_movements TO service_role;
ALTER TABLE public.mixture_inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mixture movements readable by authenticated"
  ON public.mixture_inventory_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Mixture movements insert by managers"
  ON public.mixture_inventory_movements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'raw_materials.manage'));


-- ============================================================
-- RPC: produce_mixture_batch
-- Transactional: creates batch + consumptions + inventory movements
-- ============================================================
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

  -- Create batch (batch_number auto-generated by trigger)
  INSERT INTO public.mixture_batches (mixture_id, produced_by, produced_quantity, unit, concentration, notes)
  VALUES (_mixture_id, v_actor, _produced_quantity, COALESCE(_unit, 'kg'), _concentration, _notes)
  RETURNING id INTO v_batch_id;

  -- Process each consumed raw material
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

      -- Deduct from raw material stock
      INSERT INTO public.inventory_movements
        (raw_material_id, batch_id, movement_type, quantity, comment, created_by)
      VALUES
        (v_raw_material_id, v_raw_material_batch_id, 'ausgang', v_quantity,
         'Mischungsherstellung Charge ' || (SELECT batch_number FROM public.mixture_batches WHERE id = v_batch_id),
         v_actor)
      RETURNING id INTO v_movement_id;

      -- Traceability link
      INSERT INTO public.mixture_batch_consumptions
        (mixture_batch_id, raw_material_id, raw_material_batch_id, quantity, unit, inventory_movement_id)
      VALUES
        (v_batch_id, v_raw_material_id, v_raw_material_batch_id, v_quantity, v_unit, v_movement_id);
    END LOOP;
  END IF;

  -- Increase mixture stock
  INSERT INTO public.mixture_inventory_movements
    (mixture_id, mixture_batch_id, movement_type, quantity, unit, comment, created_by)
  VALUES
    (_mixture_id, v_batch_id, 'eingang', _produced_quantity, COALESCE(_unit, 'kg'),
     'Herstellung', v_actor);

  -- Activity log entry
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

GRANT EXECUTE ON FUNCTION public.produce_mixture_batch(uuid, numeric, text, text, text, jsonb) TO authenticated;
