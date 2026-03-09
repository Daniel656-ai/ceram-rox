
-- Create sample status enum
CREATE TYPE public.sample_status AS ENUM (
  'neu', 'eingelagert', 'in_bearbeitung', 'teilweise_verbraucht',
  'vollstaendig_verbraucht', 'entsorgt', 'zurueckgesendet'
);

-- Create post measurement action enum
CREATE TYPE public.post_measurement_action AS ENUM (
  'aufbewahren', 'entsorgen', 'zurueck', 'andere'
);

-- Extend samples table
ALTER TABLE public.samples
  ADD COLUMN status public.sample_status NOT NULL DEFAULT 'neu',
  ADD COLUMN post_measurement_action public.post_measurement_action,
  ADD COLUMN post_measurement_action_text text,
  ADD COLUMN storage_min_duration text,
  ADD COLUMN storage_hints text,
  ADD COLUMN storage_expiry_date date,
  ADD COLUMN disposal_method text,
  ADD COLUMN disposal_hints text,
  ADD COLUMN disposal_category text,
  ADD COLUMN hazard_categories jsonb DEFAULT '[]',
  ADD COLUMN is_hazardous boolean NOT NULL DEFAULT false,
  ADD COLUMN location_id uuid REFERENCES public.storage_locations(id),
  ADD COLUMN parent_sample_id uuid REFERENCES public.samples(id),
  ADD COLUMN current_holder_id uuid;

-- Create sample_history table (audit trail - no update/delete)
CREATE TABLE public.sample_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id uuid NOT NULL REFERENCES public.samples(id) ON DELETE CASCADE,
  action text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  comment text,
  metadata jsonb DEFAULT '{}'
);
ALTER TABLE public.sample_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read sample history"
  ON public.sample_history FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users insert sample history"
  ON public.sample_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create sample_documents table
CREATE TABLE public.sample_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id uuid NOT NULL REFERENCES public.samples(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text,
  storage_path text NOT NULL,
  document_type text NOT NULL DEFAULT 'sicherheitsdatenblatt',
  uploaded_by uuid NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sample_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read sample docs"
  ON public.sample_documents FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allowed roles manage sample docs"
  ON public.sample_documents FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'auftraggeber'::app_role) OR has_role(auth.uid(), 'durchfuehrer'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'auftraggeber'::app_role) OR has_role(auth.uid(), 'durchfuehrer'::app_role));

-- Storage bucket for sample documents
INSERT INTO storage.buckets (id, name, public) VALUES ('sample-documents', 'sample-documents', false);

CREATE POLICY "Authenticated upload sample docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sample-documents');

CREATE POLICY "Authenticated read sample docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sample-documents');

CREATE POLICY "Authenticated delete sample docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'sample-documents');
