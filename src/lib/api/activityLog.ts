import { dbClient } from "./client";
import { unwrap, run } from "./_helpers";

export const activityLog = {
  listRecent: (limit: number) =>
    unwrap(
      dbClient
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit)
    ),
};

export const notifications = {
  listForActivities: (userId: string, activityIds: string[]) =>
    unwrap(
      dbClient
        .from("notifications")
        .select("id, activity_id, read_at")
        .eq("user_id", userId)
        .in("activity_id", activityIds)
    ),

  async unreadCount(userId: string): Promise<number> {
    const { count, error } = await dbClient
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw error;
    return count || 0;
  },

  markRead: (notificationId: string) =>
    run(dbClient.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId)),

  markAllRead: (userId: string) =>
    run(
      dbClient
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null)
    ),
};

/** Realtime channel subscriptions. Kept here so hooks never touch `dbClient.channel` directly. */
export const realtime = {
  onActivityAndNotifications(userId: string, onChange: () => void) {
    const channel = dbClient
      .channel("activity-log-feed")
      .on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "activity_log" }, onChange)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        onChange
      )
      .subscribe();
    return () => {
      dbClient.removeChannel(channel);
    };
  },
};

export const measurementServicesLookup = {
  listByIds: (ids: string[]) =>
    unwrap(dbClient.from("measurement_services").select("id, service_name").in("id", ids)),
};

export const ordersLookup = {
  listByIds: (ids: string[]) =>
    unwrap(dbClient.from("measurement_orders").select("id, order_number").in("id", ids)),
};

export const measurementsLookup = {
  listByIds: (ids: string[]) =>
    unwrap(dbClient.from("order_measurements").select("id, measurement_number").in("id", ids)),
};

export const projectsLookup = {
  listByIds: (ids: string[]) =>
    unwrap(dbClient.from("projects").select("id, project_number, project_name").in("id", ids)),
};
