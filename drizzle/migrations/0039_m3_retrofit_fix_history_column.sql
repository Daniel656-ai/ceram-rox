DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.m3_retrofit_order_samples(uuid, jsonb)'::regprocedure);
  d := replace(d, 'sample_history(sample_id, action, user_id, details)', 'sample_history(sample_id, action, user_id, metadata)');
  EXECUTE d;
END $do$;