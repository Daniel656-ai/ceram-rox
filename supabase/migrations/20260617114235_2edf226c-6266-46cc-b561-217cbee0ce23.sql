-- ============================================================
-- Permission-Audit Härtung: kritische RLS-Lücken schließen
-- ============================================================

-- 1) activity_log: INSERT war für jeden eingeloggten User offen → Forge-Risiko
--    Triggers laufen als SECURITY DEFINER und umgehen RLS, brauchen also keine Policy.
DROP POLICY IF EXISTS "System inserts activity" ON public.activity_log;
CREATE POLICY "Only triggers insert activity"
  ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (false);

-- 2) notifications: INSERT war offen → Spoofing-Risiko an beliebige user_id
DROP POLICY IF EXISTS "System inserts notifications" ON public.notifications;
CREATE POLICY "Only triggers insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (false);

-- 3) hazard_notification_log: INSERT war komplett offen (WITH CHECK true)
DROP POLICY IF EXISTS "System inserts hazard log" ON public.hazard_notification_log;
CREATE POLICY "Only triggers insert hazard log"
  ON public.hazard_notification_log FOR INSERT TO authenticated
  WITH CHECK (false);

-- 4) company_settings: SELECT war an PUBLIC (= inkl. anon) ausgeliefert
DROP POLICY IF EXISTS "company_settings_read_all" ON public.company_settings;
CREATE POLICY "company_settings_read_authenticated"
  ON public.company_settings FOR SELECT TO authenticated
  USING (true);

-- 5) sample_documents: DELETE erlaubte jedem User fremde Dokumente zu löschen
DROP POLICY IF EXISTS "Authenticated delete sample docs" ON public.sample_documents;
CREATE POLICY "Owner or master delete sample docs"
  ON public.sample_documents FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'master'::app_role));

-- 6) activity_log SELECT: Policy auf PUBLIC eingeschränkt auf authenticated
DROP POLICY IF EXISTS "Users see relevant activity" ON public.activity_log;
CREATE POLICY "Users see relevant activity"
  ON public.activity_log FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'master'::app_role)
    OR has_permission(auth.uid(), 'activity_log.view_all')
    OR (order_id IS NOT NULL AND is_order_creator(auth.uid(), order_id))
    OR (order_id IS NOT NULL AND is_assigned_to_order(auth.uid(), order_id))
    OR (project_id IS NOT NULL AND is_project_member(auth.uid(), project_id))
    OR actor_user_id = auth.uid()
  );

-- 7) Neue Permission-Keys formal in role_permissions zulassen (durch Seed-Zuweisung an Administrator-Rolle).
--    Keys werden im Frontend in der Registry ergänzt; hier sicherstellen, dass der system-Admin sie hat.
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, key
FROM (VALUES
  ('notifications.measurement_completed'),
  ('notifications.priority_violation'),
  ('activity_log.view_all'),
  ('hazard_notifications.manage'),
  ('admin.database'),
  ('consumables.manage')
) AS t(key)
ON CONFLICT DO NOTHING;