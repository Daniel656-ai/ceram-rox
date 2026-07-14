
-- =====================================================================
-- ENUMS
-- =====================================================================
DO $$ BEGIN
  CREATE TYPE public.pilot_plant_block_key AS ENUM (
    'stammdaten','rezeptur','knetung','extrusion','trocknung',
    'brennen','probenentnahme','uebergabe','abschluss'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pilot_plant_block_status AS ENUM (
    'pending','in_progress','completed','skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- measurement_orders: Kennzeichen
-- =====================================================================
ALTER TABLE public.measurement_orders
  ADD COLUMN IF NOT EXISTS is_pilot_plant_process boolean NOT NULL DEFAULT false;

-- =====================================================================
-- samples: Rückverweis
-- =====================================================================
ALTER TABLE public.samples
  ADD COLUMN IF NOT EXISTS pilot_plant_order_id uuid
    REFERENCES public.measurement_orders(id) ON DELETE SET NULL;

-- =====================================================================
-- Table: pilot_plant_blocks
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.pilot_plant_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.measurement_orders(id) ON DELETE CASCADE,
  block_key public.pilot_plant_block_key NOT NULL,
  order_index integer NOT NULL,
  status public.pilot_plant_block_status NOT NULL DEFAULT 'pending',
  assigned_role text NULL,
  assigned_to uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text NULL,
  started_at timestamptz NULL,
  started_by uuid NULL,
  completed_at timestamptz NULL,
  completed_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, block_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_plant_blocks TO authenticated;
GRANT ALL ON public.pilot_plant_blocks TO service_role;

ALTER TABLE public.pilot_plant_blocks ENABLE ROW LEVEL SECURITY;

-- Read: anyone authenticated (mirrors measurement_orders read-scope in this app)
CREATE POLICY "pp_blocks_read_authenticated"
  ON public.pilot_plant_blocks FOR SELECT
  TO authenticated
  USING (true);

-- Write: assigned_to = auth.uid() OR user has matching custom role OR is master
CREATE POLICY "pp_blocks_write_assignee_or_role"
  ON public.pilot_plant_blocks FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR public.has_role(auth.uid(), 'master'::public.app_role)
    OR (assigned_role IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role::text = assigned_role
    ))
    OR EXISTS (
      SELECT 1 FROM public.measurement_orders mo
      WHERE mo.id = order_id AND mo.created_by = auth.uid()
    )
  )
  WITH CHECK (true);

-- Insert/Delete: master + order creator (seeding)
CREATE POLICY "pp_blocks_insert_creator_or_master"
  ON public.pilot_plant_blocks FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'master'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.measurement_orders mo
      WHERE mo.id = order_id AND mo.created_by = auth.uid()
    )
  );

CREATE POLICY "pp_blocks_delete_master"
  ON public.pilot_plant_blocks FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'master'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_pp_blocks_order ON public.pilot_plant_blocks(order_id, order_index);
CREATE INDEX IF NOT EXISTS idx_pp_blocks_assigned ON public.pilot_plant_blocks(assigned_to) WHERE status IN ('pending','in_progress');

-- =====================================================================
-- Table: pilot_plant_produced_samples
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.pilot_plant_produced_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.measurement_orders(id) ON DELETE CASCADE,
  block_id uuid NULL REFERENCES public.pilot_plant_blocks(id) ON DELETE SET NULL,
  label text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  marking text NULL,
  notes text NULL,
  created_sample_id uuid NULL REFERENCES public.samples(id) ON DELETE SET NULL,
  created_order_id uuid NULL REFERENCES public.measurement_orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_plant_produced_samples TO authenticated;
GRANT ALL ON public.pilot_plant_produced_samples TO service_role;

ALTER TABLE public.pilot_plant_produced_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pp_samples_read_authenticated"
  ON public.pilot_plant_produced_samples FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "pp_samples_write_probenentnahme"
  ON public.pilot_plant_produced_samples FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'master'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.pilot_plant_blocks b
      WHERE b.order_id = pilot_plant_produced_samples.order_id
        AND b.block_key = 'probenentnahme'
        AND (
          b.assigned_to = auth.uid()
          OR (b.assigned_role IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role::text = b.assigned_role
          ))
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.measurement_orders mo
      WHERE mo.id = pilot_plant_produced_samples.order_id AND mo.created_by = auth.uid()
    )
  )
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pp_produced_order ON public.pilot_plant_produced_samples(order_id);

