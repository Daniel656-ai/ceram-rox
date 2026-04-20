-- work_logs: assigned users can log time (regardless of global role)
DROP POLICY IF EXISTS "Durchfuehrer create own logs" ON public.work_logs;
CREATE POLICY "Assigned users create own logs"
ON public.work_logs
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    has_role(auth.uid(), 'master'::app_role)
    OR has_role(auth.uid(), 'durchfuehrer'::app_role)
    OR is_assigned_to_measurement(auth.uid(), order_measurement_id)
  )
);

-- documents: assigned users can upload protocols
DROP POLICY IF EXISTS "Relevant users upload docs" ON public.documents;
CREATE POLICY "Relevant users upload docs"
ON public.documents
FOR INSERT
WITH CHECK (
  auth.uid() = uploaded_by
  AND (
    has_role(auth.uid(), 'master'::app_role)
    OR has_role(auth.uid(), 'durchfuehrer'::app_role)
    OR is_assigned_to_measurement(auth.uid(), order_measurement_id)
    OR is_order_creator_via_measurement(auth.uid(), order_measurement_id)
  )
);

-- measurement_results: assigned users (any role) can manage results
DROP POLICY IF EXISTS "Durchfuehrer and masters manage results" ON public.measurement_results;
CREATE POLICY "Assigned users manage results"
ON public.measurement_results
FOR ALL
USING (
  has_role(auth.uid(), 'master'::app_role)
  OR is_assigned_to_measurement(auth.uid(), order_measurement_id)
)
WITH CHECK (
  has_role(auth.uid(), 'master'::app_role)
  OR is_assigned_to_measurement(auth.uid(), order_measurement_id)
);

-- Storage bucket policies for measurement-documents (assigned users can upload)
DROP POLICY IF EXISTS "Assigned users upload measurement docs" ON storage.objects;
CREATE POLICY "Assigned users upload measurement docs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'measurement-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users read own measurement docs" ON storage.objects;
CREATE POLICY "Users read own measurement docs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'measurement-documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'master'::app_role)
  )
);