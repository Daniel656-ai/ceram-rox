
-- Storage locations hierarchy
CREATE TABLE public.storage_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hall text NOT NULL,
  room text,
  shelf text,
  position text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.storage_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read locations" ON public.storage_locations
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Masters manage locations" ON public.storage_locations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Raw materials master data
CREATE TABLE public.raw_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_name text NOT NULL,
  material_number text NOT NULL UNIQUE,
  supplier text,
  description text,
  unit text NOT NULL DEFAULT 'kg',
  default_location_id uuid REFERENCES public.storage_locations(id),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read materials" ON public.raw_materials
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Masters and auftraggeber manage materials" ON public.raw_materials
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'auftraggeber'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'auftraggeber'::app_role));

-- Batches / Chargen
CREATE TABLE public.raw_material_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  batch_number text NOT NULL,
  delivery_date date,
  delivery_quantity numeric,
  supplier text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.raw_material_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read batches" ON public.raw_material_batches
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Masters and auftraggeber manage batches" ON public.raw_material_batches
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'auftraggeber'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'auftraggeber'::app_role));

-- Documents for raw materials
CREATE TABLE public.raw_material_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.raw_material_batches(id) ON DELETE SET NULL,
  document_type text NOT NULL DEFAULT 'zertifikat',
  file_name text NOT NULL,
  file_type text,
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.raw_material_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read rm docs" ON public.raw_material_documents
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Masters and auftraggeber manage rm docs" ON public.raw_material_documents
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'auftraggeber'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'auftraggeber'::app_role));

-- Flexible analysis data (key-value)
CREATE TABLE public.raw_material_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.raw_material_batches(id) ON DELETE SET NULL,
  analysis_type text NOT NULL DEFAULT 'allgemein',
  parameter_name text NOT NULL,
  value numeric,
  text_value text,
  unit text,
  min_limit numeric,
  max_limit numeric,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.raw_material_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read analyses" ON public.raw_material_analyses
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Masters and auftraggeber manage analyses" ON public.raw_material_analyses
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'auftraggeber'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'auftraggeber'::app_role));

-- Inventory movements (Wareneingang / Verbrauch)
CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.raw_material_batches(id) ON DELETE SET NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('eingang', 'verbrauch')),
  quantity numeric NOT NULL,
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  supplier text,
  project_reference text,
  comment text,
  certificate_document_id uuid REFERENCES public.raw_material_documents(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read movements" ON public.inventory_movements
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Masters and auftraggeber manage movements" ON public.inventory_movements
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'auftraggeber'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'auftraggeber'::app_role));

-- Storage bucket for raw material documents
INSERT INTO storage.buckets (id, name, public) VALUES ('raw-material-documents', 'raw-material-documents', false);

CREATE POLICY "Authenticated users upload rm docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'raw-material-documents');

CREATE POLICY "Authenticated users read rm docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'raw-material-documents');
