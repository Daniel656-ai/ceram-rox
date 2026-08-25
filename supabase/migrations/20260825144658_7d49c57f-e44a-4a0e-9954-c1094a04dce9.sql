-- Rohdaten importierter Messkurven (generisch, verfahrensunabhängig)
CREATE TABLE public.measurement_raw_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_measurement_id uuid NOT NULL REFERENCES public.order_measurements(id) ON DELETE CASCADE,
  sample_id uuid REFERENCES public.samples(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.measurement_services(id) ON DELETE SET NULL,
  instance_key text,
  instance_label text,
  case_instance_id uuid REFERENCES public.measurement_case_instances(id) ON DELETE SET NULL,
  source_file_id uuid REFERENCES public.order_upload_files(id) ON DELETE SET NULL,
  source_file_name text,
  importer_id text NOT NULL,
  parser_version text,
  measurement_type text,
  instrument text,
  channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  point_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.measurement_raw_datasets TO authenticated;
GRANT ALL ON public.measurement_raw_datasets TO service_role;
ALTER TABLE public.measurement_raw_datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mrd_read" ON public.measurement_raw_datasets
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'master'::app_role)
  OR is_assigned_to_measurement(auth.uid(), order_measurement_id)
  OR is_order_creator_via_measurement(auth.uid(), order_measurement_id)
  OR EXISTS (
    SELECT 1 FROM order_measurements om
    JOIN measurement_orders mo ON mo.id = om.order_id
    WHERE om.id = measurement_raw_datasets.order_measurement_id
      AND (
        ((NOT has_role(auth.uid(), 'auftraggeber'::app_role)) AND is_project_member(auth.uid(), mo.project_id))
        OR (has_role(auth.uid(), 'auftraggeber'::app_role) AND (
              has_project_role(auth.uid(), mo.project_id, 'owner'::project_role)
              OR has_project_role(auth.uid(), mo.project_id, 'leader'::project_role)))
      )
  )
);

CREATE POLICY "mrd_write" ON public.measurement_raw_datasets
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'master'::app_role) OR is_assigned_to_measurement(auth.uid(), order_measurement_id))
WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR is_assigned_to_measurement(auth.uid(), order_measurement_id));

CREATE INDEX idx_mrd_measurement ON public.measurement_raw_datasets(order_measurement_id);
CREATE INDEX idx_mrd_sample ON public.measurement_raw_datasets(sample_id);

-- Messpunkte, blockweise als Zahlenmatrix
CREATE TABLE public.measurement_raw_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES public.measurement_raw_datasets(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL DEFAULT 0,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dataset_id, chunk_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.measurement_raw_series TO authenticated;
GRANT ALL ON public.measurement_raw_series TO service_role;
ALTER TABLE public.measurement_raw_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mrs_read" ON public.measurement_raw_series
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.measurement_raw_datasets d
  WHERE d.id = measurement_raw_series.dataset_id
    AND (
      has_role(auth.uid(), 'master'::app_role)
      OR is_assigned_to_measurement(auth.uid(), d.order_measurement_id)
      OR is_order_creator_via_measurement(auth.uid(), d.order_measurement_id)
      OR EXISTS (
        SELECT 1 FROM order_measurements om
        JOIN measurement_orders mo ON mo.id = om.order_id
        WHERE om.id = d.order_measurement_id
          AND (
            ((NOT has_role(auth.uid(), 'auftraggeber'::app_role)) AND is_project_member(auth.uid(), mo.project_id))
            OR (has_role(auth.uid(), 'auftraggeber'::app_role) AND (
                  has_project_role(auth.uid(), mo.project_id, 'owner'::project_role)
                  OR has_project_role(auth.uid(), mo.project_id, 'leader'::project_role)))
          )
      )
    )
));

CREATE POLICY "mrs_write" ON public.measurement_raw_series
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.measurement_raw_datasets d
  WHERE d.id = measurement_raw_series.dataset_id
    AND (has_role(auth.uid(), 'master'::app_role) OR is_assigned_to_measurement(auth.uid(), d.order_measurement_id))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.measurement_raw_datasets d
  WHERE d.id = measurement_raw_series.dataset_id
    AND (has_role(auth.uid(), 'master'::app_role) OR is_assigned_to_measurement(auth.uid(), d.order_measurement_id))
));

CREATE INDEX idx_mrs_dataset ON public.measurement_raw_series(dataset_id, chunk_index);

-- Nachvollziehbarkeit jeder aus einer Kurve berechneten Auswertung
CREATE TABLE public.measurement_curve_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES public.measurement_raw_datasets(id) ON DELETE CASCADE,
  measurement_result_id uuid REFERENCES public.measurement_results(id) ON DELETE SET NULL,
  method text NOT NULL,
  method_label text,
  x_channel text NOT NULL,
  x_unit text,
  y_channel text NOT NULL,
  y_unit text,
  x_from numeric NOT NULL,
  x_to numeric NOT NULL,
  value numeric,
  unit text,
  formula text,
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  result_label text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.measurement_curve_evaluations TO authenticated;
GRANT ALL ON public.measurement_curve_evaluations TO service_role;
ALTER TABLE public.measurement_curve_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mce_read" ON public.measurement_curve_evaluations
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.measurement_raw_datasets d
  WHERE d.id = measurement_curve_evaluations.dataset_id
    AND (
      has_role(auth.uid(), 'master'::app_role)
      OR is_assigned_to_measurement(auth.uid(), d.order_measurement_id)
      OR is_order_creator_via_measurement(auth.uid(), d.order_measurement_id)
      OR EXISTS (
        SELECT 1 FROM order_measurements om
        JOIN measurement_orders mo ON mo.id = om.order_id
        WHERE om.id = d.order_measurement_id
          AND (
            ((NOT has_role(auth.uid(), 'auftraggeber'::app_role)) AND is_project_member(auth.uid(), mo.project_id))
            OR (has_role(auth.uid(), 'auftraggeber'::app_role) AND (
                  has_project_role(auth.uid(), mo.project_id, 'owner'::project_role)
                  OR has_project_role(auth.uid(), mo.project_id, 'leader'::project_role)))
          )
      )
    )
));

CREATE POLICY "mce_write" ON public.measurement_curve_evaluations
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.measurement_raw_datasets d
  WHERE d.id = measurement_curve_evaluations.dataset_id
    AND (has_role(auth.uid(), 'master'::app_role) OR is_assigned_to_measurement(auth.uid(), d.order_measurement_id))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.measurement_raw_datasets d
  WHERE d.id = measurement_curve_evaluations.dataset_id
    AND (has_role(auth.uid(), 'master'::app_role) OR is_assigned_to_measurement(auth.uid(), d.order_measurement_id))
));

CREATE INDEX idx_mce_dataset ON public.measurement_curve_evaluations(dataset_id);

CREATE TRIGGER trg_mrd_updated_at
BEFORE UPDATE ON public.measurement_raw_datasets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();