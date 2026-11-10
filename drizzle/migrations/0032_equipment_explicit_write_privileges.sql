REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.test_equipment,public.test_equipment_checks FROM anon,authenticated;
REVOKE ALL ON public.equipment_rpc_guard FROM anon,authenticated;
GRANT SELECT ON public.test_equipment,public.test_equipment_checks TO authenticated;
GRANT ALL ON public.test_equipment,public.test_equipment_checks,public.equipment_rpc_guard TO service_role;