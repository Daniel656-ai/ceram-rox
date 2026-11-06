ALTER TABLE public.measurement_services
  ADD COLUMN IF NOT EXISTS sla_monitoring_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sla_yellow_warning_days integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS sla_reminder_interval_days integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS sla_notification_roles text[] NOT NULL DEFAULT '{durchfuehrer}';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'measurement_services_sla_yellow_warning_days_check') THEN
    ALTER TABLE public.measurement_services
      ADD CONSTRAINT measurement_services_sla_yellow_warning_days_check CHECK (sla_yellow_warning_days >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'measurement_services_sla_reminder_interval_days_check') THEN
    ALTER TABLE public.measurement_services
      ADD CONSTRAINT measurement_services_sla_reminder_interval_days_check CHECK (sla_reminder_interval_days >= 1);
  END IF;
END $$;

COMMENT ON COLUMN public.measurement_services.sla_monitoring_enabled IS 'SLA-Terminüberwachung aktiv (Standard: aus)';