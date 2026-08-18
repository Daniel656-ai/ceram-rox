
CREATE TABLE public.measurement_import_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'clipboard',
  format TEXT NOT NULL DEFAULT 'auto',
  decimal_separator TEXT NOT NULL DEFAULT 'auto',
  default_unit TEXT,
  mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.measurement_import_profiles TO authenticated;
GRANT ALL ON public.measurement_import_profiles TO service_role;

ALTER TABLE public.measurement_import_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import profiles readable" ON public.measurement_import_profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "import profiles insert" ON public.measurement_import_profiles
  FOR INSERT TO authenticated WITH CHECK (can_manage_designer(auth.uid()));
CREATE POLICY "import profiles update" ON public.measurement_import_profiles
  FOR UPDATE TO authenticated USING (can_manage_designer(auth.uid())) WITH CHECK (can_manage_designer(auth.uid()));
CREATE POLICY "import profiles delete" ON public.measurement_import_profiles
  FOR DELETE TO authenticated USING (can_manage_designer(auth.uid()));

CREATE TRIGGER trg_measurement_import_profiles_updated_at
  BEFORE UPDATE ON public.measurement_import_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.measurement_import_profiles (name, description, format, decimal_separator, default_unit, mappings)
VALUES (
  'RFA',
  'Röntgenfluoreszenzanalyse – Oxidgehalte aus der RFA-Software (Zwischenablage).',
  'auto',
  'auto',
  '%',
  '[
    {"source_names":["SiO2","SiO₂","SiO 2"],"target_field_key":"sio2","unit":"%"},
    {"source_names":["Al2O3","Al₂O₃"],"target_field_key":"al2o3","unit":"%"},
    {"source_names":["Fe2O3","Fe₂O₃"],"target_field_key":"fe2o3","unit":"%"},
    {"source_names":["TiO2","TiO₂"],"target_field_key":"tio2","unit":"%"},
    {"source_names":["CaO"],"target_field_key":"cao","unit":"%"},
    {"source_names":["MgO"],"target_field_key":"mgo","unit":"%"},
    {"source_names":["K2O","K₂O"],"target_field_key":"k2o","unit":"%"},
    {"source_names":["Na2O","Na₂O"],"target_field_key":"na2o","unit":"%"},
    {"source_names":["V2O5","V₂O₅"],"target_field_key":"v2o5","unit":"%"}
  ]'::jsonb
);

INSERT INTO public.measurement_import_profiles (name, description, format, default_unit, mappings)
VALUES
 ('Partikelgrößenanalyse','Korngrößenverteilung (D10/D50/D90).','auto','µm',
  '[{"source_names":["D10"],"target_field_key":"d10","unit":"µm"},{"source_names":["D50"],"target_field_key":"d50","unit":"µm"},{"source_names":["D90"],"target_field_key":"d90","unit":"µm"}]'::jsonb),
 ('Feuchtemessung','Feuchte und Temperatur aus dem Feuchtemessgerät.','auto',NULL,
  '[{"source_names":["Feuchte","Moisture"],"target_field_key":"feuchte","unit":"%"},{"source_names":["Temperatur","Temperature"],"target_field_key":"temperatur","unit":"°C"},{"source_names":["Messzeit"],"target_field_key":"messzeit","unit":"s"}]'::jsonb),
 ('Porenvolumen','Porenvolumen, Porengröße und spezifische Oberfläche.','auto',NULL,
  '[{"source_names":["Porenvolumen"],"target_field_key":"porenvolumen","unit":"cm³/g"},{"source_names":["Porengröße","Porengroesse"],"target_field_key":"porengroesse","unit":"nm"},{"source_names":["Spez. Oberfläche","Spezifische Oberfläche","BET"],"target_field_key":"spez_oberflaeche","unit":"m²/g"}]'::jsonb);
