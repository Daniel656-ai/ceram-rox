CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  module text NOT NULL,
  action text NOT NULL,
  user_id uuid,
  variant text NOT NULL DEFAULT 'web'
);

CREATE INDEX IF NOT EXISTS usage_events_occurred_at_idx ON public.usage_events (occurred_at);
CREATE INDEX IF NOT EXISTS usage_events_module_idx ON public.usage_events (module);

GRANT INSERT ON public.usage_events TO authenticated;
GRANT SELECT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own usage events"
ON public.usage_events
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Masters can read usage events"
ON public.usage_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'master'::public.app_role));
