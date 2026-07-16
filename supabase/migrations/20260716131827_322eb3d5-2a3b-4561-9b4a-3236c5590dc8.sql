-- Extend form_field_permissions with per-repeater rights (add/remove entries)
ALTER TABLE public.form_field_permissions
  ADD COLUMN IF NOT EXISTS can_add BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_remove BOOLEAN NOT NULL DEFAULT true;

-- Convenience: index for looking up child fields of a repeater
CREATE INDEX IF NOT EXISTS idx_form_fields_parent ON public.form_fields(parent_field_id);
