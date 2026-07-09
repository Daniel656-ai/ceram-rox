
CREATE POLICY "order_reports_bucket_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'order-reports' AND (
    public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'reports.view')
  ));

CREATE POLICY "order_reports_bucket_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'order-reports' AND (
    public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'reports.generate')
  ));

CREATE POLICY "order_reports_bucket_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'order-reports' AND (
    public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'reports.generate')
  ));

CREATE POLICY "order_reports_bucket_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'order-reports' AND (
    public.has_role(auth.uid(), 'master') OR public.has_permission(auth.uid(), 'reports.delete')
  ));
