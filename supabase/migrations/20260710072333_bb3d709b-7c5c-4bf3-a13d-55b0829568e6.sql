ALTER TABLE public.service_form_layouts
  DROP CONSTRAINT IF EXISTS service_form_layouts_role_view_check;

ALTER TABLE public.service_form_layouts
  ADD CONSTRAINT service_form_layouts_role_view_check
  CHECK (role_view = ANY (ARRAY['customer'::text, 'employee'::text, 'public'::text, 'report'::text]));