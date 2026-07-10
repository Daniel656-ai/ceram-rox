ALTER TABLE public.order_reports
  ADD COLUMN IF NOT EXISTS draft_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;