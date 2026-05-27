import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export interface ActivityEntry {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  order_id: string | null;
  order_measurement_id: string | null;
  project_id: string | null;
  service_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  actor?: { first_name: string; last_name: string } | null;
  service?: { service_name: string } | null;
  order?: { order_number: string | null } | null;
  measurement?: { measurement_number: string } | null;
  project?: { project_number: string; project_name: string | null } | null;
  unread?: boolean;
  notification_id?: string | null;
}

export function useRecentActivity(limit = 15) {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = api
      .channel("activity-log-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, () => {
        qc.invalidateQueries({ queryKey: ["activity-log"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["activity-log"] });
        qc.invalidateQueries({ queryKey: ["unread-notifications-count"] });
      })
      .subscribe();
    return () => {
      api.removeChannel(channel);
    };
  }, [user, qc]);

  return useQuery({
    queryKey: ["activity-log", limit],
    enabled: !!user,
    queryFn: async (): Promise<ActivityEntry[]> => {
      const { data, error } = await api
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const entries = (data || []) as any[];
      if (entries.length === 0) return [];

      const actorIds = Array.from(new Set(entries.map((e) => e.actor_user_id).filter(Boolean)));
      const serviceIds = Array.from(new Set(entries.map((e) => e.service_id).filter(Boolean)));
      const orderIds = Array.from(new Set(entries.map((e) => e.order_id).filter(Boolean)));
      const measurementIds = Array.from(new Set(entries.map((e) => e.order_measurement_id).filter(Boolean)));
      const projectIds = Array.from(new Set(entries.map((e) => e.project_id).filter(Boolean)));

      const [profilesRes, servicesRes, ordersRes, measurementsRes, projectsRes, notificationsRes] = await Promise.all([
        actorIds.length ? api.from("profiles").select("user_id, first_name, last_name").in("user_id", actorIds) : Promise.resolve({ data: [] as any[], error: null }),
        serviceIds.length ? api.from("measurement_services").select("id, service_name").in("id", serviceIds) : Promise.resolve({ data: [] as any[], error: null }),
        orderIds.length ? api.from("measurement_orders").select("id, order_number").in("id", orderIds) : Promise.resolve({ data: [] as any[], error: null }),
        measurementIds.length ? api.from("order_measurements").select("id, measurement_number").in("id", measurementIds) : Promise.resolve({ data: [] as any[], error: null }),
        projectIds.length ? api.from("projects").select("id, project_number, project_name").in("id", projectIds) : Promise.resolve({ data: [] as any[], error: null }),
        api.from("notifications").select("id, activity_id, read_at").eq("user_id", user!.id).in("activity_id", entries.map((e) => e.id)),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p]));
      const serviceMap = new Map((servicesRes.data || []).map((s: any) => [s.id, s]));
      const orderMap = new Map((ordersRes.data || []).map((o: any) => [o.id, o]));
      const measurementMap = new Map((measurementsRes.data || []).map((m: any) => [m.id, m]));
      const projectMap = new Map((projectsRes.data || []).map((p: any) => [p.id, p]));
      const notificationMap = new Map((notificationsRes.data || []).map((n: any) => [n.activity_id, n]));

      return entries.map((e) => {
        const notification = notificationMap.get(e.id);
        return {
          ...e,
          actor: e.actor_user_id ? profileMap.get(e.actor_user_id) || null : null,
          service: e.service_id ? serviceMap.get(e.service_id) || null : null,
          order: e.order_id ? orderMap.get(e.order_id) || null : null,
          measurement: e.order_measurement_id ? measurementMap.get(e.order_measurement_id) || null : null,
          project: e.project_id ? projectMap.get(e.project_id) || null : null,
          notification_id: notification?.id || null,
          unread: notification ? notification.read_at === null : false,
        } as ActivityEntry;
      });
    },
  });
}

export function useUnreadNotificationsCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["unread-notifications-count"],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await api
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .is("read_at", null);
      if (error) throw error;
      return count || 0;
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await api
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity-log"] });
      qc.invalidateQueries({ queryKey: ["unread-notifications-count"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await api
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user!.id)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity-log"] });
      qc.invalidateQueries({ queryKey: ["unread-notifications-count"] });
    },
  });
}
