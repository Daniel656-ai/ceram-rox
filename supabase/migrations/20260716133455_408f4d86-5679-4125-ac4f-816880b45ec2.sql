
-- 1) Mapping table: Auftragsart → Formular-Template
CREATE TABLE public.order_kind_form_templates (
  order_kind text PRIMARY KEY,
  form_definition_id uuid NOT NULL REFERENCES public.form_definitions(id) ON DELETE RESTRICT,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_kind_form_templates TO authenticated;
GRANT ALL ON public.order_kind_form_templates TO service_role;
ALTER TABLE public.order_kind_form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "okft read authenticated"
  ON public.order_kind_form_templates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "okft master manage"
  ON public.order_kind_form_templates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'master'))
  WITH CHECK (public.has_role(auth.uid(),'master'));

CREATE TRIGGER trg_okft_updated_at
  BEFORE UPDATE ON public.order_kind_form_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Seed: Pilot-Plant Formulartemplate + Zuordnung zu 'pilot_plant' und 'combined'
DO $$
DECLARE
  v_form_id uuid;
  v_zusatz_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.order_kind_form_templates WHERE order_kind IN ('pilot_plant','combined')
  ) THEN
    INSERT INTO public.form_definitions (name, description, scope, layout)
    VALUES ('Pilot Plant Auftragsformular',
            'Standardformular für Aufträge der Auftragsart „Pilot Plant". Bearbeitbar im Formulardesigner.',
            'global', '{}'::jsonb)
    RETURNING id INTO v_form_id;

    -- Stammdaten
    INSERT INTO public.form_fields (form_id, field_key, display_name, field_type, category, sort_order, is_required) VALUES
      (v_form_id, 'experiment_number', 'Versuchsnummer',   'text',    'Stammdaten', 10, true),
      (v_form_id, 'experiment_date',   'Datum',            'date',    'Stammdaten', 20, false),
      (v_form_id, 'v2o5_percent',      '% V₂O₅',           'decimal', 'Stammdaten', 30, false),
      (v_form_id, 'masse_type',        'Massetyp',         'select',  'Stammdaten', 40, false),
      (v_form_id, 'previous_experiments','Frühere Versuche','text',   'Stammdaten', 50, false),
      (v_form_id, 'remarks',           'Bemerkungen',      'longtext','Stammdaten', 60, false);

    UPDATE public.form_fields SET select_options = '["DK","GK","KK","MK","PK"]'::jsonb
      WHERE form_id = v_form_id AND field_key = 'masse_type';

    -- Art des Versuches
    INSERT INTO public.form_fields (form_id, field_key, display_name, field_type, category, sort_order, is_required) VALUES
      (v_form_id, 'rezeptbasis',   'Rezeptbasis',   'text',        'Art des Versuches', 110, false),
      (v_form_id, 'variante',      'Variante',      'text',        'Art des Versuches', 120, false),
      (v_form_id, 'hauptrohstoff', 'Hauptrohstoff', 'ref_material','Art des Versuches', 130, false),
      (v_form_id, 'lotnummer',     'Lotnummer',     'text',        'Art des Versuches', 140, false),
      (v_form_id, 'rezeptversion', 'Rezeptversion', 'text',        'Art des Versuches', 150, false);

    UPDATE public.form_fields SET readonly = true, description = 'Wird aus dem gewählten Gebinde/Lot übernommen.'
      WHERE form_id = v_form_id AND field_key = 'lotnummer';

    -- Repeater: Zusatzstoffe
    INSERT INTO public.form_fields (form_id, field_key, display_name, field_type, category, sort_order, metadata)
    VALUES (v_form_id, 'zusatzstoffe', 'Zusatzstoffe', 'repeater', 'Art des Versuches', 160,
            jsonb_build_object('repeater', jsonb_build_object(
              'min_entries', 0,
              'item_label', 'Zusatzstoff',
              'add_label', 'Zusatzstoff hinzufügen'
            )))
    RETURNING id INTO v_zusatz_id;

    INSERT INTO public.form_fields (form_id, field_key, display_name, field_type, parent_field_id, sort_order) VALUES
      (v_form_id, 'zusatzstoff', 'Zusatzstoff', 'text',    v_zusatz_id, 10),
      (v_form_id, 'menge',       'Menge',       'decimal', v_zusatz_id, 20),
      (v_form_id, 'einheit',     'Einheit',     'text',    v_zusatz_id, 30);

    -- Versuchsziel + Bemerkung
    INSERT INTO public.form_fields (form_id, field_key, display_name, field_type, category, sort_order, select_options) VALUES
      (v_form_id, 'versuchsziel', 'Versuchsziel', 'multiselect', 'Art des Versuches', 170,
       '["Knetverhalten","Extrusionsverhalten","Trocknungsverhalten","Schwindung","Brennverhalten","Sonstiges"]'::jsonb);

    INSERT INTO public.form_fields (form_id, field_key, display_name, field_type, category, sort_order) VALUES
      (v_form_id, 'bemerkung_versuch', 'Bemerkung zum Versuch', 'longtext', 'Art des Versuches', 180);

    -- Mapping für die relevanten Auftragsarten
    INSERT INTO public.order_kind_form_templates (order_kind, form_definition_id)
    VALUES ('pilot_plant', v_form_id), ('combined', v_form_id)
    ON CONFLICT (order_kind) DO NOTHING;
  END IF;
END $$;
