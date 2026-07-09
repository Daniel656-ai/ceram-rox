
COMMENT ON COLUMN public.service_form_layouts.role_view IS
  'Rollenansicht des Formulars: customer | employee | report';

CREATE TABLE public.order_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.measurement_orders(id) ON DELETE CASCADE,
  current_version_no integer NOT NULL DEFAULT 0,
  auto_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_reports TO authenticated;
GRANT ALL ON public.order_reports TO service_role;
ALTER TABLE public.order_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_reports_select" ON public.order_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'reports.view'));
CREATE POLICY "order_reports_write" ON public.order_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'reports.generate'))
  WITH CHECK (public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'reports.generate'));
CREATE TRIGGER trg_order_reports_updated_at BEFORE UPDATE ON public.order_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.order_report_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.order_reports(id) ON DELETE CASCADE,
  version_no integer NOT NULL,
  layout_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_storage_path text,
  change_reason text,
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, version_no)
);
CREATE INDEX idx_order_report_versions_report ON public.order_report_versions(report_id, version_no DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_report_versions TO authenticated;
GRANT ALL ON public.order_report_versions TO service_role;
ALTER TABLE public.order_report_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_report_versions_select" ON public.order_report_versions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'reports.view'));
CREATE POLICY "order_report_versions_insert" ON public.order_report_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'reports.generate'));
CREATE POLICY "order_report_versions_update" ON public.order_report_versions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'reports.approve') OR public.has_permission(auth.uid(), 'reports.generate'))
  WITH CHECK (public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'reports.approve') OR public.has_permission(auth.uid(), 'reports.generate'));
CREATE POLICY "order_report_versions_delete" ON public.order_report_versions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'reports.delete'));
CREATE TRIGGER trg_order_report_versions_updated_at BEFORE UPDATE ON public.order_report_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT cr.id, p.permission_key
FROM public.custom_roles cr
CROSS JOIN (VALUES
  ('master', 'reports.view'),
  ('master', 'reports.generate'),
  ('master', 'reports.approve'),
  ('master', 'reports.delete'),
  ('auftraggeber', 'reports.view'),
  ('durchfuehrer', 'reports.view'),
  ('durchfuehrer', 'reports.generate')
) AS p(role_base, permission_key)
WHERE cr.base_role::text = p.role_base
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.trg_auto_create_order_report()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order_id uuid; v_open_count integer;
BEGIN
  v_order_id := NEW.order_id;
  IF v_order_id IS NULL THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO v_open_count FROM public.order_measurements
    WHERE order_id = v_order_id AND status <> 'completed';
  IF v_open_count = 0 THEN
    INSERT INTO public.order_reports (order_id, auto_generated) VALUES (v_order_id, true)
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_om_auto_create_report ON public.order_measurements;
CREATE TRIGGER trg_om_auto_create_report
  AFTER INSERT OR UPDATE OF status ON public.order_measurements
  FOR EACH ROW EXECUTE FUNCTION public.trg_auto_create_order_report();