-- =====================================================================
-- updated_at triggers
-- =====================================================================
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_pp_blocks_touch ON public.pilot_plant_blocks;
CREATE TRIGGER trg_pp_blocks_touch BEFORE UPDATE ON public.pilot_plant_blocks
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

DROP TRIGGER IF EXISTS trg_pp_produced_touch ON public.pilot_plant_produced_samples;
CREATE TRIGGER trg_pp_produced_touch BEFORE UPDATE ON public.pilot_plant_produced_samples
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =====================================================================
-- Seeder: creates all 9 blocks for an order
-- =====================================================================
CREATE OR REPLACE FUNCTION public.pp_seed_blocks(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  keys public.pilot_plant_block_key[] := ARRAY[
    'stammdaten','rezeptur','knetung','extrusion','trocknung',
    'brennen','probenentnahme','uebergabe','abschluss'
  ]::public.pilot_plant_block_key[];
  i int;
BEGIN
  FOR i IN 1 .. array_length(keys, 1) LOOP
    INSERT INTO public.pilot_plant_blocks (order_id, block_key, order_index, status)
    VALUES (_order_id, keys[i], i, CASE WHEN i = 1 THEN 'pending' ELSE 'pending' END)
    ON CONFLICT (order_id, block_key) DO NOTHING;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.pp_seed_blocks(uuid) TO authenticated;

-- =====================================================================
-- RPC: start a block
-- =====================================================================
CREATE OR REPLACE FUNCTION public.pp_start_block(_block_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.pilot_plant_blocks;
  is_master boolean;
  role_match boolean := false;
BEGIN
  SELECT * INTO b FROM public.pilot_plant_blocks WHERE id = _block_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Block nicht gefunden'; END IF;
  IF public.is_order_locked(b.order_id) THEN
    RAISE EXCEPTION 'Auftrag ist gesperrt';
  END IF;

  is_master := public.has_role(auth.uid(), 'master'::public.app_role);
  IF b.assigned_role IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = b.assigned_role) INTO role_match;
  END IF;

  IF NOT (is_master OR b.assigned_to = auth.uid() OR role_match) THEN
    -- allow self-claim when block is unassigned
    IF b.assigned_to IS NULL AND b.assigned_role IS NULL THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'Keine Berechtigung für diesen Baustein';
    END IF;
  END IF;

  UPDATE public.pilot_plant_blocks
     SET status = 'in_progress',
         started_at = COALESCE(started_at, now()),
         started_by = COALESCE(started_by, auth.uid()),
         assigned_to = COALESCE(assigned_to, auth.uid())
   WHERE id = _block_id;
END $$;

GRANT EXECUTE ON FUNCTION public.pp_start_block(uuid) TO authenticated;

-- =====================================================================
-- Helper: round minutes to 15
-- =====================================================================
CREATE OR REPLACE FUNCTION public.pp_round_minutes_to_15(_from timestamptz, _to timestamptz)
RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT GREATEST(
    15,
    (CEIL(EXTRACT(EPOCH FROM (_to - _from)) / 60.0 / 15.0) * 15)::int
  );
$$;

-- =====================================================================
-- RPC: complete a block
-- =====================================================================
CREATE OR REPLACE FUNCTION public.pp_complete_block(
  _block_id uuid,
  _data jsonb DEFAULT '{}'::jsonb,
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.pilot_plant_blocks;
  o public.measurement_orders;
  is_master boolean;
  role_match boolean := false;
  next_block public.pilot_plant_blocks;
  produced record;
  new_sample_id uuid;
  new_order_id uuid;
  service_id uuid;
  service_ids uuid[];
  minutes int;
BEGIN
  SELECT * INTO b FROM public.pilot_plant_blocks WHERE id = _block_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Block nicht gefunden'; END IF;

  SELECT * INTO o FROM public.measurement_orders WHERE id = b.order_id;
  IF public.is_order_locked(b.order_id) THEN
    RAISE EXCEPTION 'Auftrag ist gesperrt';
  END IF;

  is_master := public.has_role(auth.uid(), 'master'::public.app_role);
  IF b.assigned_role IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = b.assigned_role) INTO role_match;
  END IF;
  IF NOT (is_master OR b.assigned_to = auth.uid() OR role_match OR o.created_by = auth.uid()) THEN
    RAISE EXCEPTION 'Keine Berechtigung für diesen Baustein';
  END IF;

  -- Update block
  UPDATE public.pilot_plant_blocks
     SET status = 'completed',
         data = COALESCE(_data, data),
         notes = COALESCE(_notes, notes),
         completed_at = now(),
         completed_by = auth.uid(),
         started_at = COALESCE(started_at, now()),
         assigned_to = COALESCE(assigned_to, auth.uid())
   WHERE id = _block_id
   RETURNING * INTO b;

  -- Merge into shared_form_data under pp.<block_key>
  UPDATE public.measurement_orders
     SET shared_form_data = jsonb_set(
           COALESCE(shared_form_data, '{}'::jsonb),
           ARRAY['pp', b.block_key::text],
           COALESCE(_data, '{}'::jsonb),
           true
         ),
         updated_at = now()
   WHERE id = b.order_id;

  -- Time entry (rounded to 15 min, min 15)
  IF b.started_at IS NOT NULL AND b.completed_by IS NOT NULL AND b.completed_at IS NOT NULL THEN
    minutes := public.pp_round_minutes_to_15(b.started_at, b.completed_at);
    INSERT INTO public.project_time_entries
      (project_id, person_id, entry_date, duration_minutes, note, created_by, order_id, entry_type)
    VALUES (
      o.project_id,
      b.completed_by,
      (b.completed_at AT TIME ZONE 'UTC')::date,
      minutes,
      'Pilot-Plant: ' || b.block_key::text,
      b.completed_by,
      b.order_id,
      'work'
    );
  END IF;

  -- Special handling: probenentnahme -> materialize samples + lab orders
  IF b.block_key = 'probenentnahme' THEN
    -- read requested lab services from stammdaten
    SELECT COALESCE(ARRAY(SELECT jsonb_array_elements_text(
             (o2.shared_form_data #> '{pp,stammdaten,requested_lab_service_ids}')
           ))::uuid[], ARRAY[]::uuid[])
      INTO service_ids
      FROM public.measurement_orders o2
     WHERE o2.id = b.order_id;

    FOR produced IN
      SELECT * FROM public.pilot_plant_produced_samples
       WHERE order_id = b.order_id AND created_sample_id IS NULL
    LOOP
      -- Create sample (sample_number auto-generated by trigger)
      INSERT INTO public.samples (
        sample_name, description, project_id, created_by, status,
        pilot_plant_order_id, sample_group
      ) VALUES (
        produced.label,
        COALESCE(produced.notes, 'Pilot-Plant-Probe'),
        o.project_id,
        COALESCE(auth.uid(), o.created_by),
        'received',
        b.order_id,
        COALESCE(produced.marking, NULL)
      )
      RETURNING id INTO new_sample_id;

      new_order_id := NULL;
      IF array_length(service_ids, 1) IS NOT NULL AND array_length(service_ids, 1) > 0 THEN
        INSERT INTO public.measurement_orders (
          project_id, order_type, created_by, sample_id, priority, order_kind, notes
        ) VALUES (
          o.project_id,
          'production'::public.order_type,
          COALESCE(auth.uid(), o.created_by),
          new_sample_id,
          o.priority,
          'legacy'::public.order_kind,
          'Automatisch erzeugt aus Pilot-Plant-Auftrag'
        )
        RETURNING id INTO new_order_id;

        FOREACH service_id IN ARRAY service_ids LOOP
          INSERT INTO public.order_measurements (order_id, service_id, status)
          VALUES (new_order_id, service_id, 'open');
        END LOOP;
      END IF;

      UPDATE public.pilot_plant_produced_samples
         SET created_sample_id = new_sample_id,
             created_order_id = new_order_id
       WHERE id = produced.id;
    END LOOP;
  END IF;

  -- Advance to next block
  SELECT * INTO next_block
    FROM public.pilot_plant_blocks
   WHERE order_id = b.order_id AND order_index = b.order_index + 1;

  IF FOUND AND next_block.status = 'pending' THEN
    -- no auto-start; leave as pending (assignee will start)
    NULL;
  END IF;

  -- Abschluss -> close order
  IF b.block_key = 'abschluss' THEN
    UPDATE public.measurement_orders
       SET status = 'completed', updated_at = now()
     WHERE id = b.order_id AND status <> 'completed';
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.pp_complete_block(uuid, jsonb, text) TO authenticated;
