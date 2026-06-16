
-- Phase 1: Rohstoffstamm-Erweiterung + Chargen-Status + Gebinde-Stammdaten

-- 1) Rohstoffstamm: EG-Nr, Hersteller, SDB
ALTER TABLE public.raw_materials
  ADD COLUMN IF NOT EXISTS eg_number text,
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS sds_storage_path text,
  ADD COLUMN IF NOT EXISTS sds_file_name text,
  ADD COLUMN IF NOT EXISTS sds_uploaded_at timestamptz;

-- 2) Rohstoffchargen: Status, Herstellercharge, Wareneingang
DO $$ BEGIN
  CREATE TYPE public.raw_batch_release_status AS ENUM ('gesperrt','in_pruefung','freigegeben','abgelehnt');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.raw_batch_inspection_status AS ENUM ('ausstehend','laufend','bestanden','nicht_bestanden');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.raw_material_batches
  ADD COLUMN IF NOT EXISTS manufacturer_batch text,
  ADD COLUMN IF NOT EXISTS goods_receipt_date date,
  ADD COLUMN IF NOT EXISTS release_status public.raw_batch_release_status NOT NULL DEFAULT 'in_pruefung',
  ADD COLUMN IF NOT EXISTS inspection_status public.raw_batch_inspection_status NOT NULL DEFAULT 'ausstehend',
  ADD COLUMN IF NOT EXISTS released_by uuid,
  ADD COLUMN IF NOT EXISTS released_at timestamptz;

-- 3) Gebindeverwaltung
DO $$ BEGIN
  CREATE TYPE public.container_kind AS ENUM ('fass','kanister','sack','big_bag','ibc','tank','flasche','sonstige');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.container_status AS ENUM ('verfuegbar','reserviert','in_verwendung','leer','gesperrt','entsorgt');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.raw_material_containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.raw_material_batches(id) ON DELETE SET NULL,
  container_code text NOT NULL,
  barcode text,
  kind public.container_kind NOT NULL DEFAULT 'fass',
  initial_quantity numeric NOT NULL DEFAULT 0,
  current_quantity numeric NOT NULL DEFAULT 0,
  reserved_quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'kg',
  status public.container_status NOT NULL DEFAULT 'verfuegbar',
  location_id uuid REFERENCES public.storage_locations(id) ON DELETE SET NULL,
  location_note text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT raw_material_containers_code_unique UNIQUE (container_code)
);

CREATE INDEX IF NOT EXISTS idx_containers_material ON public.raw_material_containers(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_containers_batch ON public.raw_material_containers(batch_id);
CREATE INDEX IF NOT EXISTS idx_containers_barcode ON public.raw_material_containers(barcode);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.raw_material_containers TO authenticated;
GRANT ALL ON public.raw_material_containers TO service_role;

ALTER TABLE public.raw_material_containers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "containers_read_auth"
  ON public.raw_material_containers FOR SELECT TO authenticated USING (true);

CREATE POLICY "containers_write_manage"
  ON public.raw_material_containers FOR ALL TO authenticated
  USING (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'))
  WITH CHECK (has_role(auth.uid(),'master'::app_role) OR has_permission(auth.uid(),'raw_materials.manage'));

CREATE TRIGGER trg_containers_updated_at
  BEFORE UPDATE ON public.raw_material_containers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Auto-Container-Code Generator (laufend pro Charge: GEB-<batchno>-NNN, Fallback ohne Charge)
CREATE OR REPLACE FUNCTION public.generate_container_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_batch_no text;
  v_prefix text;
  v_next int;
BEGIN
  IF NEW.container_code IS NOT NULL AND length(NEW.container_code) > 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.batch_id IS NOT NULL THEN
    SELECT batch_number INTO v_batch_no FROM raw_material_batches WHERE id = NEW.batch_id;
    v_prefix := 'GEB-' || COALESCE(v_batch_no, NEW.batch_id::text) || '-';
    PERFORM pg_advisory_xact_lock(hashtext('container_code_' || v_prefix));
    SELECT COALESCE(MAX(substring(container_code FROM length(v_prefix) + 1)::int), 0) + 1
      INTO v_next
      FROM raw_material_containers
      WHERE container_code LIKE v_prefix || '%'
        AND substring(container_code FROM length(v_prefix) + 1) ~ '^[0-9]+$';
    NEW.container_code := v_prefix || lpad(v_next::text, 3, '0');
  ELSE
    v_prefix := 'GEB-FREI-';
    PERFORM pg_advisory_xact_lock(hashtext('container_code_free'));
    SELECT COALESCE(MAX(substring(container_code FROM length(v_prefix) + 1)::int), 0) + 1
      INTO v_next
      FROM raw_material_containers
      WHERE container_code LIKE v_prefix || '%'
        AND substring(container_code FROM length(v_prefix) + 1) ~ '^[0-9]+$';
    NEW.container_code := v_prefix || lpad(v_next::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_container_code
  BEFORE INSERT ON public.raw_material_containers
  FOR EACH ROW EXECUTE FUNCTION public.generate_container_code();

-- 5) Auto-Migration: pro vorhandener Charge ein Standard-Gebinde
INSERT INTO public.raw_material_containers (
  raw_material_id, batch_id, container_code, kind,
  initial_quantity, current_quantity, unit, status, location_id, created_by, notes
)
SELECT
  b.raw_material_id,
  b.id,
  'GEB-' || b.batch_number || '-001',
  'fass'::public.container_kind,
  COALESCE(b.delivery_quantity, 0),
  COALESCE(b.delivery_quantity, 0),
  COALESCE(rm.unit, 'kg'),
  'verfuegbar'::public.container_status,
  rm.default_location_id,
  rm.created_by,
  'Automatisch migriertes Standard-Gebinde'
FROM public.raw_material_batches b
JOIN public.raw_materials rm ON rm.id = b.raw_material_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.raw_material_containers c WHERE c.batch_id = b.id
);
