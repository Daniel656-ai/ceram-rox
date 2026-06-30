
CREATE TYPE public.service_version_entity AS ENUM ('form_layout', 'document_template', 'block');
CREATE TYPE public.service_version_status AS ENUM ('draft', 'published', 'archived');

CREATE TABLE public.service_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.service_version_entity NOT NULL,
  entity_id uuid NOT NULL,
  service_id uuid NULL,
  version_no int NOT NULL,
  label text NULL,
  status public.service_version_status NOT NULL DEFAULT 'draft',
  snapshot jsonb NOT NULL,
  change_summary text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NULL,
  published_by uuid NULL,
  UNIQUE (entity_type, entity_id, version_no)
);

CREATE INDEX idx_service_versions_entity ON public.service_versions (entity_type, entity_id, version_no DESC);
CREATE INDEX idx_service_versions_service ON public.service_versions (service_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_versions TO authenticated;
GRANT ALL ON public.service_versions TO service_role;

ALTER TABLE public.service_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_versions_select_auth"
  ON public.service_versions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "service_versions_insert_admin"
  ON public.service_versions FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'master'::app_role)
    OR public.has_permission(auth.uid(), 'admin.system')
  );

CREATE POLICY "service_versions_update_admin"
  ON public.service_versions FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'master'::app_role)
    OR public.has_permission(auth.uid(), 'admin.system')
  );

CREATE POLICY "service_versions_delete_admin"
  ON public.service_versions FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'master'::app_role)
    OR public.has_permission(auth.uid(), 'admin.system')
  );
