
-- =========================================================
-- Phase A1: Workflow-orientierte Arbeitsobjekte - Fundament
-- =========================================================

-- 1) Enum für Referenztypen
DO $$ BEGIN
  CREATE TYPE public.reference_type AS ENUM
    ('experiment','serial','batch','complaint','customer_ref','internal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Erweiterung measurement_orders
ALTER TABLE public.measurement_orders
  ADD COLUMN IF NOT EXISTS reference_type   public.reference_type,
  ADD COLUMN IF NOT EXISTS reference_number text,
  ADD COLUMN IF NOT EXISTS origin           text,
  ADD COLUMN IF NOT EXISTS customer_name    text;

CREATE INDEX IF NOT EXISTS idx_orders_reference_number ON public.measurement_orders(reference_number);
CREATE INDEX IF NOT EXISTS idx_orders_origin ON public.measurement_orders(origin);

-- 3) work_object_origins (Katalog)
CREATE TABLE IF NOT EXISTS public.work_object_origins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label_de text NOT NULL,
  label_en text NOT NULL,
  default_reference_type public.reference_type NOT NULL DEFAULT 'experiment',
  default_workflow_template_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.work_object_origins TO authenticated;
GRANT ALL ON public.work_object_origins TO service_role;
ALTER TABLE public.work_object_origins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "origins_read_auth" ON public.work_object_origins FOR SELECT TO authenticated USING (true);
CREATE POLICY "origins_write_master" ON public.work_object_origins FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));

-- 4) reference_number_sequences
CREATE TABLE IF NOT EXISTS public.reference_number_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin text NOT NULL,
  reference_type public.reference_type NOT NULL,
  year int NOT NULL,
  next_seq int NOT NULL DEFAULT 1,
  pattern text NOT NULL DEFAULT 'V{yy}-{seq:03}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(origin, reference_type, year)
);
GRANT SELECT ON public.reference_number_sequences TO authenticated;
GRANT ALL ON public.reference_number_sequences TO service_role;
ALTER TABLE public.reference_number_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seq_read_auth" ON public.reference_number_sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "seq_write_master" ON public.reference_number_sequences FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));

-- 5) workflow_templates
CREATE TABLE IF NOT EXISTS public.workflow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  origin text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.workflow_templates TO authenticated;
GRANT ALL ON public.workflow_templates TO service_role;
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wft_read_auth" ON public.workflow_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "wft_write_master" ON public.workflow_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));

-- 6) workflow_template_steps
CREATE TABLE IF NOT EXISTS public.workflow_template_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  order_index int NOT NULL,
  step_key text NOT NULL,
  name text NOT NULL,
  description text,
  step_type text NOT NULL DEFAULT 'form',
  role_required text,
  form_id uuid,
  is_mandatory boolean NOT NULL DEFAULT true,
  condition_expr jsonb NOT NULL DEFAULT '{}'::jsonb,
  due_hours int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id, step_key)
);
CREATE INDEX IF NOT EXISTS idx_wfts_template ON public.workflow_template_steps(template_id, order_index);
GRANT SELECT ON public.workflow_template_steps TO authenticated;
GRANT ALL ON public.workflow_template_steps TO service_role;
ALTER TABLE public.workflow_template_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wfts_read_auth" ON public.workflow_template_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "wfts_write_master" ON public.workflow_template_steps FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));

-- 7) service_package_workflow_map
CREATE TABLE IF NOT EXISTS public.service_package_workflow_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.service_packages(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.workflow_templates(id) ON DELETE RESTRICT,
  requires_kneading boolean NOT NULL DEFAULT false,
  prepend_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  append_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(package_id)
);
GRANT SELECT ON public.service_package_workflow_map TO authenticated;
GRANT ALL ON public.service_package_workflow_map TO service_role;
ALTER TABLE public.service_package_workflow_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spwm_read_auth" ON public.service_package_workflow_map FOR SELECT TO authenticated USING (true);
CREATE POLICY "spwm_write_master" ON public.service_package_workflow_map FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master')) WITH CHECK (public.has_role(auth.uid(), 'master'));

