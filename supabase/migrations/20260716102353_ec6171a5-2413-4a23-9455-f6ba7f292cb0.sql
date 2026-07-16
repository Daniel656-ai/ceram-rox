
CREATE TABLE public.form_role_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_definition_id uuid NOT NULL REFERENCES public.form_definitions(id) ON DELETE CASCADE,
  role_key text NOT NULL,
  label text NOT NULL,
  layout jsonb NOT NULL DEFAULT '{"version":1,"nodes":[]}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(form_definition_id, role_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_role_views TO authenticated;
GRANT ALL ON public.form_role_views TO service_role;
ALTER TABLE public.form_role_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "form_role_views select" ON public.form_role_views FOR SELECT TO authenticated USING (true);
CREATE POLICY "form_role_views manage" ON public.form_role_views FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'admin.system'))
  WITH CHECK (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'admin.system'));
CREATE TRIGGER trg_form_role_views_updated_at BEFORE UPDATE ON public.form_role_views
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.form_field_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_definition_id uuid NOT NULL REFERENCES public.form_definitions(id) ON DELETE CASCADE,
  role_key text NOT NULL,
  field_id uuid NOT NULL REFERENCES public.form_fields(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'write' CHECK (visibility IN ('hidden','read','write')),
  required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(form_definition_id, role_key, field_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_field_permissions TO authenticated;
GRANT ALL ON public.form_field_permissions TO service_role;
ALTER TABLE public.form_field_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "form_field_permissions select" ON public.form_field_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "form_field_permissions manage" ON public.form_field_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'admin.system'))
  WITH CHECK (public.has_role(auth.uid(),'master') OR public.has_permission(auth.uid(),'admin.system'));
CREATE TRIGGER trg_form_field_permissions_updated_at BEFORE UPDATE ON public.form_field_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_ffp_form_role ON public.form_field_permissions(form_definition_id, role_key);

ALTER TABLE public.process_steps
  ADD COLUMN IF NOT EXISTS role_view_key text,
  ADD COLUMN IF NOT EXISTS locked_field_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
