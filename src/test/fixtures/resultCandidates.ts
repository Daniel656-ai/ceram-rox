/**
 * Testdaten-Fabriken für die Ergebnisermittlung (officialResults).
 * Alle Werte sind erfunden; nur die für den Test relevanten Felder werden
 * über `over` gesetzt.
 */
import type { FormField } from "@/lib/api/formFields";
import type { FormCalculation } from "@/lib/api/formCalculations";
import type { ServiceDataField } from "@/lib/api/serviceDesigner";

export const formField = (over: Partial<FormField> & { field_key: string }): FormField => ({
  id: `field-${over.field_key}`,
  form_id: "form-1",
  display_name: over.field_key,
  description: null,
  field_type: "decimal",
  category: null,
  unit: null,
  is_required: false,
  default_value: null,
  validation: {},
  min_value: null,
  max_value: null,
  decimal_places: null,
  readonly: false,
  formula: null,
  select_options: [],
  ref_target: null,
  parent_field_id: null,
  sort_order: 0,
  metadata: {},
  global_field_id: null,
  binding_path: null,
  is_result: false,
  result_label: null,
  created_at: "",
  updated_at: "",
  ...over,
});

export const formCalculation = (
  over: Partial<FormCalculation> & { calc_key: string; formula: string },
): FormCalculation => ({
  id: `calc-${over.calc_key}`,
  form_id: "form-1",
  display_name: over.calc_key,
  description: null,
  expression: [],
  inputs: [],
  unit: null,
  decimals: 2,
  rounding: "round",
  result_type: "number",
  is_result: false,
  result_label: null,
  sort_order: 0,
  created_at: "",
  updated_at: "",
  ...over,
});

export const serviceField = (
  over: Partial<ServiceDataField> & { field_key: string },
): ServiceDataField => ({
  id: `sf-${over.field_key}`,
  service_id: "service-1",
  display_name: over.field_key,
  description: null,
  field_type: "decimal",
  category: null,
  unit: null,
  is_required: false,
  default_value: null,
  validation: {},
  min_value: null,
  max_value: null,
  decimal_places: null,
  readonly: false,
  archived: false,
  select_options: [],
  ref_target: null,
  parent_field_id: null,
  sort_order: 0,
  legacy_parameter_id: null,
  is_result: false,
  result_label: null,
  created_at: "",
  updated_at: "",
  ...over,
});
