import type { FormCalculation } from "@/lib/api/formCalculations";
import type { FormField } from "@/lib/api/formFields";
import type { ServiceDataField } from "@/lib/api/serviceDesigner";
import { evaluateLocalCalculations } from "@/lib/localCalculations";
import { evaluateFormula } from "@/lib/formulaEngine";
import {
  fieldElementKey, formatElementKey, parseElementRange, elementInRange, elementSortValue,
} from "@/lib/elementKeys";
import { withFixedRfaElements, isPositiveMeasurement, fixedElementUnit } from "@/lib/rfaFixedElements";
import {
  readResultConditions, collectResultConditions, buildConditionLabel, conditionsToContext,
} from "@/lib/fieldLinks";
import {
  readInstances,
  readMeasurementBlockMeta,
  instanceResultKey,
  toBlockChildDefs,
  readBlockChildRole,
  elementValueKey,
  elementFromValueKey,
} from "@/lib/measurementBlocks";

export interface OfficialResultCandidate {
  key: string;
  label: string;
  value: unknown;
  official: boolean;
  kind: "field" | "calculation";
  /** Einheit des Ergebnisfeldes – eigenes Attribut, nie Teil des Feldnamens. */
  unit?: string | null;
  error?: string | null;
  /** Kennung der konkreten Messung (Messdatenblock), sonst null. */
  instanceKey?: string | null;
  /** Fachliche Bezeichnung der Messung (z. B. „Kalibriert“). */
  instanceLabel?: string | null;
  /** Messkontext (Präparation, Analyseart …) inkl. strukturierter Messbedingungen. */
  instanceContext?: Record<string, string> | null;
}

/**
 * Builds the complete, namespaced result snapshot for one linked form.
 * Calculation results are evaluated here instead of relying on a React render
 * effect, so task completion always persists the value currently shown.
 */
