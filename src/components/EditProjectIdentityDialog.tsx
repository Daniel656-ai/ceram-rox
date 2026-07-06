import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useUsers } from "@/hooks/useUsers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  initialNumber: string;
  initialName: string | null;
}

export function EditProjectIdentityDialog({
  open,
  onOpenChange,
  projectId,
  initialNumber,
  initialName,
}: Props) {
  const { t } = useTranslation("projects");
  const qc = useQueryClient();
  const { data: users = [] } = useUsers();
  const [projectNumber, setProjectNumber] = useState(initialNumber);
  const [projectName, setProjectName] = useState(initialName ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setProjectNumber(initialNumber);
      setProjectName(initialName ?? "");
    }
  }, [open, initialNumber, initialName]);

  const { data: history = [] } = useQuery({
    queryKey: ["project-change-log", projectId],
    queryFn: () => api.projects.listChangeLog(projectId),
    enabled: open,
  });

  const userName = (uid: string | null) => {
    if (!uid) return "–";
    const u = (users as any[]).find((x: any) => x.user_id === uid);
    return u ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || uid : uid;
  };

  const handleSave = async () => {
    const trimmedNumber = projectNumber.trim();
    if (!trimmedNumber) {
      toast.error(t("number_required"));
      return;
    }
    const updates: { project_number?: string; project_name?: string | null } = {};
    if (trimmedNumber !== initialNumber) updates.project_number = trimmedNumber;
    const newName = projectName.trim() || null;
    if (newName !== (initialName ?? null)) updates.project_name = newName;
    if (Object.keys(updates).length === 0) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      await api.projects.updateIdentity(projectId, updates);
      toast.success(t("identity_updated", { defaultValue: "Projekt aktualisiert" }));
      qc.invalidateQueries({ queryKey: ["project-detail", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["projects-with-stats"] });
      qc.invalidateQueries({ queryKey: ["project-change-log", projectId] });
      onOpenChange(false);
    } catch (err: any) {
      if (err?.message === "DUPLICATE_PROJECT_NUMBER") {
        toast.error(
          t("duplicate_project_number", {
            defaultValue: "Projektnummer bereits vergeben",
          })
        );
      } else {
        toast.error(err?.message ?? "Error");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("edit_identity_title", { defaultValue: "Projekt bearbeiten" })}
          </DialogTitle>
          <DialogDescription>
            {t("edit_identity_desc", {
              defaultValue:
                "Projektnummer und Projektname können jederzeit geändert werden. Alle Verknüpfungen bleiben erhalten.",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pnum">{t("project_number_required")}</Label>
            <Input
              id="pnum"
              value={projectNumber}
              onChange={(e) => setProjectNumber(e.target.value)}
              placeholder={t("project_number_placeholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pname">{t("project_name")}</Label>
            <Input
              id="pname"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-sm">
              {t("change_history", { defaultValue: "Änderungshistorie" })}
            </Label>
            <ScrollArea className="mt-2 h-40 rounded-md border">
              {(history as any[]).length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">
                  {t("no_history", { defaultValue: "Keine Historie vorhanden" })}
                </div>
              ) : (
                <ul className="divide-y text-sm">
                  {(history as any[]).map((h: any) => (
                    <li key={h.id} className="p-2">
                      <div className="font-medium">
                        {h.field_name === "project_number"
                          ? t("project_number")
                          : t("project_name")}
                      </div>
                      <div className="text-muted-foreground">
                        <span className="line-through">{h.old_value ?? "–"}</span>
                        {" → "}
                        <span>{h.new_value ?? "–"}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {userName(h.changed_by)} ·{" "}
                        {new Date(h.created_at).toLocaleString()}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel", { defaultValue: "Abbrechen" })}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {t("save", { defaultValue: "Speichern" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
