import { dbClient } from "./client";
import { unwrap } from "./_helpers";

export type SymbolCategory = "ghs" | "psa";

export interface CustomSymbol {
  id: string;
  category: SymbolCategory;
  code: string;
  name: string;
  description: string | null;
  image_data_url: string;
  mime_type: string;
  file_size: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface CreateCustomSymbolInput {
  category: SymbolCategory;
  code: string;
  name: string;
  description?: string | null;
  image_data_url: string;
  mime_type: string;
  file_size?: number | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface UpdateCustomSymbolInput {
  code?: string;
  name?: string;
  description?: string | null;
  image_data_url?: string;
  mime_type?: string;
  file_size?: number | null;
  sort_order?: number;
  is_active?: boolean;
}

export const customSymbols = {
  async list(category?: SymbolCategory): Promise<CustomSymbol[]> {
    let q = dbClient.from("custom_symbols").select("*").order("category").order("sort_order").order("name");
    if (category) q = q.eq("category", category);
    return (await unwrap(q)) as CustomSymbol[];
  },

  async create(input: CreateCustomSymbolInput, userId: string): Promise<CustomSymbol> {
    return unwrap(
      dbClient
        .from("custom_symbols")
        .insert({ ...input, created_by: userId, updated_by: userId })
        .select()
        .single()
    ) as Promise<CustomSymbol>;
  },

  async update(id: string, patch: UpdateCustomSymbolInput, userId: string): Promise<CustomSymbol> {
    return unwrap(
      dbClient
        .from("custom_symbols")
        .update({ ...patch, updated_by: userId })
        .eq("id", id)
        .select()
        .single()
    ) as Promise<CustomSymbol>;
  },

  async remove(id: string): Promise<void> {
    await unwrap(dbClient.from("custom_symbols").delete().eq("id", id));
  },
};
