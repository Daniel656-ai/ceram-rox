DROP POLICY IF EXISTS "Members and masters can view projects" ON public.projects;
CREATE POLICY "Members masters and viewers can view projects"
ON public.projects FOR SELECT
USING (
  has_role(auth.uid(), 'master'::app_role)
  OR is_project_member(auth.uid(), id)
  OR has_permission(auth.uid(), 'projects.view'::text)
  OR has_permission(auth.uid(), 'admin.system'::text)
);