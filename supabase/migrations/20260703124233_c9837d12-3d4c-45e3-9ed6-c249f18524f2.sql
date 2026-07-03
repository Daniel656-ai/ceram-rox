-- Idempotent CREATE for project_expense_categories & project_expenses (for local backend setup)

CREATE TABLE IF NOT EXISTS public.project_expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name_de text NOT NULL,
  name_en text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_expense_categories TO authenticated;
GRANT ALL ON public.project_expense_categories TO service_role;

ALTER TABLE public.project_expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All authenticated read expense categories" ON public.project_expense_categories;
CREATE POLICY "All authenticated read expense categories"
  ON public.project_expense_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Masters manage expense categories" ON public.project_expense_categories;
CREATE POLICY "Masters manage expense categories"
  ON public.project_expense_categories FOR ALL
  USING (has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role));

DROP TRIGGER IF EXISTS update_project_expense_categories_updated_at ON public.project_expense_categories;
CREATE TRIGGER update_project_expense_categories_updated_at
  BEFORE UPDATE ON public.project_expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.project_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  work_package_id uuid REFERENCES public.project_work_packages(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.project_expense_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  quantity numeric,
  unit text,
  unit_price numeric,
  total_price numeric,
  supplier text,
  cost_center text,
  project_leader_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_expenses_project_id ON public.project_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_project_expenses_work_package_id ON public.project_expenses(work_package_id);
CREATE INDEX IF NOT EXISTS idx_project_expenses_category_id ON public.project_expenses(category_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_expenses TO authenticated;
GRANT ALL ON public.project_expenses TO service_role;

ALTER TABLE public.project_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All authenticated read project_expenses" ON public.project_expenses;
CREATE POLICY "All authenticated read project_expenses"
  ON public.project_expenses FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Masters and auftraggeber manage project_expenses" ON public.project_expenses;
CREATE POLICY "Masters and auftraggeber manage project_expenses"
  ON public.project_expenses FOR ALL
  USING (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'auftraggeber'::app_role))
  WITH CHECK (has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'auftraggeber'::app_role));

DROP TRIGGER IF EXISTS update_project_expenses_updated_at ON public.project_expenses;
CREATE TRIGGER update_project_expenses_updated_at
  BEFORE UPDATE ON public.project_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
