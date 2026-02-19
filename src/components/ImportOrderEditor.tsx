import { type ImportedOrderRow, type RowFieldErrors } from "@/lib/excel-import";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, AlertCircle } from "lucide-react";

const ORDER_TYPE_OPTIONS = [
  { value: "Kundenauftrag", label: "Kundenauftrag" },
  { value: "Produktionsauftrag", label: "Produktionsauftrag" },
  { value: "F&E-Auftrag", label: "F&E-Auftrag" },
];

const PRIORITY_OPTIONS = [
  { value: "Normal", label: "Normal" },
  { value: "Wichtig", label: "Wichtig" },
  { value: "Höchste", label: "Höchste" },
];

interface Props {
  rows: ImportedOrderRow[];
  onRowsChange: (rows: ImportedOrderRow[]) => void;
  services: { id: string; service_name: string }[];
  fieldErrors: RowFieldErrors[];
}

function ErrorTooltip({ msg }: { msg: string }) {
  return (
    <div className="absolute left-0 top-full mt-1 z-20 hidden group-hover:block bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded shadow-lg max-w-[280px] pointer-events-none">
      {msg}
    </div>
  );
}

export default function ImportOrderEditor({ rows, onRowsChange, services, fieldErrors }: Props) {
  const update = (idx: number, field: keyof ImportedOrderRow, value: any) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r));
    onRowsChange(next);
  };

  const remove = (idx: number) => onRowsChange(rows.filter((_, i) => i !== idx));

  const add = () =>
    onRowsChange([
      ...rows,
      {
        project_number: "",
        sample_name: "",
        sample_description: "",
        order_type: "Kundenauftrag",
        priority: "Normal",
        service_name: "",
        planned_hours: 1,
      },
    ]);

  const cls = (idx: number, field: string, extra?: string) =>
    cn(
      "w-full px-2 py-1.5 text-sm border rounded-md bg-background",
      "focus:outline-none focus:ring-2 focus:ring-ring",
      fieldErrors[idx]?.[field]
        ? "border-destructive bg-destructive/5 focus:ring-destructive/30"
        : "border-input",
      extra
    );

  return (
    <div className="space-y-3 px-4">
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm" style={{ minWidth: 1300 }}>
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="p-2 font-medium w-12">#</th>
              <th className="p-2 font-medium" style={{ minWidth: 130 }}>Projektnr.*</th>
              <th className="p-2 font-medium" style={{ minWidth: 120 }}>Projektname</th>
              <th className="p-2 font-medium" style={{ minWidth: 120 }}>Probenname*</th>
              <th className="p-2 font-medium" style={{ minWidth: 140 }}>Beschreibung*</th>
              <th className="p-2 font-medium" style={{ minWidth: 150 }}>Typ*</th>
              <th className="p-2 font-medium" style={{ minWidth: 110 }}>Priorität</th>
              <th className="p-2 font-medium" style={{ minWidth: 120 }}>Fällig</th>
              <th className="p-2 font-medium" style={{ minWidth: 180 }}>Messdienst.*</th>
              <th className="p-2 font-medium w-20">Std.</th>
              <th className="p-2 font-medium" style={{ minWidth: 120 }}>Anmerkungen</th>
              <th className="p-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const errs = fieldErrors[idx] || {};
              const hasErr = Object.keys(errs).length > 0;
              return (
                <tr key={idx} className={cn("border-b", hasErr && "bg-destructive/5")}>
                  <td className="p-1 text-center text-muted-foreground text-xs">
                    {hasErr && <AlertCircle className="h-3 w-3 text-destructive inline mr-1" />}
                    {idx + 1}
                  </td>

                  {/* project_number */}
                  <td className="p-1">
                    <div className="group relative">
                      <input
                        value={row.project_number}
                        onChange={(e) => update(idx, "project_number", e.target.value)}
                        className={cls(idx, "project_number")}
                        placeholder="PRJ-..."
                      />
                      {errs.project_number && <ErrorTooltip msg={errs.project_number} />}
                    </div>
                  </td>

                  {/* project_name */}
                  <td className="p-1">
                    <input
                      value={row.project_name || ""}
                      onChange={(e) => update(idx, "project_name", e.target.value || undefined)}
                      className={cls(idx, "project_name")}
                    />
                  </td>

                  {/* sample_name */}
                  <td className="p-1">
                    <div className="group relative">
                      <input
                        value={row.sample_name}
                        onChange={(e) => update(idx, "sample_name", e.target.value)}
                        className={cls(idx, "sample_name")}
                      />
                      {errs.sample_name && <ErrorTooltip msg={errs.sample_name} />}
                    </div>
                  </td>

                  {/* sample_description */}
                  <td className="p-1">
                    <div className="group relative">
                      <input
                        value={row.sample_description}
                        onChange={(e) => update(idx, "sample_description", e.target.value)}
                        className={cls(idx, "sample_description")}
                      />
                      {errs.sample_description && <ErrorTooltip msg={errs.sample_description} />}
                    </div>
                  </td>

                  {/* order_type */}
                  <td className="p-1">
                    <div className="group relative">
                      <select
                        value={row.order_type}
                        onChange={(e) => update(idx, "order_type", e.target.value)}
                        className={cls(idx, "order_type")}
                      >
                        {ORDER_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                        {!ORDER_TYPE_OPTIONS.some((o) => o.value === row.order_type) && row.order_type && (
                          <option value={row.order_type} disabled>{row.order_type} ⚠</option>
                        )}
                      </select>
                      {errs.order_type && <ErrorTooltip msg={errs.order_type} />}
                    </div>
                  </td>

                  {/* priority */}
                  <td className="p-1">
                    <div className="group relative">
                      <select
                        value={row.priority}
                        onChange={(e) => update(idx, "priority", e.target.value)}
                        className={cls(idx, "priority")}
                      >
                        {PRIORITY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                        {!PRIORITY_OPTIONS.some((o) => o.value === row.priority) && row.priority && (
                          <option value={row.priority} disabled>{row.priority} ⚠</option>
                        )}
                      </select>
                      {errs.priority && <ErrorTooltip msg={errs.priority} />}
                    </div>
                  </td>

                  {/* due_date */}
                  <td className="p-1">
                    <input
                      type="date"
                      value={row.due_date || ""}
                      onChange={(e) => update(idx, "due_date", e.target.value || undefined)}
                      className={cls(idx, "due_date")}
                    />
                  </td>

                  {/* service_name */}
                  <td className="p-1">
                    <div className="group relative">
                      <select
                        value={row.service_name}
                        onChange={(e) => update(idx, "service_name", e.target.value)}
                        className={cls(idx, "service_name")}
                      >
                        <option value="">— Bitte wählen —</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.service_name}>{s.service_name}</option>
                        ))}
                        {row.service_name &&
                          !services.some(
                            (s) => s.service_name.toLowerCase() === row.service_name.toLowerCase()
                          ) && (
                            <option value={row.service_name} disabled>
                              {row.service_name} ⚠
                            </option>
                          )}
                      </select>
                      {errs.service_name && <ErrorTooltip msg={errs.service_name} />}
                    </div>
                  </td>

                  {/* planned_hours */}
                  <td className="p-1">
                    <div className="group relative">
                      <input
                        type="number"
                        min={0.25}
                        step={0.25}
                        value={row.planned_hours}
                        onChange={(e) => update(idx, "planned_hours", Number(e.target.value) || 0)}
                        className={cls(idx, "planned_hours")}
                      />
                      {errs.planned_hours && <ErrorTooltip msg={errs.planned_hours} />}
                    </div>
                  </td>

                  {/* notes */}
                  <td className="p-1">
                    <input
                      value={row.notes || ""}
                      onChange={(e) => update(idx, "notes", e.target.value || undefined)}
                      className={cls(idx, "notes")}
                    />
                  </td>

                  {/* delete */}
                  <td className="p-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="h-4 w-4 mr-1" /> Zeile hinzufügen
      </Button>
    </div>
  );
}
