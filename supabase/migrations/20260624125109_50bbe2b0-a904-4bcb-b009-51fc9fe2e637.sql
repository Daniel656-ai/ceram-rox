
-- Weekly Reviews: immutable wöchentliche Projektstatus-Snapshots
CREATE TABLE IF NOT EXISTS public.project_weekly_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL,
  author_role_snapshot text NOT NULL DEFAULT 'member',
  iso_year int NOT NULL,
  iso_week int NOT NULL CHECK (iso_week BETWEEN 1 AND 53),
  review_date date NOT NULL DEFAULT CURRENT_DATE,
  completed_this_week text NOT NULL DEFAULT '',
  currently_working_on text NOT NULL DEFAULT '',
  next_steps text NOT NULL DEFAULT '',
  help_needed text NOT NULL DEFAULT '',
  risks text NOT NULL DEFAULT '',
  other_comments text NOT NULL DEFAULT '',
  overall_rating smallint NOT NULL CHECK (overall_rating BETWEEN 1 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_weekly_reviews_unique_per_week UNIQUE (project_id, author_user_id, iso_year, iso_week)
);

CREATE INDEX IF NOT EXISTS idx_pwr_project ON public.project_weekly_reviews(project_id, review_date DESC);
CREATE INDEX IF NOT EXISTS idx_pwr_author ON public.project_weekly_reviews(author_user_id, review_date DESC);
CREATE INDEX IF NOT EXISTS idx_pwr_week ON public.project_weekly_reviews(iso_year, iso_week);

GRANT SELECT, INSERT ON public.project_weekly_reviews TO authenticated;
GRANT ALL ON public.project_weekly_reviews TO service_role;

ALTER TABLE public.project_weekly_reviews ENABLE ROW LEVEL SECURITY;

-- SELECT: Projektmitglieder oder Master/PMO mit projects.view_all
CREATE POLICY "weekly_reviews_select"
ON public.project_weekly_reviews
FOR SELECT
TO authenticated
USING (
  public.is_project_member(auth.uid(), project_id)
  OR public.has_role(auth.uid(), 'master'::app_role)
  OR public.has_permission(auth.uid(), 'projects.view_all')
);

-- INSERT: Projektmitglieder, nur eigener author
CREATE POLICY "weekly_reviews_insert"
ON public.project_weekly_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  author_user_id = auth.uid()
  AND public.is_project_member(auth.uid(), project_id)
);

-- Bewusst keine UPDATE/DELETE Policies → immutable Snapshots
-- Master darf löschen (Korrekturen) via separater Policy:
CREATE POLICY "weekly_reviews_delete_master"
ON public.project_weekly_reviews
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'master'::app_role));

-- Neue Permissions registrieren
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT cr.id, perm.key
FROM public.custom_roles cr
CROSS JOIN (VALUES ('weekly_reviews.create'), ('weekly_reviews.view'), ('weekly_reviews.view_all')) AS perm(key)
WHERE cr.id = '00000000-0000-0000-0000-000000000001'  -- master
ON CONFLICT DO NOTHING;
