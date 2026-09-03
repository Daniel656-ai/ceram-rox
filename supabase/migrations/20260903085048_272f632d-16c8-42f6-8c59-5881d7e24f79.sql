CREATE OR REPLACE FUNCTION public.service_required_services(_service_id uuid)
RETURNS TABLE (service_id uuid, service_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE direct AS (
    SELECT d.service_id AS src, d.requires_service_id AS req
    FROM public.service_dependencies d
    UNION ALL
    SELECT ps_own.service_id, ps.service_id
    FROM public.process_steps ps
    JOIN public.process_steps ps_own
      ON ps_own.template_id = ps.template_id
     AND ps_own.step_kind = 'service'
     AND ps.order_index < ps_own.order_index
    WHERE ps.step_kind = 'service'
      AND ps.service_id IS NOT NULL
      AND ps_own.service_id IS NOT NULL
      AND ps.service_id <> ps_own.service_id
    UNION ALL
    SELECT s.id, l.service_id
    FROM public.measurement_services s
    JOIN public.process_service_links l ON l.process_template_id = s.process_template_id
    WHERE l.service_id IS NOT NULL AND l.service_id <> s.id
  ),
  walk AS (
    SELECT d.req AS id, 1 AS depth
    FROM direct d
    WHERE d.src = _service_id
    UNION
    SELECT d.req, w.depth + 1
    FROM walk w
    JOIN direct d ON d.src = w.id
    WHERE w.depth < 5 AND d.req <> _service_id
  )
  SELECT DISTINCT ms.id, ms.service_name
  FROM walk w
  JOIN public.measurement_services ms ON ms.id = w.id
  WHERE ms.id <> _service_id;
$$;

REVOKE ALL ON FUNCTION public.service_required_services(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.service_required_services(uuid) TO authenticated, service_role;