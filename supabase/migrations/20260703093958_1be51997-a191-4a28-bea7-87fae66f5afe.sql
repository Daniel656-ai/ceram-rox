GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_expenses TO authenticated;
GRANT ALL ON public.project_expenses TO service_role;
GRANT SELECT ON public.project_expense_categories TO authenticated;
GRANT ALL ON public.project_expense_categories TO service_role;
NOTIFY pgrst, 'reload schema';