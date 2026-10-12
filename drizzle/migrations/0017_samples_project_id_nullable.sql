-- Proben dürfen ohne Projekt angelegt werden (projektfreie Kunden-/Produktionsaufträge).
-- Fremdschlüssel zu projects(id), Daten, RLS bleiben unverändert.
-- Rücknahme (nur wenn keine NULL-Werte existieren): ALTER TABLE public.samples ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE public.samples ALTER COLUMN project_id DROP NOT NULL;