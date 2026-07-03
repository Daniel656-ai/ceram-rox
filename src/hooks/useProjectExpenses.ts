import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ProjectExpenseInput } from "@/lib/api/projectExpenses";

export function useProjectExpenseCategories() {
  return useQuery({
    queryKey: ["project_expense_categories"],
    queryFn: () => api.projectExpenseCategories.list(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProjectExpenses(projectId: string) {
  return useQuery({
    queryKey: ["project_expenses", projectId],
    queryFn: () => api.projectExpenses.list(projectId),
    enabled: !!projectId,
  });
}

export function useWorkPackageExpenses(workPackageId: string) {
  return useQuery({
    queryKey: ["project_expenses", "wp", workPackageId],
    queryFn: () => api.projectExpenses.listByWorkPackage(workPackageId),
    enabled: !!workPackageId,
  });
}

export function useCreateProjectExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectExpenseInput) => api.projectExpenses.create(input),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["project_expenses", v.project_id] });
      if (v.work_package_id) qc.invalidateQueries({ queryKey: ["project_expenses", "wp", v.work_package_id] });
    },
  });
}

export function useUpdateProjectExpense(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ProjectExpenseInput> }) =>
      api.projectExpenses.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project_expenses", projectId] }),
  });
}

export function useDeleteProjectExpense(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.projectExpenses.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project_expenses", projectId] }),
  });
}
