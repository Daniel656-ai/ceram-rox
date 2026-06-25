
CREATE TABLE public.custom_symbols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('ghs','psa')),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  image_data_url text NOT NULL,
  mime_type text NOT NULL,
  file_size integer,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (category, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_symbols TO authenticated;
GRANT ALL ON public.custom_symbols TO service_role;

ALTER TABLE public.custom_symbols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_symbols_select_authenticated"
  ON public.custom_symbols FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "custom_symbols_insert_admin"
  ON public.custom_symbols FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'admin.system'));

CREATE POLICY "custom_symbols_update_admin"
  ON public.custom_symbols FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'admin.system'))
  WITH CHECK (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'admin.system'));

CREATE POLICY "custom_symbols_delete_admin"
  ON public.custom_symbols FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'admin.system'));

CREATE TRIGGER trg_custom_symbols_updated_at
  BEFORE UPDATE ON public.custom_symbols
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
