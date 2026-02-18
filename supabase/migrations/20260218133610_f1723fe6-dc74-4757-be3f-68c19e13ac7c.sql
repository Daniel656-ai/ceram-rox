
-- Sequence for sample numbers, resets conceptually per year via the function
CREATE SEQUENCE IF NOT EXISTS public.sample_number_seq START 1;

-- Samples table
CREATE TABLE public.samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_number text NOT NULL UNIQUE,
  sample_name text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id),
  description text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Function to auto-generate sample_number as YYNNNN
CREATE OR REPLACE FUNCTION public.generate_sample_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_yy text;
  next_val int;
  max_existing int;
BEGIN
  current_yy := to_char(now(), 'YY');
  
  -- Find the max counter for the current year
  SELECT COALESCE(MAX(substring(sample_number from 3)::int), 0)
  INTO max_existing
  FROM public.samples
  WHERE sample_number LIKE current_yy || '%'
  FOR UPDATE; -- lock to prevent duplicates
  
  next_val := max_existing + 1;
  
  NEW.sample_number := current_yy || lpad(next_val::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_sample_number
  BEFORE INSERT ON public.samples
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_sample_number();

-- Updated_at trigger
CREATE TRIGGER update_samples_updated_at
  BEFORE UPDATE ON public.samples
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.samples ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users can view samples
CREATE POLICY "All authenticated can read samples"
  ON public.samples FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: auftraggeber, durchfuehrer, master can create
CREATE POLICY "Allowed roles can create samples"
  ON public.samples FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND (
      has_role(auth.uid(), 'auftraggeber'::app_role)
      OR has_role(auth.uid(), 'durchfuehrer'::app_role)
      OR has_role(auth.uid(), 'master'::app_role)
    )
  );

-- UPDATE: creator or master
CREATE POLICY "Creator and masters can update samples"
  ON public.samples FOR UPDATE
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'master'::app_role));

-- DELETE: creator or master
CREATE POLICY "Creator and masters can delete samples"
  ON public.samples FOR DELETE
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'master'::app_role));
