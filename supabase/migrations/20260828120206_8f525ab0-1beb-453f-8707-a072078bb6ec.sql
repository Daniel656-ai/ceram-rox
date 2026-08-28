-- 1) Prozessschritte: Schrittart, Dienstleistungsbezug, Abhängigkeiten, Teilprobe
ALTER TABLE public.process_steps
  ADD COLUMN IF NOT EXISTS step_kind text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.measurement_services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS depends_on_step_keys text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS creates_subsample boolean NOT NULL DEFAULT false;

ALTER TABLE public.process_steps
  DROP CONSTRAINT IF EXISTS process_steps_step_kind_check;
ALTER TABLE public.process_steps
  ADD CONSTRAINT process_steps_step_kind_check CHECK (step_kind IN ('service','internal'));

CREATE INDEX IF NOT EXISTS idx_process_steps_service ON public.process_steps(service_id);

-- 2) Dienstleistung -> Prozessvorlage (Workflow der Dienstleistung)
ALTER TABLE public.measurement_services
  ADD COLUMN IF NOT EXISTS process_template_id uuid REFERENCES public.process_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_measurement_services_process_template
  ON public.measurement_services(process_template_id);

-- 3) Herkunft von Aufgaben (gebucht / Paket / Workflow)
ALTER TABLE public.order_measurements
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'booked',
  ADD COLUMN IF NOT EXISTS source_measurement_id uuid REFERENCES public.order_measurements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_step_key text;

ALTER TABLE public.order_measurements
  DROP CONSTRAINT IF EXISTS order_measurements_origin_check;
ALTER TABLE public.order_measurements
  ADD CONSTRAINT order_measurements_origin_check CHECK (origin IN ('booked','package','workflow'));

UPDATE public.order_measurements
  SET origin = 'package'
  WHERE source_package_id IS NOT NULL AND origin = 'booked';

CREATE INDEX IF NOT EXISTS idx_order_measurements_source_measurement
  ON public.order_measurements(source_measurement_id);

-- 4) Teilproben: laufende Kennzeichnung + Bezug zur Pruefung
ALTER TABLE public.samples
  ADD COLUMN IF NOT EXISTS subsample_suffix text,
  ADD COLUMN IF NOT EXISTS prepared_for_measurement_id uuid REFERENCES public.order_measurements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_samples_prepared_for ON public.samples(prepared_for_measurement_id);
CREATE INDEX IF NOT EXISTS idx_samples_parent ON public.samples(parent_sample_id);

-- 5) Formularfelder: generische Workflow-Datenquelle
--    { "mode": "display" | "copy" | "calc",
--      "source": { "kind": "workflow_step", "step_key": "...", "field_key": "...",
--                  "service_id": "...", "label": "..." } }
ALTER TABLE public.form_fields
  ADD COLUMN IF NOT EXISTS data_source jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.global_fields
  ADD COLUMN IF NOT EXISTS data_source jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.form_fields.data_source IS
  'Generische Workflow-Datenquelle: mode (display|copy|calc) + source (kind/step_key/field_key). Leer = normales Eingabefeld.';