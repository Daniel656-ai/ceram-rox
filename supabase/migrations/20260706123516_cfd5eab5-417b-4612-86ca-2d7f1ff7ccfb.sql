ALTER TABLE public.measurement_services
ADD COLUMN IF NOT EXISTS work_instructions text;

COMMENT ON COLUMN public.measurement_services.work_instructions IS 'Arbeitsauftrag: Vorgaben und Anweisungen, die der Messdienstleister bei der Abarbeitung sieht. Vom Techniker im Service Designer gepflegt, vom Messdienstleister nur lesbar.';