
-- Split off batch/container creation from raw_materials.manage
-- so 'Auftraggeber' (who has raw_materials.manage for master-data) can no longer create batches.

-- 1. Register new permission key on Administrator role (system id)
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, 'raw_materials.batches.manage'
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions
  WHERE role_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND permission_key = 'raw_materials.batches.manage'
);

-- Assign to Messdienstleister (system id) too – they manage batches operationally
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT '00000000-0000-0000-0000-000000000003'::uuid, 'raw_materials.batches.manage'
WHERE EXISTS (SELECT 1 FROM public.custom_roles WHERE id = '00000000-0000-0000-0000-000000000003'::uuid)
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role_id = '00000000-0000-0000-0000-000000000003'::uuid
      AND permission_key = 'raw_materials.batches.manage'
);

-- 2. Add nav.mixtures nav permission for Administrator (so main area shows up)
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, 'nav.mixtures'
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions
  WHERE role_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND permission_key = 'nav.mixtures'
);

-- 3. Tighten RLS on raw_material_batches – WRITE requires new permission
DROP POLICY IF EXISTS "manage batches by permission" ON public.raw_material_batches;
CREATE POLICY "batches_write_by_permission"
  ON public.raw_material_batches
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'master'::app_role)
    OR has_permission(auth.uid(), 'raw_materials.batches.manage')
  )
  WITH CHECK (
    has_role(auth.uid(), 'master'::app_role)
    OR has_permission(auth.uid(), 'raw_materials.batches.manage')
  );

-- 4. Tighten RLS on raw_material_containers – WRITE requires new permission
DROP POLICY IF EXISTS "containers_write_manage" ON public.raw_material_containers;
CREATE POLICY "containers_write_by_permission"
  ON public.raw_material_containers
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'master'::app_role)
    OR has_permission(auth.uid(), 'raw_materials.batches.manage')
  )
  WITH CHECK (
    has_role(auth.uid(), 'master'::app_role)
    OR has_permission(auth.uid(), 'raw_materials.batches.manage')
  );
