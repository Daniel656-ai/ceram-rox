
-- 1. must_change_password on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- 2. password_reset_log
CREATE TABLE IF NOT EXISTS public.password_reset_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL,
  performed_by UUID,
  action TEXT NOT NULL CHECK (action IN ('admin_reset','self_change','forgot_reset','initial_set')),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.password_reset_log TO authenticated;
GRANT ALL ON public.password_reset_log TO service_role;

ALTER TABLE public.password_reset_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own password reset log"
ON public.password_reset_log FOR SELECT TO authenticated
USING (target_user_id = auth.uid());

CREATE POLICY "Masters can read all password reset logs"
ON public.password_reset_log FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'master'));

CREATE INDEX IF NOT EXISTS password_reset_log_target_idx ON public.password_reset_log(target_user_id, created_at DESC);
