DROP POLICY "Users see own projects" ON public.projects;

CREATE POLICY "All authenticated users can view projects"
  ON public.projects
  FOR SELECT
  USING (auth.uid() IS NOT NULL);