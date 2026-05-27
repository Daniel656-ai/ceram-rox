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

  useEffect(() => {
    if (!user) return;
    return api.realtime.onActivityAndNotifications(user.id, () => {
      qc.invalidateQueries({ queryKey: ["activity-log"] });
      qc.invalidateQueries({ queryKey: ["unread-notifications-count"] });
    });
  }, [user, qc]);

  return useQuery({
    queryKey: ["activity-log", limit],
    enabled: !!user,
    queryFn: async (): Promise<ActivityEntry[]> => {
      const entries = (await api.activityLog.listRecent(limit)) as any[];
      if (!entries.length) return [];

      const actorIds = Array.from(new Set(entries.map((e) => e.actor_user_id).filter(Boolean))) as string[];
      const serviceIds = Array.from(new Set(entries.map((e) => e.service_id).filter(Boolean))) as string[];
      const orderIds = Array.from(new Set(entries.map((e) => e.order_id).filter(Boolean))) as string[];
      const measurementIds = Array.from(new Set(entries.map((e) => e.order_measurement_id).filter(Boolean))) as string[];
      const projectIds = Array.from(new Set(entries.map((e) => e.project_id).filter(Boolean))) as string[];

      const [profilesRes, servicesRes, ordersRes, measurementsRes, projectsRes, notificationsRes] = await Promise.all([
        actorIds.length ? api.profiles.listByIds(actorIds) : Promise.resolve([] as any[]),
        serviceIds.length ? api.measurementServicesLookup.listByIds(serviceIds) : Promise.resolve([] as any[]),
        orderIds.length ? api.ordersLookup.listByIds(orderIds) : Promise.resolve([] as any[]),
        measurementIds.length ? api.measurementsLookup.listByIds(measurementIds) : Promise.resolve([] as any[]),
        projectIds.length ? api.projectsLookup.listByIds(projectIds) : Promise.resolve([] as any[]),
        api.notifications.listForActivities(user!.id, entries.map((e) => e.id)),
      ]);

      const profileMap = new Map((profilesRes as any[]).map((p: any) => [p.user_id, p]));
      const serviceMap = new Map((servicesRes as any[]).map((s: any) => [s.id, s]));
      const orderMap = new Map((ordersRes as any[]).map((o: any) => [o.id, o]));
      const measurementMap = new Map((measurementsRes as any[]).map((m: any) => [m.id, m]));
      const projectMap = new Map((projectsRes as any[]).map((p: any) => [p.id, p]));
      const notificationMap = new Map((notificationsRes as any[]).map((n: any) => [n.activity_id, n]));

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
    queryFn: () => api.notifications.unreadCount(user!.id),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
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
    mutationFn: () => api.notifications.markAllRead(user!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity-log"] });
      qc.invalidateQueries({ queryKey: ["unread-notifications-count"] });
    },
  });
}
