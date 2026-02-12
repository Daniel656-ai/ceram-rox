
CREATE POLICY "Creators and masters can delete projects"
ON public.projects
FOR DELETE
USING (created_by = auth.uid() OR has_role(auth.uid(), 'master'::app_role));
