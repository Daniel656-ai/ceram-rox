
-- 1. Create custom_roles table
CREATE TABLE public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  base_role public.app_role NOT NULL DEFAULT 'auftraggeber',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read custom_roles"
  ON public.custom_roles FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Masters manage custom_roles"
  ON public.custom_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

-- 2. Create role_permissions table
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_key)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read role_permissions"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Masters manage role_permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

-- 3. Add custom_role_id to user_roles
ALTER TABLE public.user_roles ADD COLUMN custom_role_id uuid REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- 4. Seed default system roles
INSERT INTO public.custom_roles (id, name, description, base_role, is_system) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Administrator', 'Voller Systemzugriff – kann alle Funktionen nutzen und verwalten', 'master', true),
  ('00000000-0000-0000-0000-000000000002', 'Auftraggeber', 'Kann Aufträge, Proben und Projekte erstellen und verwalten', 'auftraggeber', true),
  ('00000000-0000-0000-0000-000000000003', 'Messdienstleister', 'Führt Messungen durch und trägt Ergebnisse ein', 'durchfuehrer', true);

-- 5. Seed permissions for Administrator (all)
INSERT INTO public.role_permissions (role_id, permission_key) VALUES
  ('00000000-0000-0000-0000-000000000001', 'samples.create'),
  ('00000000-0000-0000-0000-000000000001', 'samples.view'),
  ('00000000-0000-0000-0000-000000000001', 'samples.edit'),
  ('00000000-0000-0000-0000-000000000001', 'measurements.enter'),
  ('00000000-0000-0000-0000-000000000001', 'measurements.view'),
  ('00000000-0000-0000-0000-000000000001', 'priorities.edit'),
  ('00000000-0000-0000-0000-000000000001', 'locations.edit'),
  ('00000000-0000-0000-0000-000000000001', 'projects.assign'),
  ('00000000-0000-0000-0000-000000000001', 'projects.create'),
  ('00000000-0000-0000-0000-000000000001', 'projects.view'),
  ('00000000-0000-0000-0000-000000000001', 'projects.edit'),
  ('00000000-0000-0000-0000-000000000001', 'reports.create'),
  ('00000000-0000-0000-0000-000000000001', 'sds.manage'),
  ('00000000-0000-0000-0000-000000000001', 'orders.create'),
  ('00000000-0000-0000-0000-000000000001', 'orders.view'),
  ('00000000-0000-0000-0000-000000000001', 'orders.edit'),
  ('00000000-0000-0000-0000-000000000001', 'orders.delete'),
  ('00000000-0000-0000-0000-000000000001', 'raw_materials.manage'),
  ('00000000-0000-0000-0000-000000000001', 'workstations.manage'),
  ('00000000-0000-0000-0000-000000000001', 'users.manage'),
  ('00000000-0000-0000-0000-000000000001', 'services.manage'),
  ('00000000-0000-0000-0000-000000000001', 'absences.manage_all'),
  ('00000000-0000-0000-0000-000000000001', 'admin.system');

-- Auftraggeber permissions
INSERT INTO public.role_permissions (role_id, permission_key) VALUES
  ('00000000-0000-0000-0000-000000000002', 'samples.create'),
  ('00000000-0000-0000-0000-000000000002', 'samples.view'),
  ('00000000-0000-0000-0000-000000000002', 'samples.edit'),
  ('00000000-0000-0000-0000-000000000002', 'measurements.view'),
  ('00000000-0000-0000-0000-000000000002', 'priorities.edit'),
  ('00000000-0000-0000-0000-000000000002', 'locations.edit'),
  ('00000000-0000-0000-0000-000000000002', 'projects.assign'),
  ('00000000-0000-0000-0000-000000000002', 'projects.create'),
  ('00000000-0000-0000-0000-000000000002', 'projects.view'),
  ('00000000-0000-0000-0000-000000000002', 'projects.edit'),
  ('00000000-0000-0000-0000-000000000002', 'reports.create'),
  ('00000000-0000-0000-0000-000000000002', 'sds.manage'),
  ('00000000-0000-0000-0000-000000000002', 'orders.create'),
  ('00000000-0000-0000-0000-000000000002', 'orders.view'),
  ('00000000-0000-0000-0000-000000000002', 'orders.edit'),
  ('00000000-0000-0000-0000-000000000002', 'orders.delete'),
  ('00000000-0000-0000-0000-000000000002', 'raw_materials.manage');

-- Durchführer permissions
INSERT INTO public.role_permissions (role_id, permission_key) VALUES
  ('00000000-0000-0000-0000-000000000003', 'samples.view'),
  ('00000000-0000-0000-0000-000000000003', 'samples.create'),
  ('00000000-0000-0000-0000-000000000003', 'measurements.enter'),
  ('00000000-0000-0000-0000-000000000003', 'measurements.view'),
  ('00000000-0000-0000-0000-000000000003', 'orders.view'),
  ('00000000-0000-0000-0000-000000000003', 'projects.view');

-- 6. Migrate existing users to custom roles
UPDATE public.user_roles SET custom_role_id = '00000000-0000-0000-0000-000000000001' WHERE role = 'master';
UPDATE public.user_roles SET custom_role_id = '00000000-0000-0000-0000-000000000002' WHERE role = 'auftraggeber';
UPDATE public.user_roles SET custom_role_id = '00000000-0000-0000-0000-000000000003' WHERE role = 'durchfuehrer';

-- 7. Create has_permission function
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.custom_role_id
    WHERE ur.user_id = _user_id
      AND rp.permission_key = _permission
  )
$$;

-- 8. Update handle_new_user to assign default custom role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  INSERT INTO public.user_roles (user_id, role, custom_role_id)
  VALUES (NEW.id, 'auftraggeber', '00000000-0000-0000-0000-000000000002');
  RETURN NEW;
END;
$$;
