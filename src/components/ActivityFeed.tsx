import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, Play, ArrowUpDown, AlertTriangle, ExternalLink } from "lucide-react";
import { useRecentActivity, useMarkNotificationRead, useMarkAllNotificationsRead, useUnreadNotificationsCount, type ActivityEntry } from "@/hooks/useActivityLog";

function formatRelative(dateStr: string, t: any): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t("activity:time_just_now");
  if (minutes < 60) return t("activity:time_minutes_ago", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("activity:time_hours_ago", { count: hours });
  const days = Math.floor(hours / 24);
  return t("activity:time_days_ago", { count: days });
}

function eventIcon(type: string) {
  switch (type) {
    case "measurement_completed":
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    case "measurement_started":
      return <Play className="h-4 w-4 text-warning" />;
    case "priority_changed":
      return <AlertTriangle className="h-4 w-4 text-primary" />;
    case "ranking_changed":
      return <ArrowUpDown className="h-4 w-4 text-primary" />;
    default:
      return <Activity className="h-4 w-4 text-muted-foreground" />;
  }
}

export function ActivityFeed() {
  const { t } = useTranslation(["activity", "common"]);
  const { data: entries = [], isLoading } = useRecentActivity(15);
  const { data: unreadCount = 0 } = useUnreadNotificationsCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleClick = (entry: ActivityEntry) => {
    if (entry.notification_id && entry.unread) {
      markRead.mutate(entry.notification_id);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5" />
          {t("activity:title")}
          {unreadCount > 0 && (
            <Badge variant="default" className="ml-2">
              {t("activity:view_all_unread", { count: unreadCount })}
            </Badge>
          )}
        </CardTitle>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()}>
            {t("activity:mark_all_read")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common:loading")}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t("activity:empty")}</p>
        ) : (
          <ul className="divide-y">
            {entries.map((e) => {
              const actorName = e.actor ? `${e.actor.first_name} ${e.actor.last_name}`.trim() : "—";
              const serviceName = e.service?.service_name;
              const measurementNumber = e.measurement?.measurement_number;
              const orderNumber = e.order?.order_number;
              const projectInfo = e.project ? `${e.project.project_number}${e.project.project_name ? " – " + e.project.project_name : ""}` : null;
              const linkTo = e.order_id ? `/auftraege/${e.order_id}` : e.project_id ? `/projekte/${e.project_id}` : null;

              const detailLine = (() => {
                if (e.event_type === "priority_changed" || e.event_type === "ranking_changed") {
                  const oldV = e.metadata?.old_value ?? "—";
                  const newV = e.metadata?.new_value ?? "—";
                  return `${orderNumber || "—"}: ${oldV} → ${newV}`;
                }
                return [measurementNumber, serviceName].filter(Boolean).join(" · ");
              })();

              return (
                <li
                  key={e.id}
                  className={`py-3 flex items-start gap-3 ${e.unread ? "bg-primary/5 -mx-6 px-6" : ""}`}
                >
                  <div className="mt-0.5">{eventIcon(e.event_type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {t(`activity:event_${e.event_type}`)}
                      </span>
                      {e.unread && (
                        <span className="h-2 w-2 rounded-full bg-primary" aria-label={t("activity:unread")} />
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatRelative(e.created_at, t)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{detailLine}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{t("activity:by_actor", { name: actorName })}</span>
                      {projectInfo && <span>· {projectInfo}</span>}
                    </div>
                  </div>
                  {linkTo && (
                    <Button variant="ghost" size="icon" asChild onClick={() => handleClick(e)}>
                      <Link to={linkTo} aria-label={t("activity:open_order")}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
