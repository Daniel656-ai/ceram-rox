DROP POLICY IF EXISTS "Members masters and viewers can view projects" ON public.projects;

CREATE POLICY "Members masters and viewers can view projects"
ON public.projects
FOR SELECT
USING (
  has_role(auth.uid(), 'master'::app_role)
  OR is_project_member(auth.uid(), id)
  OR (
    NOT has_role(auth.uid(), 'auftraggeber'::app_role)
    AND (
      has_permission(auth.uid(), 'projects.view'::text)
      OR has_permission(auth.uid(), 'admin.system'::text)
    )
  )
);