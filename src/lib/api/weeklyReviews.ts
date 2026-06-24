import { dbClient } from "./client";
import { unwrap } from "./_helpers";

export interface WeeklyReviewInput {
  project_id: string;
  author_user_id: string;
  author_role_snapshot: string;
  iso_year: number;
  iso_week: number;
  review_date: string;
  completed_this_week: string;
  currently_working_on: string;
  next_steps: string;
  help_needed: string;
  risks: string;
  other_comments: string;
  overall_rating: 1 | 2 | 3;
}

export const weeklyReviews = {
  list: (projectId: string) =>
    unwrap(
      dbClient
        .from("project_weekly_reviews")
        .select("*")
        .eq("project_id", projectId)
        .order("review_date", { ascending: false })
        .order("created_at", { ascending: false })
    ),

  /** All reviews across projects (used for dashboard/compliance overview). */
  listAll: () =>
    unwrap(
      dbClient
        .from("project_weekly_reviews")
        .select("*")
        .order("review_date", { ascending: false })
    ),

  /** All reviews of a single user (newest first). */
  listForUser: (userId: string) =>
    unwrap(
      dbClient
        .from("project_weekly_reviews")
        .select("*")
        .eq("author_user_id", userId)
        .order("review_date", { ascending: false })
    ),

  create: (review: WeeklyReviewInput) =>
    unwrap(
      dbClient
        .from("project_weekly_reviews")
        .insert(review as any)
        .select()
        .single()
    ),
};
