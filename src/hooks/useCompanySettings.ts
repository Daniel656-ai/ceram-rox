import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const COMPANY_SETTINGS_KEY = ["company_settings"];

export function useCompanySettings() {
  return useQuery({
    queryKey: COMPANY_SETTINGS_KEY,
    queryFn: () => api.companySettings.get(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompanyLogo() {
  const { data } = useCompanySettings();
  return data?.logo_data_url ?? null;
}

export function useUpdateCompanySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      patch,
      userId,
    }: {
      patch: { company_name?: string | null; logo_data_url?: string | null; logo_mime?: string | null };
      userId: string;
    }) => api.companySettings.update(patch, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: COMPANY_SETTINGS_KEY }),
  });
}
