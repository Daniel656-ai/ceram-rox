-- ============ Kundenstamm (Grundlage für spätere Kundenverwaltung / CRM) ============
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_number text UNIQUE,
  name text NOT NULL,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country text,
  website text,
  email text,
  phone text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_read" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers_write" ON public.customers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'customers.manage') OR public.has_permission(auth.uid(),'production_releases.edit'))
  WITH CHECK (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'customers.manage') OR public.has_permission(auth.uid(),'production_releases.edit'));

CREATE TABLE IF NOT EXISTS public.customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  role_title text,
  email text,
  phone text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_contacts TO authenticated;
GRANT ALL ON public.customer_contacts TO service_role;
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer_contacts_read" ON public.customer_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "customer_contacts_write" ON public.customer_contacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'customers.manage'))
  WITH CHECK (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'customers.manage'));

-- Projekte: optionale stabile Kundenreferenz (bestehende Freitextdaten bleiben unangetastet)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id);

-- ============ Fertigungsfreigaben ============
DO $$ BEGIN
  CREATE TYPE public.production_release_status AS ENUM ('entwurf','in_pruefung','freigegeben','abgeschlossen');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.production_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status public.production_release_status NOT NULL DEFAULT 'entwurf',
  project_id uuid REFERENCES public.projects(id),
  project_name text,
  customer_id uuid REFERENCES public.customers(id),
  customer_name text,
  end_customer text,
  sales_owner text,
  cost_center_code text,
  recipe text,
  recipe_mixture_id uuid REFERENCES public.mixtures(id),
  product_type text,
  article_number text,
  drawing_approval text,
  delivery_date date,
  completion_date date,
  delivery_address text,
  delivery_terms text,
  packaging text,
  freight_costs numeric,
  piece_count integer,
  elements_total integer,
  normal_modules integer,
  test_modules integer,
  spare_elements integer,
  sample_elements integer,
  module_material text,
  accessories text,
  module_costs numeric,
  accessory_costs numeric,
  costs_per_module numeric,
  module_numbering text,
  test_elements_per_module integer,
  module_flow text,
  length_mm numeric,
  length_tolerance text,
  cross_section_mm numeric,
  cross_section_tolerance text,
  inner_wall_thickness_mm numeric,
  inner_wall_tolerance text,
  target_geometry text,
  cell_configuration text,
  cellularity_item_id uuid REFERENCES public.global_list_items(id),
  v2o5_percent numeric,
  sorting_criteria text,
  test_conditions_remarks text,
  qa_qc_requirements text,
  remarks text,
  form_definition_id uuid REFERENCES public.form_definitions(id),
  form_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_type text NOT NULL DEFAULT 'manual',
  source_document_path text,
  source_document_name text,
  field_sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz,
  imported_by uuid REFERENCES auth.users(id),
  released_at timestamptz,
  released_by uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_releases TO authenticated;
GRANT ALL ON public.production_releases TO service_role;
ALTER TABLE public.production_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_releases_read" ON public.production_releases FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'production_releases.view'));
CREATE POLICY "production_releases_insert" ON public.production_releases FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'production_releases.create'));
CREATE POLICY "production_releases_update" ON public.production_releases FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'production_releases.edit') OR public.has_permission(auth.uid(),'production_releases.approve'))
  WITH CHECK (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'production_releases.edit') OR public.has_permission(auth.uid(),'production_releases.approve'));
CREATE POLICY "production_releases_delete" ON public.production_releases FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'production_releases.delete'));

CREATE INDEX IF NOT EXISTS idx_production_releases_status ON public.production_releases(status);
CREATE INDEX IF NOT EXISTS idx_production_releases_customer ON public.production_releases(customer_id);
CREATE INDEX IF NOT EXISTS idx_production_releases_project ON public.production_releases(project_id);

CREATE TABLE IF NOT EXISTS public.production_release_test_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES public.production_releases(id) ON DELETE CASCADE,
  section text NOT NULL,
  section_label text,
  parameter_key text NOT NULL,
  parameter_label text,
  value_num numeric,
  value_text text,
  unit text,
  sort_order integer NOT NULL DEFAULT 0,
  source_type text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_release_test_parameters TO authenticated;
GRANT ALL ON public.production_release_test_parameters TO service_role;
ALTER TABLE public.production_release_test_parameters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prtp_read" ON public.production_release_test_parameters FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'production_releases.view'));
CREATE POLICY "prtp_write" ON public.production_release_test_parameters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'production_releases.edit') OR public.has_permission(auth.uid(),'production_releases.create'))
  WITH CHECK (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'production_releases.edit') OR public.has_permission(auth.uid(),'production_releases.create'));
CREATE INDEX IF NOT EXISTS idx_prtp_release ON public.production_release_test_parameters(release_id);

CREATE TABLE IF NOT EXISTS public.production_release_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid REFERENCES public.production_releases(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  storage_path text,
  raw_text text,
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_release_imports TO authenticated;
GRANT ALL ON public.production_release_imports TO service_role;
ALTER TABLE public.production_release_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pri_read" ON public.production_release_imports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'production_releases.view'));
CREATE POLICY "pri_write" ON public.production_release_imports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'production_releases.import'))
  WITH CHECK (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'production_releases.import'));

CREATE TABLE IF NOT EXISTS public.production_release_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  default_form_definition_id uuid REFERENCES public.form_definitions(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_release_settings TO authenticated;
GRANT ALL ON public.production_release_settings TO service_role;
ALTER TABLE public.production_release_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prs_read" ON public.production_release_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "prs_write" ON public.production_release_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'production_releases.edit'))
  WITH CHECK (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'production_releases.edit'));
INSERT INTO public.production_release_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_customer_contacts_updated_at BEFORE UPDATE ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_production_releases_updated_at BEFORE UPDATE ON public.production_releases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_prtp_updated_at BEFORE UPDATE ON public.production_release_test_parameters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_prs_updated_at BEFORE UPDATE ON public.production_release_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Dateiregeln für den (separat angelegten) Bucket production-releases
CREATE POLICY "production_releases_files_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'production-releases' AND (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'production_releases.view')));
CREATE POLICY "production_releases_files_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'production-releases' AND (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'production_releases.import')));
CREATE POLICY "production_releases_files_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'production-releases' AND (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'production_releases.delete')));