
-- 1. PSA categories auf raw_materials
ALTER TABLE public.raw_materials
  ADD COLUMN IF NOT EXISTS psa_categories JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. label_templates
CREATE TABLE IF NOT EXISTS public.label_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'rohstoff',
  width_mm NUMERIC NOT NULL DEFAULT 100,
  height_mm NUMERIC NOT NULL DEFAULT 50,
  layout JSONB NOT NULL DEFAULT '{"elements":[]}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.label_templates TO authenticated;
GRANT ALL ON public.label_templates TO service_role;

ALTER TABLE public.label_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read label templates"
ON public.label_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Master can manage label templates"
ON public.label_templates FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'master'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'master'));

CREATE INDEX IF NOT EXISTS label_templates_category_idx ON public.label_templates(category);

-- updated_at trigger (re-use existing if present)
CREATE OR REPLACE FUNCTION public.label_templates_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_label_templates_updated_at ON public.label_templates;
CREATE TRIGGER trg_label_templates_updated_at
  BEFORE UPDATE ON public.label_templates
  FOR EACH ROW EXECUTE FUNCTION public.label_templates_set_updated_at();

-- 3. label_print_history
CREATE TABLE IF NOT EXISTS public.label_print_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.label_templates(id) ON DELETE SET NULL,
  container_id UUID REFERENCES public.raw_material_containers(id) ON DELETE SET NULL,
  raw_material_id UUID REFERENCES public.raw_materials(id) ON DELETE SET NULL,
  copies INTEGER NOT NULL DEFAULT 1,
  output TEXT NOT NULL DEFAULT 'print' CHECK (output IN ('print','pdf','reprint')),
  data_snapshot JSONB,
  printed_by UUID,
  printed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.label_print_history TO authenticated;
GRANT ALL ON public.label_print_history TO service_role;

ALTER TABLE public.label_print_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read print history"
ON public.label_print_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert print history"
ON public.label_print_history FOR INSERT TO authenticated
WITH CHECK (printed_by = auth.uid() OR printed_by IS NULL);

CREATE INDEX IF NOT EXISTS label_print_history_container_idx ON public.label_print_history(container_id, printed_at DESC);
CREATE INDEX IF NOT EXISTS label_print_history_template_idx ON public.label_print_history(template_id, printed_at DESC);
