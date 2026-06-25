import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CustomSymbol,
  SymbolCategory,
  CreateCustomSymbolInput,
  UpdateCustomSymbolInput,
} from "@/lib/api/customSymbols";

export const CUSTOM_SYMBOLS_KEY = ["custom_symbols"];

export function useCustomSymbols(category?: SymbolCategory) {
  return useQuery({
    queryKey: [...CUSTOM_SYMBOLS_KEY, category ?? "all"],
    queryFn: () => api.customSymbols.list(category),
    staleTime: 5 * 60 * 1000,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: CUSTOM_SYMBOLS_KEY });
}

export function useCreateCustomSymbol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, userId }: { input: CreateCustomSymbolInput; userId: string }) =>
      api.customSymbols.create(input, userId),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateCustomSymbol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
      userId,
    }: {
      id: string;
      patch: UpdateCustomSymbolInput;
      userId: string;
    }) => api.customSymbols.update(id, patch, userId),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteCustomSymbol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.customSymbols.remove(id),
    onSuccess: () => invalidate(qc),
  });
}

export type { CustomSymbol, SymbolCategory };
