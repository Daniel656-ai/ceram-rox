-- 0050: m³-Liste löschen erkennt auch die Proben der Lovable-Probenanlage (Aufgabe 024, Übernahme nach Prod).
--
-- ============================================================================================
-- DATENBANK-ÄNDERUNG – nach der Reihenfolge 0036 bis 0049 einspielen (Prod: zusammen mit der Übernahme, nach Freigabe
-- durch Stefan). Rechte unverändert.
-- ============================================================================================
-- Hintergrund: Lovable legt Proben aus der m³-Liste (und die Nachrüstung "Proben-Nachprüfung") mit der Beschreibung
-- "m³-Liste Zeile N" an; unsere Löschfunktion erkannte bisher nur "Aus m³-Liste …" als aus der m³-Liste erzeugt und hätte diese
-- Proben beim Löschen der m³-Liste stehen lassen. Jetzt gelten beide Beschreibungen. ALLE anderen Bedingungen (Status "neu",
-- an keinem weiteren Auftrag, an keiner Messung, keine Rohdaten/Dokumente/Historie usw.) bleiben unverändert, es wird also
-- nichts zusätzlich gelöscht, was irgendwo benutzt wird.
-- Funktionstext 1:1 aus 0044, einzige Änderung: die Beschreibungs-Bedingung. Mehrfach ausführbar (CREATE OR REPLACE).

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
    IF s.description IS NULL OR NOT (s.description LIKE 'Aus m³-Liste%' OR s.description LIKE 'm³-Liste Zeile %') THEN _r := _r || 'nicht aus der m³-Liste erzeugt'::text; END IF;
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
