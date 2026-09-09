ALTER TABLE public.production_releases
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.measurement_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_production_releases_order_id ON public.production_releases(order_id);

CREATE TABLE IF NOT EXISTS public.production_document_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.measurement_orders(id) ON DELETE CASCADE,
  doc_kind text NOT NULL CHECK (doc_kind IN ('m3_list','documentation')),
  status text NOT NULL DEFAULT 'angefordert'
    CHECK (status IN ('angefordert','wartet_auf_daten','daten_vollstaendig','in_erstellung','erstellt')),
  based_on_release_id uuid REFERENCES public.production_releases(id) ON DELETE SET NULL,
  missing jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, doc_kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_document_requests TO authenticated;
GRANT ALL ON public.production_document_requests TO service_role;

ALTER TABLE public.production_document_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read production_document_requests"
  ON public.production_document_requests FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated manage production_document_requests"
  ON public.production_document_requests FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_production_document_requests_updated_at
  BEFORE UPDATE ON public.production_document_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();