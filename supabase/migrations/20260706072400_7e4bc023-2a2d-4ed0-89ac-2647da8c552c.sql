
-- =========================================
-- Service Field Templates (Vorlagen-Bibliothek pro Upload-Feld)
-- =========================================
CREATE TABLE public.service_field_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_data_field_id uuid NOT NULL REFERENCES public.service_data_fields(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size_bytes bigint,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_field_templates TO authenticated;
GRANT ALL ON public.service_field_templates TO service_role;

ALTER TABLE public.service_field_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sft_read_authenticated"
  ON public.service_field_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "sft_write_master"
  ON public.service_field_templates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER trg_service_field_templates_updated
  BEFORE UPDATE ON public.service_field_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_sft_field ON public.service_field_templates(service_data_field_id, sort_order);

-- =========================================
-- Order Upload Files (mit dem Auftrag verknüpfte Uploads)
-- =========================================
CREATE TABLE public.order_upload_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  measurement_id uuid NOT NULL REFERENCES public.order_measurements(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  entry_index integer,
  template_id uuid REFERENCES public.service_field_templates(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_upload_files TO authenticated;
GRANT ALL ON public.order_upload_files TO service_role;

ALTER TABLE public.order_upload_files ENABLE ROW LEVEL SECURITY;

-- Read: master, order creator, assigned technician
CREATE POLICY "ouf_read"
  ON public.order_upload_files FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'master'::app_role)
    OR public.is_order_creator_via_measurement(auth.uid(), measurement_id)
    OR public.is_assigned_to_measurement(auth.uid(), measurement_id)
  );

-- Insert: any authenticated user who is master or the order creator
CREATE POLICY "ouf_insert"
  ON public.order_upload_files FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND (
      public.has_role(auth.uid(), 'master'::app_role)
      OR public.is_order_creator_via_measurement(auth.uid(), measurement_id)
      OR public.is_assigned_to_measurement(auth.uid(), measurement_id)
    )
  );

-- Delete: master or original uploader
CREATE POLICY "ouf_delete"
  ON public.order_upload_files FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'master'::app_role)
    OR uploaded_by = auth.uid()
  );

CREATE INDEX idx_ouf_measurement ON public.order_upload_files(measurement_id);
CREATE INDEX idx_ouf_field ON public.order_upload_files(measurement_id, field_key);

-- =========================================
-- Storage policies for bucket "order-uploads"
-- =========================================

-- Read: any authenticated user (app-level checks filter by measurement)
CREATE POLICY "order_uploads_read_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'order-uploads');

-- Insert into orders/... : authenticated (app enforces per-measurement)
CREATE POLICY "order_uploads_insert_orders"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'order-uploads'
    AND (storage.foldername(name))[1] = 'orders'
  );

-- Delete own uploads in orders/...
CREATE POLICY "order_uploads_delete_orders"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'order-uploads'
    AND (storage.foldername(name))[1] = 'orders'
    AND (owner = auth.uid() OR public.has_role(auth.uid(), 'master'::app_role))
  );

-- Templates: only master may write/delete
CREATE POLICY "order_uploads_insert_templates_master"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'order-uploads'
    AND (storage.foldername(name))[1] = 'templates'
    AND public.has_role(auth.uid(), 'master'::app_role)
  );

CREATE POLICY "order_uploads_delete_templates_master"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'order-uploads'
    AND (storage.foldername(name))[1] = 'templates'
    AND public.has_role(auth.uid(), 'master'::app_role)
  );
