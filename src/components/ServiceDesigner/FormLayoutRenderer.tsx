import { useMemo, useState, createContext, useContext } from "react";
import type { LayoutNode, FieldNode, TabsNode, ColumnsNode, LayoutWidth, FormLayoutTree } from "@/lib/api/formDefinitionLayout";
import type { FormField } from "@/lib/api/formFields";
import type { EffectivePermission } from "@/lib/api/formFieldPermissions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const PermissionsCtx = createContext<Map<string, EffectivePermission> | null>(null);
const usePerm = (fieldId: string): EffectivePermission => {
  const m = useContext(PermissionsCtx);
  return m?.get(fieldId) ?? { visibility: "write", required: false };
};

const widthCls = (w?: LayoutWidth) => {
  switch (w) {
    case 3: return "col-span-12 md:col-span-3";
    case 4: return "col-span-12 md:col-span-4";
    case 6: return "col-span-12 md:col-span-6";
    case 8: return "col-span-12 md:col-span-8";
    case 9: return "col-span-12 md:col-span-9";
    default: return "col-span-12";
  }
};

function FieldPreview({ field, node }: { field: FormField | undefined; node: FieldNode }) {
  if (!field) {
    return (
      <div className="border border-dashed rounded p-2 text-xs text-muted-foreground bg-muted/40">
        Feld nicht gefunden (id: {node.field_id?.slice(0, 8)}…)
      </div>
    );
  }
  const perm = usePerm(field.id);
  if (perm.visibility === "hidden") return null;
  const label = node.label_override || field.display_name;
  const desc = node.description_override ?? field.description;
  const readonly = node.readonly || field.readonly || perm.visibility === "read";
  const required = perm.required || field.is_required;

  const control = (() => {
    switch (field.field_type) {
      case "longtext":
        return <Textarea rows={3} disabled={readonly} placeholder={field.default_value ?? ""} />;
      case "boolean":
        return <div className="pt-1"><Switch disabled={readonly} /></div>;
      case "select":
      case "multiselect":
        return (
          <Select disabled>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {(field.select_options ?? []).map((o, i) => {
                const v = typeof o === "string" ? o : o.value;
                const l = typeof o === "string" ? o : o.label;
                return <SelectItem key={i} value={v || String(i)}>{l}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        );
      case "date":
      case "time":
      case "datetime":
        return <Input type={field.field_type === "datetime" ? "datetime-local" : field.field_type} disabled={readonly} />;
      case "number":
      case "decimal":
      case "percent":
        return <Input type="number" disabled={readonly} placeholder={field.default_value ?? ""} />;
      case "file":
      case "image":
        return <Input type="file" disabled={readonly} />;
      default:
        return <Input type="text" disabled={readonly} placeholder={field.default_value ?? ""} />;
    }
  })();

  return (
    <div className="space-y-1">
      <Label className="text-xs flex items-center gap-1">
        {label} {required && <span className="text-destructive">*</span>}
        {field.unit && <span className="text-muted-foreground font-normal ml-1">[{field.unit}]</span>}
        {perm.locked && <Lock className="h-3 w-3 text-muted-foreground" aria-label="Nach Abschluss gesperrt" />}
      </Label>
      {control}
      {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
    </div>
  );
}

function RenderNode({ node, fields }: { node: LayoutNode; fields: FormField[] }) {
  if (node.visible === false) return null;

  switch (node.type) {
    case "section": {
      const n = node;
      return (
        <div className={cn("border rounded-lg p-4 bg-card", widthCls(n.width), n.className)}>
          {n.title && <div className="font-semibold text-sm mb-1">{n.title}</div>}
          {n.description && <p className="text-xs text-muted-foreground mb-3">{n.description}</p>}
          <div className="grid grid-cols-12 gap-3">
            {n.children.map(c => <RenderNode key={c.id} node={c} fields={fields} />)}
          </div>
        </div>
      );
    }
    case "group":
    case "container": {
      const n = node;
      return (
        <div className={cn("border rounded p-3", widthCls(n.width), n.className)}>
          {(n as any).title && <div className="font-medium text-sm mb-2">{(n as any).title}</div>}
          <div className="grid grid-cols-12 gap-3">
            {(n as any).children.map((c: LayoutNode) => <RenderNode key={c.id} node={c} fields={fields} />)}
          </div>
        </div>
      );
    }
    case "tabs": {
      const n = node as TabsNode;
      const first = n.children[0]?.id ?? "";
      return (
        <div className={cn(widthCls(n.width), n.className)}>
          <TabsInner defaultTab={first}>
            {n.children.map(t => (
              <TabsContent key={t.id} value={t.id} className="mt-3">
                <div className="grid grid-cols-12 gap-3">
                  {t.children.map(c => <RenderNode key={c.id} node={c} fields={fields} />)}
                </div>
              </TabsContent>
            ))}
            <TabsList slot="__list" className="hidden" />
          </TabsInner>
        </div>
      );
    }
    case "columns": {
      const n = node as ColumnsNode;
      const spanCls = n.columnCount === 3 ? "col-span-12 md:col-span-4" : n.columnCount === 2 ? "col-span-12 md:col-span-6" : "col-span-12";
      return (
        <div className={cn("grid grid-cols-12 gap-3", widthCls(n.width), n.className)}>
          {n.children.map(col => (
            <div key={col.id} className={spanCls}>
              <div className="grid grid-cols-12 gap-3">
                {col.children.map(c => <RenderNode key={c.id} node={c} fields={fields} />)}
              </div>
            </div>
          ))}
        </div>
      );
    }
    case "divider":
      return <div className={cn("col-span-12", node.className)}><hr className="my-2" /></div>;
    case "heading": {
      const n = node;
      const H = (`h${n.level ?? 3}` as any);
      return <H className={cn("col-span-12 font-semibold", n.level === 1 && "text-2xl", n.level === 2 && "text-xl", (!n.level || n.level >= 3) && "text-base", n.className)}>{n.text}</H>;
    }
    case "note": {
      const n = node;
      const vc = n.variant === "warning" ? "bg-amber-50 border-amber-200 text-amber-900" : n.variant === "muted" ? "bg-muted text-muted-foreground" : "bg-primary/5 border-primary/20";
      return <div className={cn("col-span-12 text-sm border rounded p-3", vc, n.className)}>{n.text}</div>;
    }
    case "field": {
      const f = fields.find(x => x.id === node.field_id);
      return (
        <div className={cn(widthCls(node.width), node.className)}>
          <FieldPreview field={f} node={node} />
        </div>
      );
    }
    default:
      return null;
  }
}

function TabsInner({ defaultTab, children }: { defaultTab: string; children: React.ReactNode }) {
  // Extract tab list from children (siblings TabsContent) so header stays in sync.
  const tabIds = useMemo(() => {
    const arr: { id: string; title: string }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Array.isArray(children) ? children : [children]).forEach((c: any) => {
      if (c?.props?.value && typeof c.props.value === "string") {
        arr.push({ id: c.props.value, title: c.props["data-title"] ?? c.props.value });
      }
    });
    return arr;
  }, [children]);
  const [val, setVal] = useState(defaultTab);
  return (
    <Tabs value={val} onValueChange={setVal}>
      <TabsList>
        {tabIds.map(t => <TabsTrigger key={t.id} value={t.id}>{t.title}</TabsTrigger>)}
      </TabsList>
      {children}
    </Tabs>
  );
}

export default function FormLayoutRenderer({
  layout,
  fields,
  permissions,
}: {
  layout: FormLayoutTree;
  fields: FormField[];
  permissions?: Map<string, EffectivePermission>;
}) {
  if (!layout.nodes.length) {
    return <div className="text-sm text-muted-foreground border rounded p-6 text-center">Noch keine Elemente im Layout.</div>;
  }
  return (
    <PermissionsCtx.Provider value={permissions ?? null}>
      <div className="grid grid-cols-12 gap-3">
        {layout.nodes.map(n => <RenderNode key={n.id} node={n} fields={fields} />)}
      </div>
    </PermissionsCtx.Provider>
  );
}
