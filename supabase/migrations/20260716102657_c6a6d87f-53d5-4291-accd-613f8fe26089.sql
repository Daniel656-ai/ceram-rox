
ALTER TABLE public.service_workflow_steps
  ADD COLUMN IF NOT EXISTS role_view_key text,
  ADD COLUMN IF NOT EXISTS locked_field_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
