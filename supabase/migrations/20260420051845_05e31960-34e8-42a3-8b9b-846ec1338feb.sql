-- 1. Migrate project_milestones: add milestone_date, drop start/end
ALTER TABLE public.project_milestones
  ADD COLUMN milestone_date date;

-- Migrate existing data: prefer end_date, fallback start_date
UPDATE public.project_milestones
SET milestone_date = COALESCE(end_date, start_date)
WHERE milestone_date IS NULL;

ALTER TABLE public.project_milestones
  DROP COLUMN start_date,
  DROP COLUMN end_date;

-- 2. Create project_work_packages
CREATE TABLE public.project_work_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES public.project_milestones(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  start_date date,
  end_date date,
  status public.milestone_status NOT NULL DEFAULT 'planned',
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.project_work_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members and masters see work packages"
  ON public.project_work_packages FOR SELECT
  USING (has_role(auth.uid(), 'master'::app_role) OR is_project_member(auth.uid(), project_id));

CREATE POLICY "Leader and master manage work packages"
  ON public.project_work_packages FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_project_role(auth.uid(), project_id, 'leader'::project_role));

CREATE POLICY "Leader and master update work packages"
  ON public.project_work_packages FOR UPDATE
  USING (has_role(auth.uid(), 'master'::app_role) OR has_project_role(auth.uid(), project_id, 'leader'::project_role));

CREATE POLICY "Leader and master delete work packages"
  ON public.project_work_packages FOR DELETE
  USING (has_role(auth.uid(), 'master'::app_role) OR has_project_role(auth.uid(), project_id, 'leader'::project_role));

CREATE TRIGGER update_project_work_packages_updated_at
  BEFORE UPDATE ON public.project_work_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create project_work_package_assignees
CREATE TABLE public.project_work_package_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_package_id uuid NOT NULL REFERENCES public.project_work_packages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (work_package_id, user_id)
);

ALTER TABLE public.project_work_package_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members and masters see wp assignees"
  ON public.project_work_package_assignees FOR SELECT
  USING (
    has_role(auth.uid(), 'master'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.project_work_packages wp
      WHERE wp.id = work_package_id
        AND is_project_member(auth.uid(), wp.project_id)
    )
  );

CREATE POLICY "Leader and master manage wp assignees"
  ON public.project_work_package_assignees FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'master'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.project_work_packages wp
      WHERE wp.id = work_package_id
        AND has_project_role(auth.uid(), wp.project_id, 'leader'::project_role)
    )
  );

CREATE POLICY "Leader and master delete wp assignees"
  ON public.project_work_package_assignees FOR DELETE
  USING (
    has_role(auth.uid(), 'master'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.project_work_packages wp
      WHERE wp.id = work_package_id
        AND has_project_role(auth.uid(), wp.project_id, 'leader'::project_role)
    )
  );

CREATE INDEX idx_work_packages_project ON public.project_work_packages(project_id);
CREATE INDEX idx_work_packages_milestone ON public.project_work_packages(milestone_id);
CREATE INDEX idx_wp_assignees_wp ON public.project_work_package_assignees(work_package_id);
CREATE INDEX idx_wp_assignees_user ON public.project_work_package_assignees(user_id);