
-- Allow custom roles with the 'projects.create' permission key (e.g. PMO) to insert projects.
DROP POLICY IF EXISTS "Auftraggeber and masters create projects" ON public.projects;
CREATE POLICY "Authorized users create projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND (
    public.has_role(auth.uid(), 'master'::app_role)
    OR public.has_role(auth.uid(), 'auftraggeber'::app_role)
    OR public.has_permission(auth.uid(), 'projects.create')
  )
);

-- Allow custom roles with the 'projects.edit' permission key to update projects.
DROP POLICY IF EXISTS "Owner leader master update projects" ON public.projects;
CREATE POLICY "Authorized users update projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'master'::app_role)
  OR public.has_project_role(auth.uid(), id, 'owner'::project_role)
  OR public.has_project_role(auth.uid(), id, 'leader'::project_role)
  OR public.has_permission(auth.uid(), 'projects.edit')
);
