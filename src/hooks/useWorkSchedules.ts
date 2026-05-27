import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { parseISO } from "date-fns";
import { isWorkingDay, getHolidaySet, VACATION_WEEKS_PER_YEAR } from "@/lib/austrian-holidays";

export type { UserWorkSchedule } from "@/lib/api/workSchedules";
import type { UserWorkSchedule } from "@/lib/api/workSchedules";

export const DEFAULT_SCHEDULE = {
  weekly_hours: 38.5,
  works_monday: true,
  works_tuesday: true,
  works_wednesday: true,
  works_thursday: true,
  works_friday: true,
  works_saturday: false,
  works_sunday: false,
};

export function workingDaysPerWeek(s: Pick<UserWorkSchedule,
  "works_monday" | "works_tuesday" | "works_wednesday" | "works_thursday" | "works_friday" | "works_saturday" | "works_sunday"
>): number {
  return [s.works_monday, s.works_tuesday, s.works_wednesday, s.works_thursday, s.works_friday, s.works_saturday, s.works_sunday].filter(Boolean).length;
}

export function isScheduledWeekday(s: UserWorkSchedule | null | undefined, day: number): boolean {
  if (!s) return day >= 1 && day <= 5;
  switch (day) {
    case 0: return s.works_sunday;
    case 1: return s.works_monday;
    case 2: return s.works_tuesday;
    case 3: return s.works_wednesday;
    case 4: return s.works_thursday;
    case 5: return s.works_friday;
    case 6: return s.works_saturday;
    default: return false;
  }
}

export function vacationDaysForSchedule(s: UserWorkSchedule | null | undefined): number {
  const days = s ? workingDaysPerWeek(s) : 5;
  return Math.round(days * VACATION_WEEKS_PER_YEAR * 2) / 2;
}

export function countVacationDaysUsed(
  absences: Array<{ start_at: string; end_at: string; absence_type: string }>,
  schedule: UserWorkSchedule | null | undefined,
  year: number,
): number {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);
  const holidaySet = getHolidaySet(year, [year - 1, year + 1]);
  let used = 0;
  for (const a of absences) {
    if (a.absence_type !== "urlaub") continue;
    const start = parseISO(a.start_at);
    const end = parseISO(a.end_at);
    if (end < yearStart || start > yearEnd) continue;
    const cur = new Date(Math.max(start.getTime(), yearStart.getTime()));
    cur.setHours(0, 0, 0, 0);
    const last = new Date(Math.min(end.getTime(), yearEnd.getTime()));
    while (cur <= last) {
      const dow = cur.getDay();
      if (isWorkingDay(cur, holidaySet) && isScheduledWeekday(schedule, dow)) used++;
      cur.setDate(cur.getDate() + 1);
    }
  }
  return used;
}

export function useUserWorkSchedules(userId?: string) {
  return useQuery({
    queryKey: ["user_work_schedules", userId ?? "all"],
    queryFn: () => api.workSchedules.list(userId),
  });
}

export function useEffectiveSchedules(onDate: Date = new Date()) {
  const dateStr = onDate.toISOString().slice(0, 10);
  return useQuery({
    queryKey: ["effective_schedules", dateStr],
    queryFn: async () => {
      const rows = await api.workSchedules.listEffective(dateStr);
      const map = new Map<string, UserWorkSchedule>();
      for (const r of rows) if (!map.has(r.user_id)) map.set(r.user_id, r);
      return map;
    },
  });
}

export function useUpsertWorkSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<UserWorkSchedule> & { user_id: string }) => {
      const { data: { user } } = await api.auth.getUser();
      await api.workSchedules.upsert({
        user_id: input.user_id,
        weekly_hours: input.weekly_hours ?? 38.5,
        works_monday: input.works_monday ?? true,
        works_tuesday: input.works_tuesday ?? true,
        works_wednesday: input.works_wednesday ?? true,
        works_thursday: input.works_thursday ?? true,
        works_friday: input.works_friday ?? true,
        works_saturday: input.works_saturday ?? false,
        works_sunday: input.works_sunday ?? false,
        valid_from: input.valid_from ?? new Date().toISOString().slice(0, 10),
        notes: input.notes ?? null,
        created_by: user!.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_work_schedules"] });
      qc.invalidateQueries({ queryKey: ["effective_schedules"] });
    },
  });
}

export function useDeleteWorkSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.workSchedules.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_work_schedules"] });
      qc.invalidateQueries({ queryKey: ["effective_schedules"] });
    },
  });
}
