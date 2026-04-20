import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  useUserWorkSchedules,
  useUpsertWorkSchedule,
  useDeleteWorkSchedule,
  workingDaysPerWeek,
  vacationDaysForSchedule,
  DEFAULT_SCHEDULE,
} from "@/hooks/useWorkSchedules";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  userName: string;
}

const WEEKDAYS: Array<{ key: keyof typeof DEFAULT_SCHEDULE; labelKey: string }> = [
  { key: "works_monday", labelKey: "monday" },
  { key: "works_tuesday", labelKey: "tuesday" },
  { key: "works_wednesday", labelKey: "wednesday" },
  { key: "works_thursday", labelKey: "thursday" },
  { key: "works_friday", labelKey: "friday" },
  { key: "works_saturday", labelKey: "saturday" },
  { key: "works_sunday", labelKey: "sunday" },
];

export function UserWorkScheduleDialog({ open, onOpenChange, userId, userName }: Props) {
  const { t } = useTranslation(["admin", "common"]);
  const { data: schedules = [] } = useUserWorkSchedules(userId);
  const upsert = useUpsertWorkSchedule();
  const del = useDeleteWorkSchedule();

  const current = schedules[0];

  const [form, setForm] = useState({
    weekly_hours: 38.5,
    valid_from: new Date().toISOString().slice(0, 10),
    notes: "",
    works_monday: true,
    works_tuesday: true,
    works_wednesday: true,
    works_thursday: true,
    works_friday: true,
    works_saturday: false,
    works_sunday: false,
  });

  useEffect(() => {
    if (open && current) {
      setForm({
        weekly_hours: Number(current.weekly_hours),
        valid_from: new Date().toISOString().slice(0, 10),
        notes: current.notes ?? "",
        works_monday: current.works_monday,
        works_tuesday: current.works_tuesday,
        works_wednesday: current.works_wednesday,
        works_thursday: current.works_thursday,
        works_friday: current.works_friday,
        works_saturday: current.works_saturday,
        works_sunday: current.works_sunday,
      });
    } else if (open) {
      setForm({
        weekly_hours: 38.5,
        valid_from: new Date().toISOString().slice(0, 10),
        notes: "",
        ...DEFAULT_SCHEDULE,
      });
    }
  }, [open, current?.id]);

  const dayCount = workingDaysPerWeek(form as any);
  const vacationDays = vacationDaysForSchedule({ ...form, id: "x", user_id: userId, created_at: "", created_by: "", updated_at: "" } as any);

  const handleSave = async () => {
    if (dayCount === 0) {
      toast.error(t("admin:schedule_select_day"));
      return;
    }
    try {
      await upsert.mutateAsync({ user_id: userId, ...form });
      toast.success(t("admin:schedule_saved"));
      onOpenChange(false);
    } catch (e: any) {
      toast.error(t("common:error"), { description: e.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("admin:schedule_title", { name: userName })}</DialogTitle>
          <DialogDescription>{t("admin:schedule_description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">{t("admin:schedule_weekdays")}</Label>
            <div className="grid grid-cols-7 gap-2">
              {WEEKDAYS.map(({ key, labelKey }) => (
                <label key={key} className="flex flex-col items-center gap-1 border rounded-md p-2 cursor-pointer hover:bg-muted/40">
                  <span className="text-xs font-medium">{t(`common:weekday_short_${labelKey}`)}</span>
                  <Checkbox
                    checked={(form as any)[key]}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, [key]: !!v }))}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("admin:schedule_weekly_hours")}</Label>
              <Input
                type="number"
                step="0.25"
                min="0"
                max="60"
                value={form.weekly_hours}
                onChange={(e) => setForm((p) => ({ ...p, weekly_hours: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label>{t("admin:schedule_valid_from")}</Label>
              <Input
                type="date"
                value={form.valid_from}
                onChange={(e) => setForm((p) => ({ ...p, valid_from: e.target.value }))}
              />
            </div>
          </div>

          <Card>
            <CardContent className="pt-4 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-muted-foreground">{t("admin:schedule_workdays_per_week")}</div>
                <div className="text-2xl font-bold">{dayCount}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("admin:schedule_weekly_hours_sum")}</div>
                <div className="text-2xl font-bold">{form.weekly_hours.toFixed(2)} h</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("admin:schedule_vacation_entitlement")}</div>
                <div className="text-2xl font-bold text-primary">{vacationDays}</div>
              </div>
            </CardContent>
          </Card>

          {schedules.length > 0 && (
            <div>
              <Label className="mb-2 block">{t("admin:schedule_history")}</Label>
              <div className="space-y-1 max-h-32 overflow-auto border rounded p-2">
                {schedules.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span>
                      {new Date(s.valid_from).toLocaleDateString()} — {workingDaysPerWeek(s)} {t("admin:schedule_days")} / {Number(s.weekly_hours).toFixed(2)} h
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-destructive hover:text-destructive"
                      onClick={async () => {
                        await del.mutateAsync(s.id);
                        toast.success(t("common:deleted"));
                      }}
                    >
                      {t("common:delete")}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common:cancel")}</Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? t("common:saving") : t("common:save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
