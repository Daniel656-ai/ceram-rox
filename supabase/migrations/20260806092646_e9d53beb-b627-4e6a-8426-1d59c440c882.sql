CREATE TABLE public.global_list_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.global_lists(id) ON DELETE CASCADE,
  attribute_key text NOT NULL,
  display_name text NOT NULL,
  data_type text NOT NULL DEFAULT 'text',
  unit text,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_required boolean NOT NULL DEFAULT false,
  show_in_table boolean NOT NULL DEFAULT true,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_id, attribute_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_list_attributes TO authenticated;
GRANT ALL ON public.global_list_attributes TO service_role;

ALTER TABLE public.global_list_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read master data attributes"
ON public.global_list_attributes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage master data attributes"
ON public.global_list_attributes FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'admin.system') OR public.has_role(auth.uid(), 'master'))
WITH CHECK (public.has_permission(auth.uid(), 'admin.system') OR public.has_role(auth.uid(), 'master'));

CREATE TRIGGER trg_global_list_attributes_updated_at
BEFORE UPDATE ON public.global_list_attributes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.global_list_items
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;