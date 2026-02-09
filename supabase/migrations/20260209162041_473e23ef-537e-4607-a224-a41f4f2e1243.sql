
-- =============================================
-- LIMS: Vollständiges Datenbankschema
-- =============================================

-- 1. Enum-Typen
CREATE TYPE public.order_type AS ENUM ('customer', 'production', 'rnd');
CREATE TYPE public.measurement_status AS ENUM ('open', 'in_progress', 'completed');
CREATE TYPE public.order_status AS ENUM ('open', 'in_progress', 'completed');
CREATE TYPE public.service_category AS ENUM ('labor', 'pilot_plant');

-- 2. Messdienstleistungen (Masterdaten)
CREATE TABLE public.measurement_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name TEXT NOT NULL,
  category service_category NOT NULL,
  hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Service-Parameter-Definitionen (Template für Parameter je Service)
CREATE TABLE public.service_parameter_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.measurement_services(id) ON DELETE CASCADE,
  parameter_name TEXT NOT NULL,
  unit TEXT,
  default_value TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

-- 4. Projekte
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_number TEXT NOT NULL UNIQUE,
  project_name TEXT,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Messaufträge
CREATE TABLE public.measurement_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  order_type order_type NOT NULL,
  status order_status NOT NULL DEFAULT 'open',
  created_by UUID NOT NULL,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Messungen (Instanzen im Auftrag)
CREATE TABLE public.order_measurements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.measurement_orders(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.measurement_services(id),
  assigned_to UUID,
  status measurement_status NOT NULL DEFAULT 'open',
  planned_hours DECIMAL(8,2) DEFAULT 0,
  priority INT NOT NULL DEFAULT 0,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Messparameter (Werte je Messung)
CREATE TABLE public.measurement_parameters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_measurement_id UUID NOT NULL REFERENCES public.order_measurements(id) ON DELETE CASCADE,
  parameter_name TEXT NOT NULL,
  parameter_value TEXT,
  unit TEXT
);

-- 8. Arbeitszeiten
CREATE TABLE public.work_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_measurement_id UUID NOT NULL REFERENCES public.order_measurements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  work_date DATE NOT NULL DEFAULT CURRENT_DATE,
  hours DECIMAL(5,2) NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Dokumente (Referenz auf Storage)
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_measurement_id UUID NOT NULL REFERENCES public.order_measurements(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- RLS aktivieren
-- =============================================
ALTER TABLE public.measurement_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_parameter_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies
-- =============================================

-- measurement_services: alle authentifizierten User können lesen, nur Master kann schreiben
CREATE POLICY "All users can read active services" ON public.measurement_services FOR SELECT TO authenticated USING (true);
CREATE POLICY "Masters can manage services" ON public.measurement_services FOR ALL TO authenticated USING (has_role(auth.uid(), 'master')) WITH CHECK (has_role(auth.uid(), 'master'));

-- service_parameter_definitions: lesen für alle, schreiben für Master
CREATE POLICY "All users can read param defs" ON public.service_parameter_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Masters can manage param defs" ON public.service_parameter_definitions FOR ALL TO authenticated USING (has_role(auth.uid(), 'master')) WITH CHECK (has_role(auth.uid(), 'master'));

-- projects: Ersteller und Master sehen alles, Durchführer sehen zugewiesene
CREATE POLICY "Users see own projects" ON public.projects FOR SELECT TO authenticated USING (
  created_by = auth.uid() OR has_role(auth.uid(), 'master') OR EXISTS (
    SELECT 1 FROM public.order_measurements om
    JOIN public.measurement_orders mo ON mo.id = om.order_id
    WHERE mo.project_id = projects.id AND om.assigned_to = auth.uid()
  )
);
CREATE POLICY "Auftraggeber and masters create projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = created_by AND (has_role(auth.uid(), 'auftraggeber') OR has_role(auth.uid(), 'master'))
);
CREATE POLICY "Auftraggeber update own projects" ON public.projects FOR UPDATE TO authenticated USING (
  created_by = auth.uid() OR has_role(auth.uid(), 'master')
);

-- measurement_orders: ähnliche Logik
CREATE POLICY "Users see relevant orders" ON public.measurement_orders FOR SELECT TO authenticated USING (
  created_by = auth.uid() OR has_role(auth.uid(), 'master') OR EXISTS (
    SELECT 1 FROM public.order_measurements om WHERE om.order_id = measurement_orders.id AND om.assigned_to = auth.uid()
  )
);
CREATE POLICY "Auftraggeber and masters create orders" ON public.measurement_orders FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = created_by AND (has_role(auth.uid(), 'auftraggeber') OR has_role(auth.uid(), 'master'))
);
CREATE POLICY "Users update relevant orders" ON public.measurement_orders FOR UPDATE TO authenticated USING (
  created_by = auth.uid() OR has_role(auth.uid(), 'master')
);

-- order_measurements
CREATE POLICY "Users see relevant measurements" ON public.order_measurements FOR SELECT TO authenticated USING (
  has_role(auth.uid(), 'master') OR assigned_to = auth.uid() OR EXISTS (
    SELECT 1 FROM public.measurement_orders mo WHERE mo.id = order_measurements.order_id AND mo.created_by = auth.uid()
  )
);
CREATE POLICY "Auftraggeber and masters insert measurements" ON public.order_measurements FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(), 'master') OR EXISTS (
    SELECT 1 FROM public.measurement_orders mo WHERE mo.id = order_id AND mo.created_by = auth.uid()
  )
);
CREATE POLICY "Relevant users update measurements" ON public.order_measurements FOR UPDATE TO authenticated USING (
  has_role(auth.uid(), 'master') OR assigned_to = auth.uid() OR EXISTS (
    SELECT 1 FROM public.measurement_orders mo WHERE mo.id = order_measurements.order_id AND mo.created_by = auth.uid()
  )
);

