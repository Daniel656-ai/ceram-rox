CREATE TABLE public.form_calculations (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.form_definitions(id) on delete cascade,
  calc_key text not null,
  display_name text not null,
  description text,
  formula text not null default '',
  /** visual builder state: [{kind:'field'|'calc'|'const', ref, value}] with operators */
  expression jsonb not null default '[]'::jsonb,
  inputs jsonb not null default '[]'::jsonb,
  unit text,
  decimals integer not null default 2,
  rounding text not null default 'round',
  result_type text not null default 'decimal',
  sort_order integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_id, calc_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_calculations TO authenticated;
GRANT ALL ON public.form_calculations TO service_role;

ALTER TABLE public.form_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "form calculations readable" ON public.form_calculations FOR SELECT TO authenticated USING (true);
CREATE POLICY "form calculations insert" ON public.form_calculations FOR INSERT TO authenticated WITH CHECK (can_manage_designer(auth.uid()));
CREATE POLICY "form calculations update" ON public.form_calculations FOR UPDATE TO authenticated USING (can_manage_designer(auth.uid())) WITH CHECK (can_manage_designer(auth.uid()));
CREATE POLICY "form calculations delete" ON public.form_calculations FOR DELETE TO authenticated USING (can_manage_designer(auth.uid()));

CREATE TRIGGER form_calculations_updated_at BEFORE UPDATE ON public.form_calculations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();