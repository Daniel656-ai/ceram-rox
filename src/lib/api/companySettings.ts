import { dbClient } from "./client";
import { unwrap } from "./_helpers";

export type RawMaterialCheckMode = "warn" | "allow" | "block";

export interface CompanySettings {
  id: string;
  company_name: string | null;
  logo_data_url: string | null;
  logo_mime: string | null;
  logo_updated_at: string | null;
  raw_material_check_mode: RawMaterialCheckMode;
  updated_at: string;
  updated_by: string | null;
}

export const companySettings = {
  async get(): Promise<CompanySettings | null> {
    return unwrap(
      dbClient.from("company_settings").select("*").eq("singleton", true).maybeSingle()
    ) as Promise<CompanySettings | null>;
  },

  async update(
    patch: {
      company_name?: string | null;
      logo_data_url?: string | null;
      logo_mime?: string | null;
      raw_material_check_mode?: RawMaterialCheckMode;
    },
    userId: string
  ): Promise<CompanySettings> {
    const payload: any = { ...patch, updated_by: userId };
    if (patch.logo_data_url !== undefined) payload.logo_updated_at = new Date().toISOString();

    // Ensure singleton row exists
    const existing = await unwrap(
      dbClient.from("company_settings").select("id").eq("singleton", true).maybeSingle()
    );
    if (!existing) {
      return unwrap(
        dbClient
          .from("company_settings")
          .insert({ singleton: true, ...payload })
          .select()
          .single()
      ) as Promise<CompanySettings>;
    }
    return unwrap(
      dbClient
        .from("company_settings")
        .update(payload)
        .eq("singleton", true)
        .select()
        .single()
    ) as Promise<CompanySettings>;
  },
};
