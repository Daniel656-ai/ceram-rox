
-- Add project-wide access permission for Weekly Reviews
-- Extends SELECT, INSERT and adds UPDATE for users with 'weekly_reviews.manage_all'

DROP POLICY IF EXISTS weekly_reviews_select ON public.project_weekly_reviews;
CREATE POLICY weekly_reviews_select
  ON public.project_weekly_reviews
  FOR SELECT
  TO authenticated
  USING (
    is_project_member(auth.uid(), project_id)
    OR has_role(auth.uid(), 'master'::app_role)
    OR has_permission(auth.uid(), 'projects.view_all')
    OR has_permission(auth.uid(), 'weekly_reviews.manage_all')
  );

DROP POLICY IF EXISTS weekly_reviews_insert ON public.project_weekly_reviews;
CREATE POLICY weekly_reviews_insert
  ON public.project_weekly_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND (
      is_project_member(auth.uid(), project_id)
      OR has_role(auth.uid(), 'master'::app_role)
      OR has_permission(auth.uid(), 'weekly_reviews.manage_all')
    )
  );

DROP POLICY IF EXISTS weekly_reviews_update ON public.project_weekly_reviews;
CREATE POLICY weekly_reviews_update
  ON public.project_weekly_reviews
  FOR UPDATE
  TO authenticated
  USING (
    author_user_id = auth.uid()
    OR has_role(auth.uid(), 'master'::app_role)
    OR has_permission(auth.uid(), 'weekly_reviews.manage_all')
  )
  WITH CHECK (
    author_user_id = auth.uid()
    OR has_role(auth.uid(), 'master'::app_role)
    OR has_permission(auth.uid(), 'weekly_reviews.manage_all')
  );

-- Grant the new permission to the PMO custom role and to the Administrator role
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT id, 'weekly_reviews.manage_all' FROM public.custom_roles WHERE lower(name) = 'pmo'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key)
VALUES ('00000000-0000-0000-0000-000000000001', 'weekly_reviews.manage_all')
ON CONFLICT DO NOTHING;
