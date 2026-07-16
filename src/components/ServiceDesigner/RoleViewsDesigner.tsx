import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FormDefinition } from "@/lib/api/formDefinitions";
import type { FieldVisibility } from "@/lib/api/formFieldPermissions";
import { ROLE_VIEW_PRESETS, DEFAULT_ROLE_KEY } from "@/lib/api/formRoleViews";
import { normalizeLayout, emptyLayout } from "@/lib/api/formDefinitionLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Save, Users } from "lucide-react";
import FormLayoutDesigner from "./FormLayoutDesigner";

interface Props {
  form: FormDefinition;
  canManage: boolean;
}

export default function RoleViewsDesigner({ form, canManage }: Props) {
  const qc = useQueryClient();

  const { data: roleViews = [] } = useQuery({
    queryKey: ["form-role-views", form.id],
    queryFn: () => api.formRoleViews.list(form.id),
  });
  const { data: fields = [] } = useQuery({
    queryKey: ["form-fields", form.id],
    queryFn: () => api.formFields.listForForm(form.id),
  });

  const [selectedRoleKey, setSelectedRoleKey] = useState<string | null>(null);
  const [newRoleKey, setNewRoleKey] = useState("");
  const [newRoleLabel, setNewRoleLabel] = useState("");

  const activeView = useMemo(
    () => roleViews.find((v) => v.role_key === selectedRoleKey) ?? null,
    [roleViews, selectedRoleKey]
  );

  const createView = useMutation({
    mutationFn: async (v: { role_key: string; label: string }) =>
      api.formRoleViews.upsert(form.id, v.role_key, v.label, emptyLayout()),
    onSuccess: (_, v) => {
      toast.success(`Rollenansicht „${v.label}" angelegt`);
      qc.invalidateQueries({ queryKey: ["form-role-views", form.id] });
      setSelectedRoleKey(v.role_key);
      setNewRoleKey("");
      setNewRoleLabel("");
    },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  const removeView = useMutation({
    mutationFn: (id: string) => api.formRoleViews.remove(id),
    onSuccess: () => {
      toast.success("Rollenansicht gelöscht");
      qc.invalidateQueries({ queryKey: ["form-role-views", form.id] });
      setSelectedRoleKey(null);
    },
  });

  const addPreset = (key: string, label: string) => {
    if (roleViews.some((v) => v.role_key === key)) {
      setSelectedRoleKey(key);
      return;
    }
    createView.mutate({ role_key: key, label });
  };

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Left: role list */}
      <Card className="col-span-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wide flex items-center gap-1">
            <Users className="h-3 w-3" /> Rollenansichten
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            {roleViews.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">
                Noch keine Rollenansichten definiert. Ohne Rollenansicht sehen alle
                Beteiligten das Standard-Layout des Formulars.
              </p>
            )}
            {roleViews.map((v) => (
              <div
                key={v.id}
                className={`flex items-center gap-1 rounded px-2 py-1.5 cursor-pointer ${
                  selectedRoleKey === v.role_key ? "bg-primary/10" : "hover:bg-muted"
                }`}
                onClick={() => setSelectedRoleKey(v.role_key)}
              >
                <span className="flex-1 text-sm truncate">{v.label}</span>
                <Badge variant="outline" className="text-xs">{v.role_key}</Badge>
                {canManage && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Rollenansicht „${v.label}" wirklich löschen?`)) removeView.mutate(v.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {canManage && (
            <>
              <div className="pt-2 border-t space-y-2">
                <p className="text-xs text-muted-foreground">Preset hinzufügen:</p>
                <div className="flex flex-wrap gap-1">
                  {ROLE_VIEW_PRESETS.map((p) => (
                    <Button
                      key={p.key}
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => addPreset(p.key, p.label)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="pt-2 border-t space-y-2">
                <p className="text-xs text-muted-foreground">Eigene Rolle:</p>
                <Input placeholder="Schlüssel (z.B. qs)" value={newRoleKey} onChange={(e) => setNewRoleKey(e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Anzeigename" value={newRoleLabel} onChange={(e) => setNewRoleLabel(e.target.value)} className="h-8 text-sm" />
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!newRoleKey || !newRoleLabel || createView.isPending}
                  onClick={() => createView.mutate({ role_key: newRoleKey.trim(), label: newRoleLabel.trim() })}
                >
                  <Plus className="h-3 w-3 mr-1" /> Hinzufügen
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Right: designer */}
      <div className="col-span-9">
        {!activeView ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground text-center">
              Bitte links eine Rollenansicht auswählen oder eine neue anlegen.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                {activeView.label}
                <Badge variant="outline">{activeView.role_key}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="layout">
                <TabsList>
                  <TabsTrigger value="layout">Layout</TabsTrigger>
                  <TabsTrigger value="permissions">Feldberechtigungen</TabsTrigger>
                </TabsList>
                <TabsContent value="layout" className="mt-3">
                  <FormLayoutDesigner
                    form={form}
                    canManage={canManage}
                    initialLayout={normalizeLayout(activeView.layout)}
                    headerTitle={`Layout — ${activeView.label}`}
                    saveLabel="Rollen-Layout gespeichert"
                    onSaveLayout={(layout) =>
                      api.formRoleViews.upsert(form.id, activeView.role_key, activeView.label, layout)
                    }
                  />
                </TabsContent>
                <TabsContent value="permissions" className="mt-3">
                  <PermissionsMatrix
                    formId={form.id}
                    roleKey={activeView.role_key}
                    fields={fields}
                    canManage={canManage}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function PermissionsMatrix({
  formId,
  roleKey,
  fields,
  canManage,
}: {
  formId: string;
  roleKey: string;
  fields: any[];
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["form-field-permissions", formId, roleKey],
    queryFn: () => api.formFieldPermissions.listForRole(formId, roleKey),
  });

  const [local, setLocal] = useState<Record<string, { visibility: FieldVisibility; required: boolean }>>({});
  const initialised = useMemo(() => {
    const base: Record<string, { visibility: FieldVisibility; required: boolean }> = {};
    for (const f of fields) base[f.id] = { visibility: "write", required: false };
    for (const r of rows) base[r.field_id] = { visibility: r.visibility, required: r.required };
    return base;
  }, [rows, fields]);

  const state = { ...initialised, ...local };
  const dirty = Object.keys(local).length > 0;

  const update = (fieldId: string, patch: Partial<{ visibility: FieldVisibility; required: boolean }>) =>
    setLocal((prev) => ({ ...prev, [fieldId]: { ...state[fieldId], ...patch } }));

  const save = useMutation({
    mutationFn: async () => {
      const payload = Object.entries(state)
        .filter(([, v]) => v.visibility !== "write" || v.required)
        .map(([field_id, v]) => ({ field_id, visibility: v.visibility, required: v.required }));
      await api.formFieldPermissions.replaceForRole(formId, roleKey, payload);
    },
    onSuccess: () => {
      toast.success("Berechtigungen gespeichert");
      setLocal({});
      qc.invalidateQueries({ queryKey: ["form-field-permissions", formId, roleKey] });
    },
    onError: (e: any) => toast.error(e.message || "Fehler"),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Sichtbarkeit und Pflichtfeldstatus je Feld für die Rolle. „Bearbeiten" ist der Standard.
        </p>
        <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || !canManage || save.isPending}>
          <Save className="h-3 w-3 mr-1" /> Speichern
        </Button>
      </div>
      <div className="border rounded-md">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium bg-muted border-b">
          <div className="col-span-6">Feld</div>
          <div className="col-span-4">Sichtbarkeit</div>
          <div className="col-span-2">Pflichtfeld</div>
        </div>
        {fields.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground text-center">Keine Felder definiert.</div>
        )}
        {fields.map((f) => {
          const s = state[f.id] ?? { visibility: "write" as FieldVisibility, required: false };
          return (
            <div key={f.id} className="grid grid-cols-12 gap-2 px-3 py-2 border-b last:border-0 items-center">
              <div className="col-span-6">
                <div className="text-sm">{f.display_name}</div>
                <div className="text-xs text-muted-foreground">
                  {f.field_key} · {f.field_type}
                </div>
              </div>
              <div className="col-span-4">
                <Select
                  value={s.visibility}
                  onValueChange={(v) => update(f.id, { visibility: v as FieldVisibility })}
                  disabled={!canManage}
                >
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="write">Bearbeiten</SelectItem>
                    <SelectItem value="read">Nur lesen</SelectItem>
                    <SelectItem value="hidden">Ausgeblendet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Switch
                  checked={s.required}
                  disabled={!canManage || s.visibility === "hidden"}
                  onCheckedChange={(v) => update(f.id, { required: v })}
                />
                <Label className="text-xs">Pflicht</Label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
