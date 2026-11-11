CREATE OR REPLACE FUNCTION public.prevent_mandatory_wp_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  -- Das Pflicht-Arbeitspaket darf nicht einzeln gelöscht werden,
  -- solange das zugehörige Projekt noch in public.projects existiert.
  -- Wird das übergeordnete Projekt gelöscht (ON DELETE CASCADE),
  -- existiert die Projektzeile in diesem Statement nicht mehr;
  -- das Löschen wird dann zugelassen.
  -- SECURITY DEFINER + search_path=public: die EXISTS-Prüfung sieht
  -- unabhängig von den Leserechten (RLS) des aufrufenden Benutzers
  -- immer alle Projekte. Die Funktion löscht selbst nichts.
  IF OLD.is_mandatory AND EXISTS (SELECT 1 FROM public.projects WHERE id = OLD.project_id) THEN
    RAISE EXCEPTION 'Das Pflicht-Arbeitspaket "%" kann nicht gelöscht werden.', OLD.title USING ERRCODE='P0001';
  END IF;
  RETURN OLD;
END $function$;