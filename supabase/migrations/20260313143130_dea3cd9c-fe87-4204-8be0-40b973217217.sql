
CREATE TABLE public.project_time_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  person_id uuid NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes integer NOT NULL,
  note text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT duration_multiple_of_15 CHECK (duration_minutes > 0 AND duration_minutes % 15 = 0)
);

ALTER TABLE public.project_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read project_time_entries"
  ON public.project_time_entries FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Masters and auftraggeber manage project_time_entries"
  ON public.project_time_entries FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'auftraggeber'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'auftraggeber'::app_role));

CREATE TRIGGER update_project_time_entries_updated_at
  BEFORE UPDATE ON public.project_time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
