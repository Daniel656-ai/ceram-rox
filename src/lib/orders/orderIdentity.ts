import { resolveOrderKind } from "./orderKind";

export type OrderIdentitySource = Parameters<typeof resolveOrderKind>[0] & {
  order_number?: string | null;
  pp_experiment_number?: string | null;
};

/** Display only: never derive, normalize or persist an experiment number. */
export function orderIdentity(order: OrderIdentitySource) {
  const isPilotPlant = resolveOrderKind(order) === "pilot_plant";
  const experimentNumber = isPilotPlant && order.pp_experiment_number?.trim()
    ? order.pp_experiment_number
    : null;
  return {
    number: experimentNumber ?? order.order_number ?? "",
    technicalNumber: order.order_number ?? "",
    hasExperimentNumber: experimentNumber !== null,
    missingExperimentNumber: isPilotPlant && experimentNumber === null,
  };
}