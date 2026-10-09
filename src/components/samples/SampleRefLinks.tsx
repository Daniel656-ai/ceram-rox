import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { orderLabel, type OrderRef } from "@/lib/samples/orderLinks";

const linkCls = "text-primary underline underline-offset-2 hover:opacity-80";

/** Projekt-Link nur bei echter project_id; sonst nachvollziehbarer Hinweis. */
export function SampleProjectLink({
  projectId,
  project,
  full = false,
}: {
  projectId: string | null | undefined;
  project: { project_number: string | null; project_name: string | null } | null | undefined;
  full?: boolean;
}) {
  const { t } = useTranslation("samples");
  if (!projectId || !project) {
    return <span className="text-muted-foreground text-xs italic">{t("no_project_assigned", { defaultValue: "Kein Projekt" })}</span>;
  }
  const text = full && project.project_name
    ? `${project.project_number ?? ""} – ${project.project_name}`
    : project.project_number || project.project_name || "–";
  return (
    <Link to={`/projekte/${projectId}`} className={linkCls} onClick={(e) => e.stopPropagation()} title={project.project_name ?? undefined}>
      {text}
    </Link>
  );
}

/** Auftragslinks (alle über IDs zugeordneten Aufträge). */
export function SampleOrderLinks({ orders, vertical = false }: { orders: OrderRef[] | undefined; vertical?: boolean }) {
  const { t } = useTranslation("samples");
  if (!orders || orders.length === 0) {
    return <span className="text-muted-foreground text-xs italic">{t("no_order_assigned", { defaultValue: "Kein Auftrag" })}</span>;
  }
  return (
    <span className={vertical ? "flex flex-col items-end gap-1" : "flex flex-wrap gap-x-2 gap-y-0.5"}>
      {orders.map((o) => (
        <Link key={o.id} to={`/auftraege/${o.id}`} className={linkCls} onClick={(e) => e.stopPropagation()}>
          {orderLabel(o)}
        </Link>
      ))}
    </span>
  );
}
