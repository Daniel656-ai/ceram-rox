import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjectsTool from "./tools/list-projects";
import listOrdersTool from "./tools/list-orders";

// The OAuth issuer MUST be the direct Supabase host. Build it from the project
// ref (inlined by Vite at build time so this stays import-safe — no runtime
// env reads). The fallback keeps the issuer well-formed during the throwaway
// manifest-extract eval where no token will verify anyway.
const projectRef =
  (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "ceram-rox-mcp",
  title: "Ceram ROX",
  version: "0.1.0",
  instructions:
    "Read-only access to Ceram ROX lab management. Use `list_projects` to browse projects and `list_orders` to browse measurement orders (optionally scoped to a project). All queries run as the signed-in user via Supabase RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProjectsTool, listOrdersTool],
});