-- 8) updated_at Trigger (generic)
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'work_object_origins','reference_number_sequences','workflow_templates',
    'workflow_template_steps','service_package_workflow_map'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_touch_%1$s ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER trg_touch_%1$s BEFORE UPDATE ON public.%1$s
                    FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at()', t);
  END LOOP;
END $$;

-- =========================================================
-- 9) Seeds: Origins
-- =========================================================
INSERT INTO public.work_object_origins (key, label_de, label_en, default_reference_type, sort_order) VALUES
  ('pilot_plant','Pilot Plant','Pilot Plant','experiment',10),
  ('production','Produktion','Production','serial',20),
  ('qc','Qualitätskontrolle','Quality Control','batch',30),
  ('lab','Labor','Laboratory','internal',40),
  ('complaint','Reklamation','Complaint','complaint',50),
  ('development','Entwicklung','Development','experiment',60),
  ('customer','Kundenauftrag','Customer Order','customer_ref',70)
ON CONFLICT (key) DO NOTHING;

-- Nummernkreise (aktuelles Jahr) je Origin
INSERT INTO public.reference_number_sequences (origin, reference_type, year, next_seq, pattern)
SELECT o.key, o.default_reference_type, EXTRACT(year FROM now())::int, 1,
  CASE o.key
    WHEN 'pilot_plant' THEN 'V{yy}-{seq:03}'
    WHEN 'production'  THEN 'SN-{yy}{seq:05}'
    WHEN 'qc'          THEN 'C{yy}-{seq:03}'
    WHEN 'lab'         THEN 'L{yy}-{seq:04}'
    WHEN 'complaint'   THEN 'R{yy}-{seq:03}'
    WHEN 'development' THEN 'E{yy}-{seq:03}'
    WHEN 'customer'    THEN 'K{yy}-{seq:04}'
  END
FROM public.work_object_origins o
ON CONFLICT (origin, reference_type, year) DO NOTHING;

-- =========================================================
-- 10) Seeds: Workflow-Vorlagen
-- =========================================================
INSERT INTO public.workflow_templates (key, name, description, origin) VALUES
  ('pp_standard','Pilot Plant Standardversuch','Kompletter Ablauf inkl. Verwiegen und Kneten','pilot_plant'),
  ('pp_support','Produktionsunterstützung','Fertige Masse angeliefert – ohne Verwiegen/Kneten','pilot_plant'),
  ('lab_standard','Laborprüfung','Standard-Laborprüfablauf','lab'),
  ('qc_standard','QC-Prüfung','Standard Qualitätskontrolle','qc'),
  ('complaint_standard','Reklamationsbearbeitung','Reklamations-Workflow','complaint')
ON CONFLICT (key) DO NOTHING;

-- Steps für pp_standard
INSERT INTO public.workflow_template_steps (template_id, order_index, step_key, name, role_required, is_mandatory, step_type)
SELECT t.id, v.ord, v.step_key, v.name, v.role_required, true, 'form'
FROM public.workflow_templates t
JOIN (VALUES
  (10,'weighing','Verwiegen','durchfuehrer'),
  (20,'kneading','Kneten','durchfuehrer'),
  (30,'extrusion','Extrusion','durchfuehrer'),
  (40,'drying','Trocknung','durchfuehrer'),
  (50,'firing','Brennen','durchfuehrer'),
  (60,'sampling','Probenerzeugung','durchfuehrer'),
  (70,'lab_tests','Laborprüfungen','durchfuehrer'),
  (80,'report','Bericht','durchfuehrer')
) AS v(ord, step_key, name, role_required) ON true
WHERE t.key = 'pp_standard'
ON CONFLICT (template_id, step_key) DO NOTHING;

