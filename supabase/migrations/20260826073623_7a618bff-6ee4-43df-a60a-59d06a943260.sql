ALTER TABLE public.measurement_raw_datasets
  ADD COLUMN IF NOT EXISTS signal_mapping jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.measurement_raw_datasets.signal_mapping IS
  'Vom Messtechniker festgelegte Signal-/Achsenzuordnung (x_key, y_keys, y2_key, labels, units). Keine finale Diagrammdefinition.';