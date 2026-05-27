import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export interface UserWorkSchedule {
  id: string;
  user_id: string;
  weekly_hours: number;
  works_monday: boolean;
  works_tuesday: boolean;
  works_wednesday: boolean;
  works_thursday: boolean;
  works_friday: boolean;
  works_saturday: boolean;
  works_sunday: boolean;
  valid_from: string;
  notes: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
}

export const workSchedules = {
  list(userId?: string): Promise<UserWorkSchedule[]> {
    let q = dbClient.from("user_work_schedules").select("*").order("valid_from", { ascending: false });
    if (userId) q = q.eq("user_id", userId);
    return unwrap(q) as Promise<UserWorkSchedule[]>;
  },
  listEffective(onDate: string): Promise<UserWorkSchedule[]> {
    return unwrap(
      dbClient
        .from("user_work_schedules")
        .select("*")
        .lte("valid_from", onDate)
        .order("valid_from", { ascending: false })
    ) as Promise<UserWorkSchedule[]>;
  },
  upsert: (payload: Partial<UserWorkSchedule> & { user_id: string; valid_from: string; created_by: string }) =>
    run(dbClient.from("user_work_schedules").upsert(payload as any, { onConflict: "user_id,valid_from" })),
  delete: (id: string) => run(dbClient.from("user_work_schedules").delete().eq("id", id)),
};
