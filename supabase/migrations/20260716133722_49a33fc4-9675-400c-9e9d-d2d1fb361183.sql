-- Mapping between an order kind (Auftragsart) and the form template rendered
-- dynamically at order creation time. Managed via the Prozess-Designer.

CREATE TABLE IF NOT EXISTS public.order_kind_form_templates (
  order_kind text PRIMARY KEY CHECK (order_kind IN ('labor','pilot_plant','combined')),
  form_definition_id uuid NOT NULL REFERENCES public.form_definitions(id) ON DELETE CASCADE,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.order_kind_form_templates TO authenticated;
GRANT ALL ON public.order_kind_form_templates TO service_role;

ALTER TABLE public.order_kind_form_templates ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may read the mapping (used at order creation time).
CREATE POLICY "read_order_kind_form_templates"
  ON public.order_kind_form_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- Only master admins may edit the mapping.
CREATE POLICY "manage_order_kind_form_templates"
  ON public.order_kind_form_templates
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'master'::app_role));

-- Grant write privileges to authenticated so the RLS policy above can apply.
GRANT INSERT, UPDATE, DELETE ON public.order_kind_form_templates TO authenticated;

CREATE OR REPLACE FUNCTION public.set_order_kind_form_templates_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_order_kind_form_templates_updated_at ON public.order_kind_form_templates;
CREATE TRIGGER trg_order_kind_form_templates_updated_at
BEFORE UPDATE ON public.order_kind_form_templates
FOR EACH ROW EXECUTE FUNCTION public.set_order_kind_form_templates_updated_at();
