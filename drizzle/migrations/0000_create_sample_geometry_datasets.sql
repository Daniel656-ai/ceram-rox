-- Gemeinsame Geometriedaten je Probe und Geometrieart.
-- Additiv: bestehende Tabellen, Messungen und Ergebnisse bleiben unverändert.
CREATE TABLE public.sample_geometry_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id uuid NOT NULL REFERENCES public.samples(id) ON DELETE CASCADE,
  -- Fachliche Geometrieart, z. B. 'wabenkoerper' oder 'platte'.
  geometry_kind text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sample_geometry_datasets_kind_not_empty CHECK (length(btrim(geometry_kind)) > 0),
  CONSTRAINT sample_geometry_datasets_unique UNIQUE (sample_id, geometry_kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sample_geometry_datasets TO authenticated;
GRANT ALL ON public.sample_geometry_datasets TO service_role;

ALTER TABLE public.sample_geometry_datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read geometry datasets"
  ON public.sample_geometry_datasets FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can insert geometry datasets"
  ON public.sample_geometry_datasets FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'durchfuehrer'::app_role) OR public.has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Staff can update geometry datasets"
  ON public.sample_geometry_datasets FOR UPDATE
  USING (public.has_role(auth.uid(), 'durchfuehrer'::app_role) OR public.has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'durchfuehrer'::app_role) OR public.has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Masters can delete geometry datasets"
  ON public.sample_geometry_datasets FOR DELETE
  USING (public.has_role(auth.uid(), 'master'::app_role));

CREATE TRIGGER sample_geometry_datasets_set_updated_at
  BEFORE UPDATE ON public.sample_geometry_datasets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
