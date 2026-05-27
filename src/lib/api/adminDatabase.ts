import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

/** Operations exclusive to the Admin / Database page. */
export const adminDatabase = {
  async runIntegrityCheck(accessToken?: string) {
    const res = await dbClient.functions.invoke("db-integrity-check", {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    if (res.error) throw res.error;
    return res.data;
  },

  async exportAll() {
    const [projects, orders, measurements, samples, results, services] = await Promise.all([
      unwrap(dbClient.from("projects").select("*")),
      unwrap(dbClient.from("measurement_orders").select("*")),
      unwrap(dbClient.from("order_measurements").select("*")),
      unwrap(dbClient.from("samples").select("*")),
      unwrap(dbClient.from("measurement_results").select("*")),
      unwrap(dbClient.from("measurement_services").select("*")),
    ]);
    return { projects, orders, measurements, samples, results, services };
  },
};

/** Returns active profiles whose user_roles role is 'durchfuehrer' or 'master'. */
export const durchfuehrerUsers = {
  async list() {
    const [profilesRes, rolesRes] = await Promise.all([
      dbClient.from("profiles").select("*"),
      dbClient.from("user_roles").select("user_id, role"),
    ]);
    if (profilesRes.error) throw profilesRes.error;
    if (rolesRes.error) throw rolesRes.error;
    const ids = new Set(
      (rolesRes.data || [])
        .filter((r: any) => r.role === "durchfuehrer" || r.role === "master")
        .map((r: any) => r.user_id)
    );
    return (profilesRes.data || []).filter((p: any) => ids.has(p.user_id));
  },
};