-- measurement_parameters: verknüpft über order_measurement
CREATE POLICY "Users see relevant params" ON public.measurement_parameters FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.order_measurements om WHERE om.id = order_measurement_id AND (
      om.assigned_to = auth.uid() OR has_role(auth.uid(), 'master') OR EXISTS (
        SELECT 1 FROM public.measurement_orders mo WHERE mo.id = om.order_id AND mo.created_by = auth.uid()
      )
    )
  )
);
CREATE POLICY "Users manage relevant params" ON public.measurement_parameters FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.order_measurements om WHERE om.id = order_measurement_id AND (
      om.assigned_to = auth.uid() OR has_role(auth.uid(), 'master') OR EXISTS (
        SELECT 1 FROM public.measurement_orders mo WHERE mo.id = om.order_id AND mo.created_by = auth.uid()
      )
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.order_measurements om WHERE om.id = order_measurement_id AND (
      om.assigned_to = auth.uid() OR has_role(auth.uid(), 'master') OR EXISTS (
        SELECT 1 FROM public.measurement_orders mo WHERE mo.id = om.order_id AND mo.created_by = auth.uid()
      )
    )
  )
);

-- work_logs: Durchführer erfassen eigene Zeiten
CREATE POLICY "Users see relevant work_logs" ON public.work_logs FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR has_role(auth.uid(), 'master') OR EXISTS (
    SELECT 1 FROM public.order_measurements om
    JOIN public.measurement_orders mo ON mo.id = om.order_id
    WHERE om.id = order_measurement_id AND mo.created_by = auth.uid()
  )
);
CREATE POLICY "Durchfuehrer create own logs" ON public.work_logs FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND (has_role(auth.uid(), 'durchfuehrer') OR has_role(auth.uid(), 'master'))
);
CREATE POLICY "Users update own logs" ON public.work_logs FOR UPDATE TO authenticated USING (
  user_id = auth.uid() OR has_role(auth.uid(), 'master')
);
CREATE POLICY "Users delete own logs" ON public.work_logs FOR DELETE TO authenticated USING (
  user_id = auth.uid() OR has_role(auth.uid(), 'master')
);

-- documents
CREATE POLICY "Users see relevant docs" ON public.documents FOR SELECT TO authenticated USING (
  uploaded_by = auth.uid() OR has_role(auth.uid(), 'master') OR EXISTS (
    SELECT 1 FROM public.order_measurements om
    JOIN public.measurement_orders mo ON mo.id = om.order_id
    WHERE om.id = order_measurement_id AND (om.assigned_to = auth.uid() OR mo.created_by = auth.uid())
  )
);
CREATE POLICY "Relevant users upload docs" ON public.documents FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = uploaded_by AND (
    has_role(auth.uid(), 'master') OR has_role(auth.uid(), 'durchfuehrer') OR EXISTS (
      SELECT 1 FROM public.order_measurements om
      JOIN public.measurement_orders mo ON mo.id = om.order_id
      WHERE om.id = order_measurement_id AND mo.created_by = auth.uid()
    )
  )
);

-- =============================================
-- Updated_at Trigger für alle relevanten Tabellen
-- =============================================
CREATE TRIGGER update_measurement_services_updated_at BEFORE UPDATE ON public.measurement_services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_measurement_orders_updated_at BEFORE UPDATE ON public.measurement_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_order_measurements_updated_at BEFORE UPDATE ON public.order_measurements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Storage Bucket für Messprotokolle
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('measurement-documents', 'measurement-documents', false);

CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'measurement-documents');
CREATE POLICY "Users can view own uploads" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'measurement-documents');
CREATE POLICY "Users can delete own uploads" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'measurement-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================
-- Initiale Messdienstleistungen (Masterdaten)
-- =============================================
INSERT INTO public.measurement_services (service_name, category, hourly_rate) VALUES
  ('RFA', 'labor', 85.00),
  ('XRD', 'labor', 95.00),
  ('NOX-Messung', 'labor', 75.00),
  ('CO-Messung', 'labor', 75.00),
  ('CO₂-Messung', 'labor', 75.00),
  ('PGV (Hg)', 'labor', 90.00),
  ('DIL', 'labor', 80.00),
  ('BET', 'labor', 85.00),
  ('STA', 'labor', 90.00),
  ('BENCH', 'labor', 70.00),
  ('Festigkeit', 'pilot_plant', 65.00),
  ('Schwindung', 'pilot_plant', 60.00),
  ('Porosität', 'pilot_plant', 70.00),
  ('Rohbruchfestigkeit', 'pilot_plant', 65.00),
  ('Extrusion', 'pilot_plant', 80.00),
  ('Trocknen', 'pilot_plant', 55.00),
  ('Brennen', 'pilot_plant', 75.00),
  ('pH-Wert', 'pilot_plant', 45.00),
  ('Penetrometer', 'pilot_plant', 60.00),
  ('Feuchte', 'pilot_plant', 50.00),
  ('Plastizität', 'pilot_plant', 65.00);

-- Realtime für relevante Tabellen
ALTER PUBLICATION supabase_realtime ADD TABLE public.measurement_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_measurements;
