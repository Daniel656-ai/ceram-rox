import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { WeeklyReviewInput } from "@/lib/api/weeklyReviews";

export function useWeeklyReviews(projectId?: string) {
  return useQuery({
    queryKey: ["weekly-reviews", projectId],
    queryFn: () => api.weeklyReviews.list(projectId!),
    enabled: !!projectId,
  });
}

export function useAllWeeklyReviews() {
  return useQuery({
    queryKey: ["weekly-reviews-all"],
    queryFn: () => api.weeklyReviews.listAll(),
  });
}

export function useCreateWeeklyReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (review: WeeklyReviewInput) => api.weeklyReviews.create(review),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["weekly-reviews", vars.project_id] });
      qc.invalidateQueries({ queryKey: ["weekly-reviews-all"] });
    },
  });
}
