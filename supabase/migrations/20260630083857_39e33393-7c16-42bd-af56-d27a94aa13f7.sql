
-- Phase 1: Service Designer Foundation
-- Extend measurement_services with designer-level metadata
ALTER TABLE public.measurement_services
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS price numeric;

-- Data field type enum
DO $$ BEGIN
  CREATE TYPE public.service_field_type AS ENUM (
    'text','longtext','number','decimal','percent',
    'date','time','datetime','boolean',
    'select','multiselect',
    'file','image','barcode','qrcode',
    'ref_customer','ref_material','ref_product','ref_machine',
    'ref_employee','ref_location','ref_batch','ref_serial',
    'repeater'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Central data model table per service
CREATE TABLE IF NOT EXISTS public.service_data_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.measurement_services(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  display_name text NOT NULL,
  description text,
  field_type public.service_field_type NOT NULL DEFAULT 'text',
  category text,
  unit text,
  is_required boolean NOT NULL DEFAULT false,
  default_value text,
  validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  min_value numeric,
  max_value numeric,
  decimal_places integer,
  readonly boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  select_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  ref_target text,
  parent_field_id uuid REFERENCES public.service_data_fields(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  legacy_parameter_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (service_id, field_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_data_fields TO authenticated;
GRANT ALL ON public.service_data_fields TO service_role;

ALTER TABLE public.service_data_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_data_fields_read"
  ON public.service_data_fields FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "service_data_fields_write_master"
  ON public.service_data_fields FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'master'::app_role)
    OR public.has_permission(auth.uid(), 'services.manage')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'master'::app_role)
    OR public.has_permission(auth.uid(), 'services.manage')
  );

CREATE TRIGGER service_data_fields_updated_at
  BEFORE UPDATE ON public.service_data_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_service_data_fields_service ON public.service_data_fields(service_id, sort_order);

-- Auto-migrate existing service_parameter_definitions into data fields (best effort, idempotent)
INSERT INTO public.service_data_fields (
  service_id, field_key, display_name, description, field_type,
  category, unit, is_required, default_value, sort_order, select_options,
  min_value, max_value, legacy_parameter_id
)
SELECT
  spd.service_id,
  -- slug-like key from parameter_name + id suffix to ensure uniqueness
  regexp_replace(lower(coalesce(spd.parameter_name,'feld')), '[^a-z0-9]+', '_', 'g')
    || '_' || substr(spd.id::text,1,4),
  spd.parameter_name,
  spd.description,
  CASE spd.parameter_type
    WHEN 'number'  THEN 'decimal'::public.service_field_type
    WHEN 'boolean' THEN 'boolean'::public.service_field_type
    WHEN 'select'  THEN 'select'::public.service_field_type
    ELSE 'text'::public.service_field_type
  END,
  spd.parameter_category,
  spd.unit,
  coalesce(spd.is_required, false),
  spd.default_value,
  coalesce(spd.sort_order, 0),
  coalesce(to_jsonb(spd.select_options), '[]'::jsonb),
  spd.min_value,
  spd.max_value,
  spd.id
FROM public.service_parameter_definitions spd
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_data_fields sdf WHERE sdf.legacy_parameter_id = spd.id
);
