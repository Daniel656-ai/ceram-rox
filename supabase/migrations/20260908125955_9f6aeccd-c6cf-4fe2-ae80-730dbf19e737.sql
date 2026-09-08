-- Liefermenge systemweit auf max. 3 Nachkommastellen (kaufmännisch gerundet) – additiv, keine Strukturänderung
CREATE OR REPLACE FUNCTION public.normalize_batch_delivery_quantity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.delivery_quantity IS NOT NULL THEN
    NEW.delivery_quantity := round(NEW.delivery_quantity, 3);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_batch_delivery_quantity ON public.raw_material_batches;
CREATE TRIGGER trg_normalize_batch_delivery_quantity
BEFORE INSERT OR UPDATE OF delivery_quantity ON public.raw_material_batches
FOR EACH ROW EXECUTE FUNCTION public.normalize_batch_delivery_quantity();