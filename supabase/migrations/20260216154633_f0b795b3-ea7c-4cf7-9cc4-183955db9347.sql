CREATE POLICY "Users delete relevant orders"
ON public.measurement_orders
FOR DELETE
USING (
  has_role(auth.uid(), 'master'::app_role)
  OR (created_by = auth.uid() AND status = 'open'::order_status)
);