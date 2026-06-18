
-- Add responsible_user_id to raw_materials
ALTER TABLE public.raw_materials
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL;

-- Fix RLS so any role with raw_materials.manage permission can manage raw materials
-- (previously only master/auftraggeber via role check; Messdienstleister/durchfuehrer was blocked)

DROP POLICY IF EXISTS "Masters and auftraggeber manage materials" ON public.raw_materials;
CREATE POLICY "manage materials by permission" ON public.raw_materials
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'));

DROP POLICY IF EXISTS "Masters and auftraggeber manage batches" ON public.raw_material_batches;
CREATE POLICY "manage batches by permission" ON public.raw_material_batches
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'));

DROP POLICY IF EXISTS "Masters and auftraggeber manage analyses" ON public.raw_material_analyses;
CREATE POLICY "manage analyses by permission" ON public.raw_material_analyses
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'));

DROP POLICY IF EXISTS "Masters and auftraggeber manage rm docs" ON public.raw_material_documents;
CREATE POLICY "manage rm docs by permission" ON public.raw_material_documents
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'));

DROP POLICY IF EXISTS "Masters and auftraggeber manage movements" ON public.inventory_movements;
CREATE POLICY "manage movements by permission" ON public.inventory_movements
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'));

DROP POLICY IF EXISTS "Masters manage locations" ON public.storage_locations;
CREATE POLICY "manage locations by permission" ON public.storage_locations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'));
