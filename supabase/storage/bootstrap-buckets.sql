-- ROX – Storage-Buckets Bootstrap (idempotent)
--
-- Hintergrund:
-- Die Buckets `measurement-documents`, `sample-documents` und
-- `raw-material-documents` werden über reguläre Migrationen angelegt.
-- Die Buckets `order-uploads`, `order-reports`, `project-documents` und
-- `portfolio-documents` wurden dagegen ursprünglich über das Backend-Tooling
-- erstellt und existieren deshalb NICHT in `supabase/migrations`.
--
-- Folge: In einer frisch aufgesetzten Umgebung (z. B. Desktop-/Intranet-Release
-- mit eigenem Backend, lokale Instanz, Testsystem) fehlen diese Buckets und
-- jeder Upload – auch der Bildupload der Fotodokumentation – schlägt mit
-- „Bucket not found“ fehl.
--
-- Diese Datei einmalig gegen eine neue Umgebung ausführen (psql / SQL-Editor).
-- Alle Buckets bleiben privat; der Zugriff wird ausschließlich über die
-- bestehenden RLS-Policies auf `storage.objects` geregelt (siehe Migrationen).

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('order-uploads',        'order-uploads',        false),
  ('order-reports',        'order-reports',        false),
  ('project-documents',    'project-documents',    false),
  ('portfolio-documents',  'portfolio-documents',  false),
  ('measurement-documents','measurement-documents',false),
  ('sample-documents',     'sample-documents',     false),
  ('raw-material-documents','raw-material-documents',false)
ON CONFLICT (id) DO NOTHING;
