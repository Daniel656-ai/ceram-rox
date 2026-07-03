import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import {
  useProjectExpenses,
  useProjectExpenseCategories,
  useCreateProjectExpense,
  useUpdateProjectExpense,
  useDeleteProjectExpense,
} from "@/hooks/useProjectExpenses";
import { useWorkPackages } from "@/hooks/useWorkPackages";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/formatCurrency";
import { PersonSelect } from "@/components/PersonSelect";

const NONE = "__none__";

interface Props {
  projectId: string;
  defaultLeaderId?: string | null;
}

type FormState = {
  id?: string;
  category_id: string;
  work_package_id: string;
  name: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  total_price: string;
  supplier: string;
  cost_center: string;
  project_leader_id: string;
  expense_date: string;
  notes: string;
  total_overridden: boolean;
};

const emptyForm = (leaderId?: string | null): FormState => ({
  category_id: NONE,
  work_package_id: NONE,
  name: "",
  description: "",
  quantity: "",
  unit: "",
  unit_price: "",
  total_price: "",
  supplier: "",
  cost_center: "",
  project_leader_id: leaderId || NONE,
  expense_date: new Date().toISOString().slice(0, 10),
  notes: "",
  total_overridden: false,
});

export function ProjectExpenses({ projectId, defaultLeaderId }: Props) {
  const { t, i18n } = useTranslation("materials");
  const lang = i18n.language.startsWith("de") ? "de" : "en";
  const { user } = useAuth();

  const { data: expenses = [] } = useProjectExpenses(projectId);
  const { data: categories = [] } = useProjectExpenseCategories();
  const { data: workPackages = [] } = useWorkPackages(projectId);
  const createExpense = useCreateProjectExpense();
  const updateExpense = useUpdateProjectExpense(projectId);
  const deleteExpense = useDeleteProjectExpense(projectId);

  const catName = (c: any) => (lang === "de" ? c?.name_de : c?.name_en) || "";

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(defaultLeaderId));
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [wpFilter, setWpFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<string>("expense_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Auto-calculate total
  useEffect(() => {
    if (form.total_overridden) return;
    const q = parseFloat(form.quantity);
    const p = parseFloat(form.unit_price);
    if (!isNaN(q) && !isNaN(p)) {
      setForm((f) => ({ ...f, total_price: (q * p).toFixed(2) }));
    }
  }, [form.quantity, form.unit_price, form.total_overridden]);

  const openNew = () => {
    setForm(emptyForm(defaultLeaderId));
    setOpen(true);
  };

  const openEdit = (e: any) => {
    setForm({
      id: e.id,
      category_id: e.category_id || NONE,
      work_package_id: e.work_package_id || NONE,
      name: e.name || "",
      description: e.description || "",
      quantity: e.quantity != null ? String(e.quantity) : "",
      unit: e.unit || "",
      unit_price: e.unit_price != null ? String(e.unit_price) : "",
      total_price: e.total_price != null ? String(e.total_price) : "",
      supplier: e.supplier || "",
      cost_center: e.cost_center || "",
      project_leader_id: e.project_leader_id || NONE,
      expense_date: e.expense_date || new Date().toISOString().slice(0, 10),
      notes: e.notes || "",
      total_overridden: true,
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error(t("name_required"));
      return;
    }
    const payload = {
      project_id: projectId,
      category_id: form.category_id === NONE ? null : form.category_id,
      work_package_id: form.work_package_id === NONE ? null : form.work_package_id,
      name: form.name.trim(),
      description: form.description || null,
      quantity: form.quantity ? Number(form.quantity) : null,
      unit: form.unit || null,
      unit_price: form.unit_price ? Number(form.unit_price) : null,
      total_price: form.total_price ? Number(form.total_price) : null,
      supplier: form.supplier || null,
      cost_center: form.cost_center || null,
      project_leader_id: form.project_leader_id === NONE ? null : form.project_leader_id,
      expense_date: form.expense_date || null,
      notes: form.notes || null,
    };
    try {
      if (form.id) {
        await updateExpense.mutateAsync({ id: form.id, patch: payload });
        toast.success(t("expense_updated"));
      } else {
        await createExpense.mutateAsync({ ...payload, created_by: user?.id } as any);
        toast.success(t("expense_created"));
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Error");
    }
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (expenses as any[]).filter((e) => {
      if (catFilter !== "all" && e.category_id !== catFilter) return false;
      if (wpFilter !== "all" && e.work_package_id !== wpFilter) return false;
      if (s) {
        const hay = [
          e.name,
          e.description,
          e.supplier,
          e.cost_center,
          e.notes,
          catName(e.project_expense_categories),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [expenses, search, catFilter, wpFilter, lang]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a: any, b: any) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "category":
          av = catName(a.project_expense_categories);
          bv = catName(b.project_expense_categories);
          break;
        case "name":
          av = a.name;
          bv = b.name;
          break;
        case "wp":
          av = a.project_work_packages?.title || "";
          bv = b.project_work_packages?.title || "";
          break;
        case "total_price":
          av = Number(a.total_price || 0);
          bv = Number(b.total_price || 0);
          break;
        default:
          av = a.expense_date || "";
          bv = b.expense_date || "";
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const total = useMemo(
    () => (expenses as any[]).reduce((s: number, e: any) => s + Number(e.total_price || 0), 0),
    [expenses]
  );

  const toggleSort = (k: string) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const SortHead = ({ k, children, className = "" }: any) => (
    <TableHead className={className}>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(k)}>
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-60" />
      </button>
    </TableHead>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{t("expenses_section")}</CardTitle>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" />
          {t("add_expense")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input placeholder={t("search_placeholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger><SelectValue placeholder={t("filter_category")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              {(categories as any[]).map((c) => (
                <SelectItem key={c.id} value={c.id}>{catName(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={wpFilter} onValueChange={setWpFilter}>
            <SelectTrigger><SelectValue placeholder={t("filter_wp")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              {(workPackages as any[]).map((w) => (
                <SelectItem key={w.id} value={w.id}>{w.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead k="category">{t("category")}</SortHead>
                <SortHead k="name">{t("expense_name")}</SortHead>
                <SortHead k="wp">{t("work_package")}</SortHead>
                <TableHead className="text-right">{t("quantity")}</TableHead>
                <TableHead className="text-right">{t("unit_price")}</TableHead>
                <SortHead k="total_price" className="text-right">{t("total_price")}</SortHead>
                <TableHead>{t("supplier")}</TableHead>
                <SortHead k="expense_date">{t("expense_date")}</SortHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">{t("no_expenses")}</TableCell>
                </TableRow>
              ) : (
                sorted.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell>{catName(e.project_expense_categories) || "–"}</TableCell>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-muted-foreground">{e.project_work_packages?.title || "–"}</TableCell>
                    <TableCell className="text-right">{e.quantity != null ? `${e.quantity} ${e.unit || ""}` : "–"}</TableCell>
                    <TableCell className="text-right">{e.unit_price != null ? formatCurrency(e.unit_price) : "–"}</TableCell>
                    <TableCell className="text-right font-medium">{e.total_price != null ? formatCurrency(e.total_price) : "–"}</TableCell>
                    <TableCell>{e.supplier || "–"}</TableCell>
                    <TableCell>{e.expense_date ? new Date(e.expense_date).toLocaleDateString(lang) : "–"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            await deleteExpense.mutateAsync(e.id);
                            toast.success(t("expense_deleted"));
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {(expenses as any[]).length > 0 && (
          <div className="flex justify-end">
            <span className="font-semibold">
              {t("total_expenses")}: {formatCurrency(total)} {t("currency")}
            </span>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{form.id ? t("edit_expense") : t("add_expense")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>{t("expense_name")} *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>{t("category")}</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder={t("select_category")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("none")}</SelectItem>
                  {(categories as any[]).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{catName(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("work_package")}</Label>
              <Select value={form.work_package_id} onValueChange={(v) => setForm((f) => ({ ...f, work_package_id: v }))}>
                <SelectTrigger><SelectValue placeholder={t("select_work_package")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("none")}</SelectItem>
                  {(workPackages as any[]).map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>{t("description")}</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label>{t("quantity")}</Label>
              <Input type="number" step="0.001" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value, total_overridden: false }))} />
            </div>
            <div>
              <Label>{t("unit")}</Label>
              <Input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="Stk, kg, l..." />
            </div>
            <div>
              <Label>{t("unit_price")} ({t("currency")})</Label>
              <Input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value, total_overridden: false }))} />
            </div>
            <div>
              <Label>{t("total_price")} ({t("currency")})</Label>
              <Input type="number" step="0.01" value={form.total_price} onChange={(e) => setForm((f) => ({ ...f, total_price: e.target.value, total_overridden: true }))} />
            </div>
            <div>
              <Label>{t("supplier")}</Label>
              <Input value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} />
            </div>
            <div>
              <Label>{t("cost_center")}</Label>
              <Input value={form.cost_center} onChange={(e) => setForm((f) => ({ ...f, cost_center: e.target.value }))} />
            </div>
            <div>
              <Label>{t("project_leader")}</Label>
              <PersonSelect
                value={form.project_leader_id === NONE ? "" : form.project_leader_id}
                onChange={(v) => setForm((f) => ({ ...f, project_leader_id: v || NONE }))}
                placeholder={t("project_leader")}
              />
            </div>
            <div>
              <Label>{t("expense_date")}</Label>
              <Input type="date" value={form.expense_date} onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>{t("notes")}</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={handleSubmit}>{form.id ? t("expense_updated") : t("add_expense")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
