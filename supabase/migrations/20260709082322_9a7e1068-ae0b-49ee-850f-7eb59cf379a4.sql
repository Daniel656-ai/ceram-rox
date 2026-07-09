
DROP POLICY IF EXISTS "portfolio_docs_read" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_docs_write" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_docs_delete" ON storage.objects;

CREATE POLICY "portfolio_docs_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'portfolio-documents'
         AND (has_role(auth.uid(),'master'::app_role)
              OR has_permission(auth.uid(),'portfolios.view')));

CREATE POLICY "portfolio_docs_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'portfolio-documents'
              AND (has_role(auth.uid(),'master'::app_role)
                   OR has_permission(auth.uid(),'portfolios.edit')));

CREATE POLICY "portfolio_docs_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'portfolio-documents'
         AND (has_role(auth.uid(),'master'::app_role)
              OR has_permission(auth.uid(),'portfolios.edit')));
