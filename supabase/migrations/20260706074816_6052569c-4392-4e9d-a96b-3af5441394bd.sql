
-- Audit log for changes of project_number / project_name
CREATE TABLE public.project_change_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_change_log_project ON public.project_change_log(project_id, created_at DESC);

GRANT SELECT, INSERT ON public.project_change_log TO authenticated;
GRANT ALL ON public.project_change_log TO service_role;

ALTER TABLE public.project_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view project change log"
ON public.project_change_log FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert project change log"
ON public.project_change_log FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = changed_by);

-- Trigger to auto-log changes to project_number and project_name
CREATE OR REPLACE FUNCTION public.log_project_identity_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.project_number IS DISTINCT FROM OLD.project_number THEN
    INSERT INTO public.project_change_log (project_id, changed_by, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'project_number', OLD.project_number, NEW.project_number);
  END IF;
  IF NEW.project_name IS DISTINCT FROM OLD.project_name THEN
    INSERT INTO public.project_change_log (project_id, changed_by, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'project_name', OLD.project_name, NEW.project_name);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_project_identity_changes
AFTER UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.log_project_identity_changes();
