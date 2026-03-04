
-- Extend service_parameter_definitions with type, required, category, select options, and conditional logic
ALTER TABLE public.service_parameter_definitions
  ADD COLUMN IF NOT EXISTS parameter_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parameter_category text NOT NULL DEFAULT 'input',
  ADD COLUMN IF NOT EXISTS select_options jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS conditional_on uuid REFERENCES public.service_parameter_definitions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conditional_value text;

-- Add constraint for valid parameter types
ALTER TABLE public.service_parameter_definitions
  ADD CONSTRAINT chk_parameter_type CHECK (parameter_type IN ('number', 'text', 'select', 'boolean'));

-- Add constraint for valid categories
ALTER TABLE public.service_parameter_definitions
  ADD CONSTRAINT chk_parameter_category CHECK (parameter_category IN ('input', 'output'));
