
-- Permission matrix: which Durchführer can perform which service
CREATE TABLE public.mdl_service_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_id uuid NOT NULL REFERENCES public.measurement_services(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, service_id)
);

ALTER TABLE public.mdl_service_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read permissions"
  ON public.mdl_service_permissions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Masters manage permissions"
  ON public.mdl_service_permissions FOR ALL
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Audit log for permission changes
CREATE TABLE public.mdl_permission_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_id uuid NOT NULL,
  action text NOT NULL, -- 'granted' or 'revoked'
  changed_by uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mdl_permission_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can read audit log"
  ON public.mdl_permission_audit_log FOR SELECT
  USING (has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "System inserts audit log"
  ON public.mdl_permission_audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger to auto-log permission changes
CREATE OR REPLACE FUNCTION public.log_mdl_permission_grant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.mdl_permission_audit_log (user_id, service_id, action, changed_by)
  VALUES (NEW.user_id, NEW.service_id, 'granted', NEW.granted_by);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mdl_permission_grant
  AFTER INSERT ON public.mdl_service_permissions
  FOR EACH ROW EXECUTE FUNCTION public.log_mdl_permission_grant();

CREATE OR REPLACE FUNCTION public.log_mdl_permission_revoke()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.mdl_permission_audit_log (user_id, service_id, action, changed_by)
  VALUES (OLD.user_id, OLD.service_id, 'revoked', auth.uid());
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_mdl_permission_revoke
  AFTER DELETE ON public.mdl_service_permissions
  FOR EACH ROW EXECUTE FUNCTION public.log_mdl_permission_revoke();
