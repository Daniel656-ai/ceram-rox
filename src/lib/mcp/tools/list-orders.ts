import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "list_orders",
  title: "List measurement orders",
  description:
    "List measurement orders the signed-in user can access. Optionally filter by project_id. Returns id, order_number, order_type, status, priority, due_date and project link.",
  inputSchema: {
    project_id: z
      .string()
      .uuid()
      .optional()
      .describe("Optional project UUID to filter orders."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe("Maximum number of orders to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let query = sb
      .from("measurement_orders")
      .select(
        "id, order_number, order_type, status, priority, due_date, created_at, project_id, projects(project_number, project_name)",
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (project_id) query = query.eq("project_id", project_id);
    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { orders: data ?? [] },
    };
  },
});
