-- Globale Listen
CREATE TABLE public.global_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_lists TO authenticated;
GRANT ALL ON public.global_lists TO service_role;
ALTER TABLE public.global_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "global_lists_read" ON public.global_lists FOR SELECT TO authenticated USING (true);
CREATE POLICY "global_lists_write" ON public.global_lists FOR ALL TO authenticated
  USING (public.can_manage_designer(auth.uid())) WITH CHECK (public.can_manage_designer(auth.uid()));

CREATE TABLE public.global_list_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.global_lists(id) ON DELETE CASCADE,
  item_value TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (list_id, item_value)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_list_items TO authenticated;
GRANT ALL ON public.global_list_items TO service_role;
ALTER TABLE public.global_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "global_list_items_read" ON public.global_list_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "global_list_items_write" ON public.global_list_items FOR ALL TO authenticated
  USING (public.can_manage_designer(auth.uid())) WITH CHECK (public.can_manage_designer(auth.uid()));

-- Globale Berechnungen
CREATE TABLE public.global_calculations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calc_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  formula TEXT NOT NULL,
  unit TEXT,
  decimals INTEGER NOT NULL DEFAULT 2,
  inputs JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_calculations TO authenticated;
GRANT ALL ON public.global_calculations TO service_role;
ALTER TABLE public.global_calculations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "global_calculations_read" ON public.global_calculations FOR SELECT TO authenticated USING (true);
CREATE POLICY "global_calculations_write" ON public.global_calculations FOR ALL TO authenticated
  USING (public.can_manage_designer(auth.uid())) WITH CHECK (public.can_manage_designer(auth.uid()));

-- Globale Validierungen
CREATE TABLE public.global_validations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  validation_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  rule_type TEXT NOT NULL DEFAULT 'range',
  min_value NUMERIC,
  max_value NUMERIC,
  unit TEXT,
  pattern TEXT,
  expression TEXT,
  severity TEXT NOT NULL DEFAULT 'error',
  error_message TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_validations TO authenticated;
GRANT ALL ON public.global_validations TO service_role;
ALTER TABLE public.global_validations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "global_validations_read" ON public.global_validations FOR SELECT TO authenticated USING (true);
CREATE POLICY "global_validations_write" ON public.global_validations FOR ALL TO authenticated
  USING (public.can_manage_designer(auth.uid())) WITH CHECK (public.can_manage_designer(auth.uid()));

-- Optionale Referenzen auf globalen Feldern (additiv, nullable)
ALTER TABLE public.global_fields
  ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES public.global_lists(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS calculation_id UUID REFERENCES public.global_calculations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validation_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS is_repeatable BOOLEAN NOT NULL DEFAULT false;

-- updated_at Trigger
CREATE TRIGGER trg_global_lists_updated_at BEFORE UPDATE ON public.global_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_global_list_items_updated_at BEFORE UPDATE ON public.global_list_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_global_calculations_updated_at BEFORE UPDATE ON public.global_calculations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_global_validations_updated_at BEFORE UPDATE ON public.global_validations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();