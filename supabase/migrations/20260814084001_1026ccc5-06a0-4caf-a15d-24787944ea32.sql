CREATE TABLE public.order_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.measurement_orders(id) ON DELETE CASCADE,
  sample_id uuid NOT NULL REFERENCES public.samples(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (order_id, sample_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_samples TO authenticated;
GRANT ALL ON public.order_samples TO service_role;

ALTER TABLE public.order_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see relevant order samples" ON public.order_samples
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.measurement_orders mo
  WHERE mo.id = order_samples.order_id
    AND (
      has_role(auth.uid(), 'master'::app_role)
      OR mo.created_by = auth.uid()
      OR is_assigned_to_order(auth.uid(), mo.id)
      OR ((NOT has_role(auth.uid(), 'auftraggeber'::app_role)) AND is_project_member(auth.uid(), mo.project_id))
      OR (has_role(auth.uid(), 'auftraggeber'::app_role) AND (has_project_role(auth.uid(), mo.project_id, 'owner'::project_role) OR has_project_role(auth.uid(), mo.project_id, 'leader'::project_role)))
    )
));

CREATE POLICY "Authorized users manage order samples" ON public.order_samples
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.measurement_orders mo
  WHERE mo.id = order_samples.order_id
    AND (
      has_role(auth.uid(), 'master'::app_role)
      OR mo.created_by = auth.uid()
      OR has_project_role(auth.uid(), mo.project_id, 'owner'::project_role)
      OR has_project_role(auth.uid(), mo.project_id, 'leader'::project_role)
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.measurement_orders mo
  WHERE mo.id = order_samples.order_id
    AND (
      has_role(auth.uid(), 'master'::app_role)
      OR mo.created_by = auth.uid()
      OR has_project_role(auth.uid(), mo.project_id, 'owner'::project_role)
      OR has_project_role(auth.uid(), mo.project_id, 'leader'::project_role)
    )
));

CREATE INDEX idx_order_samples_order ON public.order_samples(order_id);
CREATE INDEX idx_order_samples_sample ON public.order_samples(sample_id);

ALTER TABLE public.order_measurements
  ADD COLUMN sample_id uuid REFERENCES public.samples(id) ON DELETE SET NULL;

CREATE INDEX idx_order_measurements_sample ON public.order_measurements(sample_id);

INSERT INTO public.order_samples (order_id, sample_id, created_by)
SELECT mo.id, mo.sample_id, mo.created_by
FROM public.measurement_orders mo
WHERE mo.sample_id IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE public.order_measurements om
SET sample_id = mo.sample_id
FROM public.measurement_orders mo
WHERE mo.id = om.order_id AND om.sample_id IS NULL AND mo.sample_id IS NOT NULL;