import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export interface UserAbsence {
  id: string;
  user_id: string;
  absence_type: "urlaub" | "krankheit" | "weiterbildung" | "sonstiges";
  start_at: string;
  end_at: string;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export const absences = {
  list(userId?: string): Promise<UserAbsence[]> {
    let q = dbClient.from("user_absences").select("*").order("start_at");
    if (userId) q = q.eq("user_id", userId);
    return unwrap(q) as Promise<UserAbsence[]>;
  },
  create: (a: Omit<UserAbsence, "id" | "created_at" | "updated_at" | "comment"> & { comment?: string }) =>
    unwrap(dbClient.from("user_absences").insert(a as any).select().single()),
  update: ({ id, ...updates }: Partial<UserAbsence> & { id: string }) =>
    unwrap(dbClient.from("user_absences").update(updates as any).eq("id", id).select().single()),
  delete: (id: string) => run(dbClient.from("user_absences").delete().eq("id", id)),
  checkConflict: (userId: string, start: string, end: string) =>
    unwrap(dbClient.rpc("check_user_absence_conflict", { _user_id: userId, _start: start, _end: end })),
};
