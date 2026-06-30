DROP POLICY IF EXISTS "Authorized users create projects" ON public.projects;
CREATE POLICY "Authorized users create projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND (
    has_role(auth.uid(), 'master'::app_role)
    OR has_permission(auth.uid(), 'projects.create')
  )
);