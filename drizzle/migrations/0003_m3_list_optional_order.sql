-- m³-Liste darf auch ohne zugeordneten ROX-Auftrag existieren.
-- Aufhebung des Pflichtfelds ist rein erweiternd: bestehende Zeilen und
-- auftragsbezogene Folgeprozesse bleiben unverändert gültig.
ALTER TABLE public.production_document_requests ALTER COLUMN order_id DROP NOT NULL;