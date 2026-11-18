-- 0044: Korrektur von public.m3_list_sample_plan (gleicher Fehler wie in 0043: "malformed array literal").
--
-- ============================================================================================
-- DATENBANK-/BERECHTIGUNGSÄNDERUNG – vor der Übertragung nach PRODUKTION ist die Freigabe durch
-- Stefan erforderlich. In der Dev-Datenbank wird sie normal über den Merge eingespielt.
-- ============================================================================================
-- Ursache: In 0038 steht  _r := _r || 'nicht aus der m³-Liste erzeugt';  (text[] || unbekanntes Literal). PostgreSQL deutet
-- das Literal als Array-Literal und bricht ab, sobald eine Probe der m³-Liste einen Grund hat, NICHT löschbar zu sein
-- (betrifft m3_list_delete_plan / delete_m3_list). Korrektur: ausschließlich explizite Typangabe ('…'::text) an den 11 Stellen.
-- Fachlogik, Rechte (REVOKE wie in 0038) und Rückgabe sind UNVERÄNDERT; 0038 bleibt unangetastet.
-- Mehrfach ausführbar (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.m3_list_sample_plan(_order_id uuid)
RETURNS TABLE(sample_id uuid, sample_name text, deletable boolean, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; _r text[];
BEGIN
  FOR s IN
    SELECT sa.id, sa.sample_name, sa.description, sa.status::text AS status
    FROM public.order_samples os JOIN public.samples sa ON sa.id = os.sample_id
    WHERE os.order_id = _order_id ORDER BY sa.sample_name
  LOOP
    _r := ARRAY[]::text[];
    IF s.description IS NULL OR s.description NOT LIKE 'Aus m³-Liste%' THEN _r := _r || 'nicht aus der m³-Liste erzeugt'::text; END IF;
    IF s.status <> 'neu' THEN _r := _r || 'Status nicht „neu“'::text; END IF;
    IF EXISTS(SELECT 1 FROM public.order_samples o2 WHERE o2.sample_id = s.id AND o2.order_id <> _order_id)
      OR EXISTS(SELECT 1 FROM public.measurement_orders mo WHERE mo.sample_id = s.id AND mo.id <> _order_id)
      THEN _r := _r || 'an einem weiteren Auftrag'::text; END IF;
    IF EXISTS(SELECT 1 FROM public.order_measurements m WHERE m.sample_id = s.id OR m.original_sample_id = s.id)
      THEN _r := _r || 'an einer Messung'::text; END IF;
    IF EXISTS(SELECT 1 FROM public.measurement_raw_datasets d WHERE d.sample_id = s.id) THEN _r := _r || 'Rohdaten vorhanden'::text; END IF;
    IF EXISTS(SELECT 1 FROM public.order_step_positions p WHERE p.sample_id = s.id)
      OR EXISTS(SELECT 1 FROM public.order_workflow_task_positions p WHERE p.sample_id = s.id)
      THEN _r := _r || 'an einer Aufgabenposition'::text; END IF;
    IF EXISTS(SELECT 1 FROM public.pilot_plant_produced_samples p WHERE p.created_sample_id = s.id)
      THEN _r := _r || 'Technikumsprobe'::text; END IF;
    IF EXISTS(SELECT 1 FROM public.sample_documents d WHERE d.sample_id = s.id) THEN _r := _r || 'Probendokumente vorhanden'::text; END IF;
    IF EXISTS(SELECT 1 FROM public.sample_geometry_datasets d WHERE d.sample_id = s.id) THEN _r := _r || 'Geometriedaten vorhanden'::text; END IF;
    IF EXISTS(SELECT 1 FROM public.sample_history h WHERE h.sample_id = s.id AND h.action <> 'created')
      THEN _r := _r || 'Probenhistorie (Status-/Lagerortwechsel)'::text; END IF;
    IF EXISTS(SELECT 1 FROM public.samples c WHERE c.parent_sample_id = s.id) THEN _r := _r || 'Unterproben vorhanden'::text; END IF;
    sample_id := s.id; sample_name := s.sample_name;
    deletable := cardinality(_r) = 0;
    reason := CASE WHEN cardinality(_r) = 0 THEN NULL ELSE array_to_string(_r, ', ') END;
    RETURN NEXT;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.m3_list_sample_plan(uuid) FROM PUBLIC, anon, authenticated;
