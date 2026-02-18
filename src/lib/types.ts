import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type MeasurementService = Database["public"]["Tables"]["measurement_services"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type MeasurementOrder = Database["public"]["Tables"]["measurement_orders"]["Row"];
export type OrderMeasurement = Database["public"]["Tables"]["order_measurements"]["Row"];
export type MeasurementParameter = Database["public"]["Tables"]["measurement_parameters"]["Row"];
export type WorkLog = Database["public"]["Tables"]["work_logs"]["Row"];
export type Document = Database["public"]["Tables"]["documents"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type OrderType = Database["public"]["Enums"]["order_type"];
export type MeasurementStatus = Database["public"]["Enums"]["measurement_status"];
export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type ServiceCategory = Database["public"]["Enums"]["service_category"];
export type OrderPriority = Database["public"]["Enums"]["order_priority"];

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  customer: "Kundenauftrag",
  production: "Produktionsauftrag",
  rnd: "F&E-Auftrag",
};

export const MEASUREMENT_STATUS_LABELS: Record<MeasurementStatus, string> = {
  open: "Offen",
  in_progress: "In Bearbeitung",
  completed: "Abgeschlossen",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  open: "Offen",
  in_progress: "In Bearbeitung",
  completed: "Abgeschlossen",
};

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  labor: "Labor",
  pilot_plant: "Pilot Plant",
};

export const ORDER_PRIORITY_LABELS: Record<OrderPriority, string> = {
  normal: "Normal",
  wichtig: "Wichtig",
  hoechste: "Höchste",
};
