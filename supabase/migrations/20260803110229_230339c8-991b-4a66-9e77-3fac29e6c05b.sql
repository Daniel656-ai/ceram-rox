CREATE TABLE public.global_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  category text,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_objects TO authenticated;
GRANT ALL ON public.global_objects TO service_role;
ALTER TABLE public.global_objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "global_objects readable" ON public.global_objects FOR SELECT TO authenticated USING (true);
CREATE POLICY "global_objects insert" ON public.global_objects FOR INSERT TO authenticated WITH CHECK (can_manage_designer(auth.uid()));
CREATE POLICY "global_objects update" ON public.global_objects FOR UPDATE TO authenticated USING (can_manage_designer(auth.uid())) WITH CHECK (can_manage_designer(auth.uid()));
CREATE POLICY "global_objects delete" ON public.global_objects FOR DELETE TO authenticated USING (can_manage_designer(auth.uid()));

CREATE TABLE public.global_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id uuid NOT NULL REFERENCES public.global_objects(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  display_name text NOT NULL,
  description text,
  data_type text NOT NULL DEFAULT 'text',
  category text,
  unit text,
  default_value text,
  data_source text NOT NULL DEFAULT 'manual',
  select_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (object_id, field_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_fields TO authenticated;
GRANT ALL ON public.global_fields TO service_role;
ALTER TABLE public.global_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "global_fields readable" ON public.global_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "global_fields insert" ON public.global_fields FOR INSERT TO authenticated WITH CHECK (can_manage_designer(auth.uid()));
CREATE POLICY "global_fields update" ON public.global_fields FOR UPDATE TO authenticated USING (can_manage_designer(auth.uid())) WITH CHECK (can_manage_designer(auth.uid()));
CREATE POLICY "global_fields delete" ON public.global_fields FOR DELETE TO authenticated USING (can_manage_designer(auth.uid()));

CREATE INDEX idx_global_fields_object ON public.global_fields(object_id);

CREATE OR REPLACE FUNCTION public.global_fields_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.field_key IS DISTINCT FROM OLD.field_key THEN
      RAISE EXCEPTION 'Die technische ID eines globalen Feldes darf nicht geaendert werden';
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_global_fields_guard
BEFORE UPDATE ON public.global_fields
FOR EACH ROW EXECUTE FUNCTION public.global_fields_guard();

CREATE OR REPLACE FUNCTION public.global_objects_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_global_objects_touch
BEFORE UPDATE ON public.global_objects
FOR EACH ROW EXECUTE FUNCTION public.global_objects_touch();

INSERT INTO public.global_objects (object_key, display_name, category, sort_order, is_system) VALUES
  ('order','Auftrag','Kern',10,true),
  ('project','Projekt','Kern',20,true),
  ('sample','Probe','Kern',30,true),
  ('raw_material','Rohstoff','Kern',40,true),
  ('service','Dienstleistung','Kern',50,true),
  ('process','Prozess','Prozess',60,true),
  ('extrusion','Extrusion','Prozess',70,true),
  ('firing','Brennen','Prozess',80,true),
  ('lab_test','Laborprüfung','Prozess',90,true),
  ('result','Ergebnis','Ergebnis',100,true),
  ('document','Dokument','Anhang',110,true),
  ('image','Bild','Anhang',120,true),
  ('user','Benutzer','Stammdaten',130,true),
  ('machine','Maschine','Stammdaten',140,true);