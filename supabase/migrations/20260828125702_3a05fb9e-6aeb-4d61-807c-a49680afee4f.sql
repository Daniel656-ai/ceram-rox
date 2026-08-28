CREATE TABLE public.order_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  order_kind text,
  service_count integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_order_id uuid REFERENCES public.measurement_orders(id) ON DELETE SET NULL,
  source_draft_id uuid REFERENCES public.order_drafts(id) ON DELETE SET NULL,
  source_label text,
  copy_options jsonb,
  template_baseline jsonb,
  copied_at timestamptz,
  copied_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_drafts TO authenticated;
GRANT ALL ON public.order_drafts TO service_role;

ALTER TABLE public.order_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own drafts select" ON public.order_drafts
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'master'));

CREATE POLICY "own drafts insert" ON public.order_drafts
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "own drafts update" ON public.order_drafts
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "own drafts delete" ON public.order_drafts
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'master'));

CREATE INDEX idx_order_drafts_created_by ON public.order_drafts(created_by, updated_at DESC);

CREATE TRIGGER update_order_drafts_updated_at
  BEFORE UPDATE ON public.order_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();