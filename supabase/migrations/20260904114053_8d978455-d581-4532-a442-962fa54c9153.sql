ALTER TABLE public.measurement_curve_evaluations
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'range',
  ADD COLUMN IF NOT EXISTS x_at numeric,
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS comment text,
  ADD COLUMN IF NOT EXISTS include_in_report boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS x_label text,
  ADD COLUMN IF NOT EXISTS y_label text,
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mce_kind_check') THEN
    ALTER TABLE public.measurement_curve_evaluations
      ADD CONSTRAINT mce_kind_check CHECK (kind IN ('point','range'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mce_group ON public.measurement_curve_evaluations(group_id);

CREATE OR REPLACE FUNCTION public.mce_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  IF TG_OP = 'UPDATE' THEN
    NEW.revision = COALESCE(OLD.revision, 1) + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mce_touch ON public.measurement_curve_evaluations;
CREATE TRIGGER trg_mce_touch
BEFORE UPDATE ON public.measurement_curve_evaluations
FOR EACH ROW EXECUTE FUNCTION public.mce_touch();

ALTER TABLE public.measurement_raw_datasets
  ADD COLUMN IF NOT EXISTS evaluation_chart_path text,
  ADD COLUMN IF NOT EXISTS evaluation_chart_updated_at timestamp with time zone;

DROP POLICY IF EXISTS "mce_write" ON public.measurement_curve_evaluations;
CREATE POLICY "mce_write" ON public.measurement_curve_evaluations
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.measurement_raw_datasets d
  WHERE d.id = measurement_curve_evaluations.dataset_id
    AND (
      has_role(auth.uid(), 'master'::app_role)
      OR is_assigned_to_measurement(auth.uid(), d.order_measurement_id)
      OR is_order_creator_via_measurement(auth.uid(), d.order_measurement_id)
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.measurement_raw_datasets d
  WHERE d.id = measurement_curve_evaluations.dataset_id
    AND (
      has_role(auth.uid(), 'master'::app_role)
      OR is_assigned_to_measurement(auth.uid(), d.order_measurement_id)
      OR is_order_creator_via_measurement(auth.uid(), d.order_measurement_id)
    )
));