export function buildLinkedFormResultCandidates(
  formId: string,
  fields: FormField[],
  calculations: FormCalculation[],
  taskValues: Record<string, unknown>,
): OfficialResultCandidate[] {
  const prefix = `form:${formId}:`;
  const localValues: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(taskValues)) {
    if (key.startsWith(prefix)) localValues[key.slice(prefix.length)] = value;
  }

  const blocks = fields.filter((f) => f.field_type === "measurement_block");
  const blockChildIds = new Set(
    fields
      .filter((f) => f.parent_field_id && blocks.some((b) => b.id === f.parent_field_id))
      .map((f) => f.id)
  );

  const calculated = evaluateLocalCalculations(
    calculations,
    localValues,
    fields.map((field) => field.field_key),
  );

  // Messdatenblöcke: jede Messung erzeugt eigenständige, eindeutig
  // zugeordnete Ergebnisse (SiO2 in Messung 1 ≠ SiO2 in Messung 2).
  const instanceCandidates: OfficialResultCandidate[] = [];
  for (const block of blocks) {
    const meta = readMeasurementBlockMeta(block);
    const storageKey = meta.storage_key || block.field_key;
    const children = fields.filter((f) => f.parent_field_id === block.id);
    for (const instance of readInstances(localValues[storageKey], meta, toBlockChildDefs(children))) {
      const valueChildren = children.filter(
        (c) =>
          c.field_type !== "measurement_import" &&
          c.field_type !== "repeater" &&
          readBlockChildRole(c) === "value"
      );
      const base = {
        kind: "field" as const,
        instanceKey: instance.instanceId,
        instanceLabel: instance.label,
        instanceContext: instance.context,
      };
      // Element-Zuordnung der Messwertfelder (Schlüssel statt Bezeichnung).
      const byElement = new Map<string, FormField>();
      for (const c of valueChildren) {
        const ek = fieldElementKey(c as any);
        if (ek && !byElement.has(ek)) byElement.set(ek, c);
      }
      const range = parseElementRange(instance.elementRange);
      // Bereichs-Messfälle („Standardlos“, „Oberfläche“): feste 17er-Struktur
      // zuerst, danach dynamisch die tatsächlich gemessenen Elemente (> 0).
      const spec = range ? withFixedRfaElements(instance.elementSpec) : instance.elementSpec;
      // Einheiten des Messdatenimports je Zielfeld – dadurch behalten auch
      // Ergebnisse ohne eigenes Formularfeld ihre originale Einheit (z. B. ppm).
      const importUnits: Record<string, string | null> = {};
      for (const c of children.filter((c) => c.field_type === "measurement_import")) {
        const raw = instance.values[c.field_key];
        if (typeof raw !== "string" || !raw.trim().startsWith("{")) continue;
        try {
          const parsed = JSON.parse(raw) as { units?: Record<string, string | null> };
          if (parsed?.units) Object.assign(importUnits, parsed.units);
        } catch { /* unlesbare Importinformation ändert keine Ergebnisse */ }
      }
      const unitFor = (key: string, child: FormField | null, fallback?: string | null) =>
        ((child as any)?.unit as string | null) ??
        importUnits[child ? child.field_key : elementValueKey(key)] ??
        fallback ??
        fixedElementUnit(key);
      const usedIds = new Set<string>();
      const usedElementKeys = new Set<string>();

      // Der Messfall gibt Auswahl UND Reihenfolge der Ergebnis-Elemente vor.
      // Ein Element ohne Messwert bleibt als leere Ergebnisposition erhalten.
      // Fehlt ein Formularfeld für das Element, liegt der Wert direkt im
      // Messblock-Eintrag (`element:<Key>`).
      for (const item of spec) {
        // Derselbe chemische Parameter darf pro Messung nur einmal als
        // Ergebnis entstehen (K2O und K₂O sind derselbe Parameter).
        if (usedElementKeys.has(item.key)) continue;
        const child = byElement.get(item.key);
        if (child) usedIds.add(child.id);
        usedElementKeys.add(item.key);

        const stored = instance.values[elementValueKey(item.key)];
        const childValue = child ? instance.values[child.field_key] : undefined;
        const value = childValue != null && childValue !== "" ? childValue : stored ?? null;
        instanceCandidates.push({
          ...base,
          key: instanceResultKey(
            prefix, storageKey, instance.instanceId,
            child ? child.field_key : elementValueKey(item.key)
          ),
          label: child
            ? child.result_label || child.display_name || child.field_key
            : item.label || formatElementKey(item.key),
          unit: unitFor(item.key, child ?? null, item.unit ?? null),
          value,
          official: item.official,
        });
      }

      // Bereichs-Messfall (z. B. Standardlos „B-U“): alle importierten
      // Elemente innerhalb des Bereichs sind Ergebnisse – sortiert nach
      // Ordnungszahl, ohne feste Liste.
      if (range) {
        const dyn: Array<{ key: string; child: FormField | null }> = [];
        for (const [k, v] of Object.entries(instance.values)) {
          const el = elementFromValueKey(k);
          if (!el || usedElementKeys.has(el) || !elementInRange(el, range)) continue;
          // Nur tatsächlich gemessene Elemente (> 0) werden Ergebnisfelder.
          if (!isPositiveMeasurement(v)) continue;
          dyn.push({ key: el, child: null });
        }
        for (const child of valueChildren) {
          if (usedIds.has(child.id)) continue;
          const ek = fieldElementKey(child as any);
          if (!ek || usedElementKeys.has(ek) || !elementInRange(ek, range)) continue;
          if (!isPositiveMeasurement(instance.values[child.field_key])) continue;
          usedIds.add(child.id);
          dyn.push({ key: ek, child });
        }
        dyn.sort((a, b) => elementSortValue(a.key) - elementSortValue(b.key) || a.key.localeCompare(b.key));
        for (const d of dyn) {
          usedElementKeys.add(d.key);
          instanceCandidates.push({
            ...base,
            key: instanceResultKey(
              prefix, storageKey, instance.instanceId,
              d.child ? d.child.field_key : elementValueKey(d.key)
            ),
            label: d.child
              ? d.child.result_label || d.child.display_name || d.child.field_key
              : formatElementKey(d.key),
            unit: unitFor(d.key, d.child),
            value: d.child ? instance.values[d.child.field_key] : instance.values[elementValueKey(d.key)],
            official: true,
          });
        }
      }

      for (const child of valueChildren) {
        if (usedIds.has(child.id)) continue;
        // Elementfelder außerhalb der Messfall-Liste sind erkannt/verfügbar,
        // aber niemals offizielles Ergebnis dieses Messfalls.
        const ek = fieldElementKey(child as any);
        if (ek && usedElementKeys.has(ek)) continue; // bereits als Messfall-Ergebnis geführt
        const isElement = (spec.length > 0 || !!range) && !!ek;
        instanceCandidates.push({
          ...base,
          key: instanceResultKey(prefix, storageKey, instance.instanceId, child.field_key),
          label: child.result_label || child.display_name || child.field_key,
          unit: (child as any).unit ?? null,
          value: instance.values[child.field_key],
          official: isElement ? false : child.is_result === true,
        });
      }

      // Importierte Elementwerte ohne Messfall-Zuordnung gehen nicht verloren:
      // sie werden mitgespeichert (nicht offiziell), damit kein erkannter
      // Messwert nur im Formular sichtbar bleibt.
      for (const [k, v] of Object.entries(instance.values)) {
        const el = elementFromValueKey(k);
        if (!el || usedElementKeys.has(el)) continue;
        if (v == null || v === "") continue;
        usedElementKeys.add(el);
        instanceCandidates.push({
          ...base,
          key: instanceResultKey(prefix, storageKey, instance.instanceId, elementValueKey(el)),
          label: formatElementKey(el),
          unit: unitFor(el, null),
          value: v,
          official: false,
        });
      }

    }
  }

  const all: OfficialResultCandidate[] = [
    ...fields
      .filter((field) => !blockChildIds.has(field.id) && field.field_type !== "measurement_block")
      .map((field) => {
        // Dynamische Ergebnisbezeichnung: Basisname + verknüpfte Messbedingungen.
        // Die Bedingungen bleiben zusätzlich strukturiert erhalten und werden
        // niemals aus dem Anzeigetext zurückgelesen.
        const base = field.result_label || field.display_name || field.field_key;
        const conditions = collectResultConditions(
          readResultConditions(field), fields, localValues,
        );
        return {
          key: `${prefix}${field.field_key}`,
          label: buildConditionLabel(base, conditions),
          unit: field.unit ?? null,
          value: localValues[field.field_key],
          official: field.is_result === true,
          kind: "field" as const,
          instanceContext: conditions.length ? conditionsToContext(conditions) : null,
        };
      }),
    ...instanceCandidates,
    ...calculations.map((calculation) => ({
      key: `${prefix}${calculation.calc_key}`,
      label: calculation.result_label || calculation.display_name || calculation.calc_key,
      unit: calculation.unit ?? null,
      value: calculated[calculation.calc_key]?.value ?? null,
      official: calculation.is_result === true,
      kind: "calculation" as const,
      error: calculated[calculation.calc_key]?.error ?? null,
    })),
  ];

  // Sicherheitsnetz: ein Ergebnisschlüssel erscheint genau einmal. Ein Wert
  // gewinnt gegenüber einer leeren Position desselben Schlüssels.
  const byKey = new Map<string, OfficialResultCandidate>();
  const order: string[] = [];
  for (const c of all) {
    const prev = byKey.get(c.key);
    if (!prev) { byKey.set(c.key, c); order.push(c.key); continue; }
    const prevEmpty = prev.value == null || prev.value === "";
    const nextEmpty = c.value == null || c.value === "";
    byKey.set(c.key, {
      ...(prevEmpty && !nextEmpty ? c : prev),
      official: prev.official || c.official,
    });
  }
  return order.map((k) => byKey.get(k)!);
}