-- Steps für pp_support (ohne weighing/kneading)
INSERT INTO public.workflow_template_steps (template_id, order_index, step_key, name, role_required, is_mandatory, step_type)
SELECT t.id, v.ord, v.step_key, v.name, v.role_required, true, 'form'
FROM public.workflow_templates t
JOIN (VALUES
  (30,'extrusion','Extrusion','durchfuehrer'),
  (40,'drying','Trocknung','durchfuehrer'),
  (50,'firing','Brennen','durchfuehrer'),
  (60,'sampling','Probenerzeugung','durchfuehrer'),
  (70,'lab_tests','Laborprüfungen','durchfuehrer'),
  (80,'report','Bericht','durchfuehrer')
) AS v(ord, step_key, name, role_required) ON true
WHERE t.key = 'pp_support'
ON CONFLICT (template_id, step_key) DO NOTHING;

-- Steps für lab_standard
INSERT INTO public.workflow_template_steps (template_id, order_index, step_key, name, role_required, is_mandatory, step_type)
SELECT t.id, v.ord, v.step_key, v.name, v.role_required, true, 'form'
FROM public.workflow_templates t
JOIN (VALUES
  (10,'sample_intake','Probeneingang','durchfuehrer'),
  (20,'measurement','Messung','durchfuehrer'),
  (30,'report','Bericht','durchfuehrer')
) AS v(ord, step_key, name, role_required) ON true
WHERE t.key = 'lab_standard'
ON CONFLICT (template_id, step_key) DO NOTHING;

-- Steps für qc_standard
INSERT INTO public.workflow_template_steps (template_id, order_index, step_key, name, role_required, is_mandatory, step_type)
SELECT t.id, v.ord, v.step_key, v.name, v.role_required, true, 'form'
FROM public.workflow_templates t
JOIN (VALUES
  (10,'sample_intake','Probeneingang','durchfuehrer'),
  (20,'qc_check','QC-Prüfung','durchfuehrer'),
  (30,'release','Freigabe','master')
) AS v(ord, step_key, name, role_required) ON true
WHERE t.key = 'qc_standard'
ON CONFLICT (template_id, step_key) DO NOTHING;

-- Steps für complaint_standard
INSERT INTO public.workflow_template_steps (template_id, order_index, step_key, name, role_required, is_mandatory, step_type)
SELECT t.id, v.ord, v.step_key, v.name, v.role_required, true, 'form'
FROM public.workflow_templates t
JOIN (VALUES
  (10,'intake','Aufnahme','auftraggeber'),
  (20,'investigation','Untersuchung','durchfuehrer'),
  (30,'root_cause','Ursachenanalyse','durchfuehrer'),
  (40,'response','Kundenantwort','master')
) AS v(ord, step_key, name, role_required) ON true
WHERE t.key = 'complaint_standard'
ON CONFLICT (template_id, step_key) DO NOTHING;

-- Default-Vorlagen an Origins hängen
UPDATE public.work_object_origins o SET default_workflow_template_id = t.id
FROM public.workflow_templates t
WHERE (o.key,'x') IN (
  ('pilot_plant', CASE WHEN t.key='pp_standard' THEN 'x' END),
  ('lab',         CASE WHEN t.key='lab_standard' THEN 'x' END),
  ('qc',          CASE WHEN t.key='qc_standard' THEN 'x' END),
  ('complaint',   CASE WHEN t.key='complaint_standard' THEN 'x' END),
  ('development', CASE WHEN t.key='pp_standard' THEN 'x' END)
);

-- =========================================================
-- 11) Backfill bestehende Aufträge
-- =========================================================
UPDATE public.measurement_orders
SET origin = CASE
    WHEN order_kind = 'labor' THEN 'lab'
    WHEN order_kind = 'combined' THEN 'pilot_plant'
    ELSE 'pilot_plant'
  END
WHERE origin IS NULL;

UPDATE public.measurement_orders
SET reference_type = CASE
    WHEN origin = 'lab' THEN 'internal'::public.reference_type
    ELSE 'experiment'::public.reference_type
  END
WHERE reference_type IS NULL;

UPDATE public.measurement_orders
SET reference_number = COALESCE(NULLIF(pp_experiment_number,''), order_number)
WHERE reference_number IS NULL;
