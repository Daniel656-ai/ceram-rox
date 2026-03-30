
-- Update measurement_templates: replace "All authenticated read" with creator-only read
DROP POLICY IF EXISTS "All authenticated read templates" ON public.measurement_templates;
CREATE POLICY "Creator and masters read templates" ON public.measurement_templates
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'master'::app_role));

-- Update the ALL policy to be creator-only (not auftraggeber-wide)
DROP POLICY IF EXISTS "Masters and auftraggeber manage templates" ON public.measurement_templates;
CREATE POLICY "Creator and masters manage templates" ON public.measurement_templates
  FOR ALL TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (created_by = auth.uid() OR has_role(auth.uid(), 'master'::app_role));

-- Update measurement_template_items: creator-only via join to template
DROP POLICY IF EXISTS "All authenticated read template items" ON public.measurement_template_items;
CREATE POLICY "Creator and masters read template items" ON public.measurement_template_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.measurement_templates t
      WHERE t.id = template_id AND (t.created_by = auth.uid() OR has_role(auth.uid(), 'master'::app_role))
    )
  );

DROP POLICY IF EXISTS "Masters and auftraggeber manage template items" ON public.measurement_template_items;
CREATE POLICY "Creator and masters manage template items" ON public.measurement_template_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.measurement_templates t
      WHERE t.id = template_id AND (t.created_by = auth.uid() OR has_role(auth.uid(), 'master'::app_role))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.measurement_templates t
      WHERE t.id = template_id AND (t.created_by = auth.uid() OR has_role(auth.uid(), 'master'::app_role))
    )
  );
