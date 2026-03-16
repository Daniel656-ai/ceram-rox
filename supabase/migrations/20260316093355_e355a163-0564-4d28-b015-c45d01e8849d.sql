
-- Measurement Templates
CREATE TABLE public.measurement_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.measurement_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read templates" ON public.measurement_templates
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Masters and auftraggeber manage templates" ON public.measurement_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'auftraggeber'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'auftraggeber'::app_role));

-- Template Items (link to measurement_services)
CREATE TABLE public.measurement_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.measurement_templates(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.measurement_services(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.measurement_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read template items" ON public.measurement_template_items
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Masters and auftraggeber manage template items" ON public.measurement_template_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'auftraggeber'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'auftraggeber'::app_role));

-- Add sample_group to samples for bulk creation tracking
ALTER TABLE public.samples ADD COLUMN sample_group TEXT;
