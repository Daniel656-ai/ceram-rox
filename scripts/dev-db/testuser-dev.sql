-- Aufgabe 023: Testbenutzer für die DEV-Datenbank (NUR DEV – niemals in Produktion ausführen!).
--
-- Legt zwei Benutzer OHNE Master-Rolle an (Anmeldung per E-Mail/Passwort in der Dev-Oberfläche):
--   test-ersteller@example.test      Rolle "auftraggeber"   (= Ersteller ohne Master)
--   test-dienstleister@example.test  Rolle "durchfuehrer"   (= Messdienstleister)
--   Passwort für beide: Dev-Test-023!   (erfundenes Test-Passwort, nur für die Dev-Datenbank)
-- Master: ein vorhandener Master-Benutzer der Dev-Datenbank (keinen neuen anlegen).
--
-- Ausführen (am Server, im DEV-Container, Name VOR dem Ausführen prüfen – darf NICHT die Produktion sein):
--   docker exec -i supabase_db_ceram-rox-dev psql -U postgres -d postgres -v nur_dev=ja -f - < scripts/dev-db/testuser-dev.sql
-- Ohne  -v nur_dev=ja  bricht das Skript sofort ab. Mehrfach ausführbar (vorhandene Benutzer bleiben).
-- Aufräumen: siehe Ende der Datei.

\if :{?nur_dev}
\else
  \echo 'ABBRUCH: bitte mit -v nur_dev=ja starten und vorher pruefen, dass der Container die DEV-Datenbank ist.'
  \quit
\endif

SET search_path = public, extensions;

DO $$
DECLARE
  _users jsonb := '[
    {"id":"23000000-0000-0000-0000-000000000001","email":"test-ersteller@example.test","vorname":"Test","nachname":"Ersteller","rolle":"auftraggeber"},
    {"id":"23000000-0000-0000-0000-000000000002","email":"test-dienstleister@example.test","vorname":"Test","nachname":"Dienstleister","rolle":"durchfuehrer"}
  ]';
  _u jsonb;
  _id uuid;
BEGIN
  -- Schutz: Es darf nur ein Test-Postfach der Domain example.test angelegt werden.
  FOR _u IN SELECT * FROM jsonb_array_elements(_users) LOOP
    IF (_u->>'email') NOT LIKE '%@example.test' THEN RAISE EXCEPTION 'nur example.test erlaubt'; END IF;
    _id := (_u->>'id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _id) THEN
      INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                              raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                              confirmation_token, recovery_token, email_change_token_new, email_change)
      VALUES ('00000000-0000-0000-0000-000000000000', _id, 'authenticated', 'authenticated', _u->>'email',
              crypt('Dev-Test-023!', gen_salt('bf')), now(),
              '{"provider":"email","providers":["email"]}'::jsonb,
              jsonb_build_object('first_name', _u->>'vorname', 'last_name', _u->>'nachname'),
              now(), now(), '', '', '', '');
      INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), _id, _id::text,
              jsonb_build_object('sub', _id::text, 'email', _u->>'email', 'email_verified', true),
              'email', now(), now(), now());
    END IF;
    -- handle_new_user hat Profil und Rolle "auftraggeber" angelegt. Rolle auf den Sollwert bringen; Master nie vergeben.
    IF (_u->>'rolle') = 'durchfuehrer' THEN
      UPDATE public.user_roles
         SET role = 'durchfuehrer'::public.app_role, custom_role_id = '00000000-0000-0000-0000-000000000003'
       WHERE user_id = _id;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id IN ('23000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000002')
                                                  AND role = 'master') THEN
    RAISE EXCEPTION 'Testbenutzer dürfen keine Master-Rolle haben';
  END IF;
END $$;

SELECT u.email, r.role FROM auth.users u JOIN public.user_roles r ON r.user_id = u.id
 WHERE u.email LIKE '%@example.test' ORDER BY u.email;

-- Aufräumen (nur Dev, von Hand):
--   DELETE FROM auth.users WHERE email LIKE '%@example.test';   -- Profil/Rolle laufen per Kaskade mit
