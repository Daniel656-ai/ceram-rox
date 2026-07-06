
-- 1) service_packages
CREATE TABLE public.service_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_packages TO authenticated;
GRANT ALL ON public.service_packages TO service_role;

ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_packages_read_all"
  ON public.service_packages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "service_packages_manage"
  ON public.service_packages FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'services.manage'))
  WITH CHECK (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'services.manage'));

CREATE TRIGGER update_service_packages_updated_at
  BEFORE UPDATE ON public.service_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) service_package_items
CREATE TABLE public.service_package_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id uuid NOT NULL REFERENCES public.service_packages(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.measurement_services(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, service_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_package_items TO authenticated;
GRANT ALL ON public.service_package_items TO service_role;

ALTER TABLE public.service_package_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_package_items_read_all"
  ON public.service_package_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "service_package_items_manage"
  ON public.service_package_items FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'services.manage'))
  WITH CHECK (public.has_role(auth.uid(),'master'::app_role) OR public.has_permission(auth.uid(),'services.manage'));

CREATE TRIGGER update_service_package_items_updated_at
  BEFORE UPDATE ON public.service_package_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_service_package_items_package ON public.service_package_items(package_id);
CREATE INDEX idx_service_package_items_service ON public.service_package_items(service_id);

-- 3) Snapshot columns on order_measurements
ALTER TABLE public.order_measurements
  ADD COLUMN IF NOT EXISTS source_package_id uuid REFERENCES public.service_packages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_package_name_snapshot text;