/**
 * Builds the snapshot for the classic service form. Computed fields can depend
 * on other computed fields, so evaluation is repeated until no value changes.
 */
export function buildServiceResultCandidates(
  fields: ServiceDataField[],
  taskValues: Record<string, unknown>,
): OfficialResultCandidate[] {
  const resolved: Record<string, unknown> = { ...taskValues };
  const computed = fields.filter((field) => field.field_type === "computed" && !field.archived);
  const errors = new Map<string, string | null>();

  for (let pass = 0; pass < Math.max(1, computed.length); pass += 1) {
    let changed = false;
    for (const field of computed) {
      const formula = typeof field.validation?.formula === "string"
        ? field.validation.formula
        : "";
      if (!formula.trim()) continue;
      const result = evaluateFormula(formula, resolved, {
        knownReferences: fields.map((candidate) => candidate.field_key),
      });
      errors.set(field.field_key, result.error);
      if (result.value == null || result.error) continue;
      const value = typeof field.decimal_places === "number" && field.decimal_places >= 0
        ? Number(result.value.toFixed(field.decimal_places))
        : result.value;
      if (resolved[field.field_key] !== value) {
        resolved[field.field_key] = value;
        changed = true;
      }
    }
    if (!changed) break;
  }

  return fields
    .filter((field) => !field.archived)
    .map((field) => ({
      key: field.field_key,
      label: field.result_label || field.display_name || field.field_key,
      unit: field.unit ?? null,
      value: resolved[field.field_key],
      official: field.is_result === true,
      kind: field.field_type === "computed" ? "calculation" as const : "field" as const,
      error: field.field_type === "computed" ? errors.get(field.field_key) ?? null : null,
    }));
}
