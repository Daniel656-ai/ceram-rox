ALTER TABLE public.service_form_links
  ADD COLUMN IF NOT EXISTS role_view text;

ALTER TABLE public.service_form_links
  DROP CONSTRAINT IF EXISTS service_form_links_role_view_check;

ALTER TABLE public.service_form_links
  ADD CONSTRAINT service_form_links_role_view_check
  CHECK (role_view IS NULL OR role_view IN ('customer','employee'));