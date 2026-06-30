
CREATE TABLE public.service_document_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.measurement_services(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL DEFAULT 'report',
  format TEXT NOT NULL DEFAULT 'html',
  content TEXT NOT NULL DEFAULT '',
  paper TEXT NOT NULL DEFAULT 'A4',
  orientation TEXT NOT NULL DEFAULT 'portrait',
  header_html TEXT,
  footer_html TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_document_templates TO authenticated;
GRANT ALL ON public.service_document_templates TO service_role;
ALTER TABLE public.service_document_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read service document templates"
ON public.service_document_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage service document templates"
ON public.service_document_templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'admin.system'))
WITH CHECK (public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'admin.system'));
CREATE TRIGGER trg_service_document_templates_updated_at
BEFORE UPDATE ON public.service_document_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_service_document_templates_service ON public.service_document_templates(service_id);

CREATE TABLE public.service_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Allgemein',
  kind TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_blocks TO authenticated;
GRANT ALL ON public.service_blocks TO service_role;
ALTER TABLE public.service_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read service blocks"
ON public.service_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage service blocks"
ON public.service_blocks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'admin.system'))
WITH CHECK (public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'admin.system'));
CREATE TRIGGER trg_service_blocks_updated_at
BEFORE UPDATE ON public.service_blocks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_service_blocks_kind ON public.service_blocks(kind);
CREATE INDEX idx_service_blocks_category ON public.service_blocks(category);
