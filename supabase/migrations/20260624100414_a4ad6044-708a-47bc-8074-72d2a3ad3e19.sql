
-- 1) Allow raw_materials.manage holders (e.g. Messdienstleister) to manage label templates
DROP POLICY IF EXISTS "Master can manage label templates" ON public.label_templates;
CREATE POLICY "Manage label templates by permission" ON public.label_templates
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'master'::app_role)
    OR public.has_permission(auth.uid(), 'raw_materials.manage')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'master'::app_role)
    OR public.has_permission(auth.uid(), 'raw_materials.manage')
  );

-- 2) Quality parameters on raw material LOT
ALTER TABLE public.raw_material_batches
  ADD COLUMN IF NOT EXISTS moisture_percent NUMERIC,
  ADD COLUMN IF NOT EXISTS ph_value NUMERIC;

-- Optional sanity range for pH (validated via trigger to allow future edits without CHECK rebuild)
CREATE OR REPLACE FUNCTION public.validate_raw_material_batch_quality()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ph_value IS NOT NULL AND (NEW.ph_value < 0 OR NEW.ph_value > 14) THEN
    RAISE EXCEPTION 'pH-Wert muss zwischen 0 und 14 liegen (erhalten: %)', NEW.ph_value;
  END IF;
  IF NEW.moisture_percent IS NOT NULL AND (NEW.moisture_percent < 0 OR NEW.moisture_percent > 100) THEN
    RAISE EXCEPTION 'Feuchte muss zwischen 0 und 100 %% liegen (erhalten: %)', NEW.moisture_percent;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_raw_material_batch_quality ON public.raw_material_batches;
CREATE TRIGGER trg_validate_raw_material_batch_quality
  BEFORE INSERT OR UPDATE ON public.raw_material_batches
  FOR EACH ROW EXECUTE FUNCTION public.validate_raw_material_batch_quality();
