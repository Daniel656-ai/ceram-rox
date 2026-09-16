-- Additive Erweiterung: Die m³-Liste wird als vollwertige ROX-Formularinstanz
-- gespeichert. Es wird keine neue Tabelle angelegt; die bestehende Struktur der
-- Fertigungsunterlagen wird lediglich um die Referenz auf die verwendete
-- Formularvorlage und die erfassten Formularwerte (inkl. Repeater-Zeilen)
-- ergänzt. Revisionslogik (based_on_release_id) bleibt unverändert.
ALTER TABLE public.production_document_requests
  ADD COLUMN IF NOT EXISTS form_definition_id uuid REFERENCES public.form_definitions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS form_values jsonb NOT NULL DEFAULT '{}'::jsonb;
