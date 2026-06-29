
CREATE TABLE public.project_services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.measurement_services(id) ON DELETE RESTRICT,
  booked_by uuid NOT NULL,
  booked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_services_project ON public.project_services(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_services TO authenticated;
GRANT ALL ON public.project_services TO service_role;

ALTER TABLE public.project_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View project services if project member or master"
  ON public.project_services FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'master'::app_role)
    OR public.is_project_member(auth.uid(), project_id)
    OR public.has_permission(auth.uid(), 'projects.view')
  );

CREATE POLICY "Insert project services if can edit project"
  ON public.project_services FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_edit_project_governance(auth.uid(), project_id)
  );

CREATE POLICY "Delete project services if can edit project"
  ON public.project_services FOR DELETE
  TO authenticated
  USING (
    public.can_edit_project_governance(auth.uid(), project_id)
  );
