import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export type LabelElementType =
  | "field"
  | "static_text"
  | "barcode"
  | "qrcode"
  | "ghs"
  | "psa"
  | "logo"
  | "rect"
  | "line";

export interface LabelElement {
  id: string;
  type: LabelElementType;
  x: number; // mm
  y: number; // mm
  w: number; // mm
  h: number; // mm
  // text/field
  field?: string; // field key from registry (when type=field)
  text?: string; // for static_text or static label prefix
  fontSize?: number; // pt
  fontWeight?: "normal" | "bold";
  align?: "left" | "center" | "right";
  color?: string;
  // barcode/qr
  source?: string; // field key whose value gets encoded
  barcodeFormat?: "CODE128" | "CODE39" | "EAN13";
  // ghs / psa
  symbolKey?: string; // when fixed
  symbols?: string[]; // when fixed multi
  auto?: boolean; // pull symbols from material data
  // rect/line
  bg?: string;
  border?: string;
  borderWidth?: number;
}

export interface LabelLayout {
  background?: string;
  elements: LabelElement[];
}

export interface LabelTemplate {
  id: string;
  name: string;
  category: string;
  width_mm: number;
  height_mm: number;
  layout: LabelLayout;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const labelTemplates = {
  list: () =>
    unwrap(
      dbClient
        .from("label_templates")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true })
    ) as unknown as Promise<LabelTemplate[]>,

  get: (id: string) =>
    unwrap(dbClient.from("label_templates").select("*").eq("id", id).single()) as unknown as Promise<LabelTemplate>,

  async create(input: {
    name: string;
    category: string;
    width_mm: number;
    height_mm: number;
    layout: LabelLayout;
    is_default?: boolean;
    created_by?: string | null;
  }): Promise<LabelTemplate> {
    if (input.is_default) {
      await run(
        dbClient.from("label_templates").update({ is_default: false }).eq("category", input.category)
      );
    }
    const res = await dbClient.from("label_templates").insert({
      name: input.name,
      category: input.category,
      width_mm: input.width_mm,
      height_mm: input.height_mm,
      layout: input.layout as any,
      is_default: !!input.is_default,
      created_by: input.created_by ?? null,
    }).select("*").single();
    if (res.error) throw res.error;
    return res.data as unknown as LabelTemplate;
  },

  async update(id: string, patch: Partial<LabelTemplate>): Promise<LabelTemplate> {
    if (patch.is_default) {
      const tpl = await this.get(id);
      await run(
        dbClient
          .from("label_templates")
          .update({ is_default: false })
          .eq("category", tpl.category)
          .neq("id", id)
      );
    }
    const res = await dbClient
      .from("label_templates")
      .update({
        name: patch.name,
        category: patch.category,
        width_mm: patch.width_mm,
        height_mm: patch.height_mm,
        layout: patch.layout as any,
        is_default: patch.is_default,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (res.error) throw res.error;
    return res.data as unknown as LabelTemplate;
  },

  remove: (id: string) => run(dbClient.from("label_templates").delete().eq("id", id)),

  async duplicate(id: string): Promise<LabelTemplate> {
    const src = await this.get(id);
    return this.create({
      name: `${src.name} (Kopie)`,
      category: src.category,
      width_mm: src.width_mm,
      height_mm: src.height_mm,
      layout: src.layout,
      is_default: false,
      created_by: src.created_by,
    });
  },
};

export interface PrintHistoryEntry {
  id: string;
  template_id: string | null;
  container_id: string | null;
  raw_material_id: string | null;
  copies: number;
  output: "print" | "pdf" | "reprint";
  data_snapshot: any;
  printed_by: string | null;
  printed_at: string;
}

export const labelPrintHistory = {
  listByContainer: (containerId: string) =>
    unwrap(
      dbClient
        .from("label_print_history")
        .select("*")
        .eq("container_id", containerId)
        .order("printed_at", { ascending: false })
    ) as unknown as Promise<PrintHistoryEntry[]>,

  listRecent: (limit = 100) =>
    unwrap(
      dbClient
        .from("label_print_history")
        .select("*")
        .order("printed_at", { ascending: false })
        .limit(limit)
    ) as unknown as Promise<PrintHistoryEntry[]>,

  log: (entry: {
    template_id: string;
    container_id?: string | null;
    raw_material_id?: string | null;
    copies: number;
    output: "print" | "pdf" | "reprint";
    data_snapshot: any;
    printed_by: string | null;
  }) =>
    run(
      dbClient.from("label_print_history").insert({
        template_id: entry.template_id,
        container_id: entry.container_id ?? null,
        raw_material_id: entry.raw_material_id ?? null,
        copies: entry.copies,
        output: entry.output,
        data_snapshot: entry.data_snapshot as any,
        printed_by: entry.printed_by,
      })
    ),
};
