import {
  isServiceField,
  normalizeToken,
  readServiceSelectionEntries,
  resolveEntryService,
  type SelectableService,
  type SelectionEntry,
  type SelectionField,
} from "@/lib/orderServiceSelection";

/**
 * Bearbeiten-Modus (Aufgabe 012, Stufe 3c): Häkchen im Auftragsformular <-> Dienstleistungen des Auftrags.
 * Reine Logik ohne Oberfläche. Die Zuordnung Häkchen -> Dienstleistung nutzt dieselbe Auflösung wie das Erstellen
 * (resolveEntryService in orderServiceSelection.ts) – keine zweite Zuordnungslogik.
 *
 * Regeln:
 *  - Sperre pro Gruppe (= ein Dienstleistungs-Auswahlfeld): gesperrt, sobald eine Dienstleistung eines gesetzten Häkchens
 *    (gespeicherter Stand) im Auftrag bereits begonnen ist (nicht entfernbar).
 *  - Häkchen setzen   -> Dienstleistung hinzufügen (neue Position), außer sie existiert schon / ist schon vorgemerkt.
 *  - Häkchen entfernen -> Dienstleistung zum Entfernen vormerken, außer ein anderes Häkchen verweist noch auf sie.
 *  - Gleichlauf: Entfernen/Hinzufügen über Liste/Karte passt die Häkchen an (und umgekehrt).
 */

type Values = Record<string, any>;

export interface TickEnv {
  fields: SelectionField[];
  services: SelectableService[];
}

export interface Tick {
  fieldKey: string;
  token: string;
  /** Aufgelöste Dienstleistung (null = ohne passende aktive Dienstleistung). */
  serviceId: string | null;
  service?: SelectableService;
}

const serviceFields = (env: TickEnv) => env.fields.filter((f) => isServiceField(f, env.services));

const asList = (raw: unknown): unknown[] => (Array.isArray(raw) ? raw : raw == null || raw === "" ? [] : [raw]);

const rawToken = (entry: unknown): string => {
  const isObj = typeof entry === "object" && entry !== null;
  return String(isObj ? ((entry as any).value ?? (entry as any).label ?? "") : entry).trim();
};

/** Alle gesetzten Häkchen der Dienstleistungs-Auswahlfelder samt aufgelöster Dienstleistung. */
export function readTicks(values: Values, env: TickEnv): Tick[] {
  const out: Tick[] = [];
  for (const f of serviceFields(env)) {
    for (const entry of readServiceSelectionEntries(values, [f], env.services)) {
      const { service } = resolveEntryService(entry, env.services);
      out.push({ fieldKey: f.field_key, token: entry.token, serviceId: service?.id ?? null, service });
    }
  }
  return out;
}

/**
 * Gruppen (Feldschlüssel), die gesperrt sind: im gespeicherten Stand ist ein Häkchen gesetzt, dessen Dienstleistung
 * im Auftrag existiert und NICHT entfernbar ist (bereits begonnen).
 */
export function lockedTickGroups(baseline: Values, env: TickEnv, notRemovableServiceIds: Set<string>): string[] {
  const keys = new Set<string>();
  for (const t of readTicks(baseline, env)) {
    if (t.serviceId && notRemovableServiceIds.has(t.serviceId)) keys.add(t.fieldKey);
  }
  return [...keys];
}

export interface TickChange {
  ticked: Tick[];
  unticked: Tick[];
}

const keyOf = (t: Tick) => `${t.fieldKey}::${normalizeToken(t.token)}`;

/** Welche Häkchen wurden zwischen zwei Ständen gesetzt bzw. entfernt? */
export function tickDelta(prev: Values, next: Values, env: TickEnv): TickChange {
  const before = readTicks(prev, env);
  const after = readTicks(next, env);
  const beforeKeys = new Set(before.map(keyOf));
  const afterKeys = new Set(after.map(keyOf));
  return {
    ticked: after.filter((t) => !beforeKeys.has(keyOf(t))),
    unticked: before.filter((t) => !afterKeys.has(keyOf(t))),
  };
}

export interface PendingPosition {
  uid: string;
  service_id: string;
  origin?: string;
  selection_token?: string | null;
}

export interface TickPlan {
  /** Bestehende Dienstleistungen, die zum Entfernen vorzumerken sind (kein Häkchen verweist mehr auf sie). */
  removeServiceIds: string[];
  /** Zum Entfernen vorgemerkte Dienstleistungen, deren Häkchen wieder gesetzt wurde -> Vormerkung aufheben. */
  unremoveServiceIds: string[];
  /** Neue Positionen (Dienstleistung hinzufügen), je gesetztem Häkchen ohne vorhandene/vorgemerkte Dienstleistung. */
  add: Array<{ service: SelectableService; token: string }>;
  /** Auswahlwerte, deren vorgemerkte (noch nicht gespeicherte) Positionen wegfallen. */
  removePendingTokens: string[];
}

/** Plan für eine Änderung der Häkchen (nur Bearbeiten-Modus). */
export function planTickChange(params: {
  prev: Values;
  next: Values;
  env: TickEnv;
  existingServiceIds: Set<string>;
  removedServiceIds: string[];
  pending: PendingPosition[];
}): TickPlan {
  const { prev, next, env, existingServiceIds, removedServiceIds, pending } = params;
  const delta = tickDelta(prev, next, env);
  const nextTicks = readTicks(next, env);
  const stillTicked = (serviceId: string) => nextTicks.some((t) => t.serviceId === serviceId);
  const plan: TickPlan = { removeServiceIds: [], unremoveServiceIds: [], add: [], removePendingTokens: [] };

  for (const u of delta.unticked) {
    plan.removePendingTokens.push(u.token);
    if (
      u.serviceId &&
      existingServiceIds.has(u.serviceId) &&
      !stillTicked(u.serviceId) &&
      !removedServiceIds.includes(u.serviceId) &&
      !plan.removeServiceIds.includes(u.serviceId)
    ) {
      plan.removeServiceIds.push(u.serviceId);
    }
  }
  for (const t of delta.ticked) {
    if (!t.serviceId || !t.service) continue;
    if (removedServiceIds.includes(t.serviceId)) {
      if (!plan.unremoveServiceIds.includes(t.serviceId)) plan.unremoveServiceIds.push(t.serviceId);
      continue;
    }
    if (existingServiceIds.has(t.serviceId)) continue; // keine Doppelbuchung
    if (pending.some((p) => p.service_id === t.serviceId)) continue; // schon vorgemerkt
    if (plan.add.some((a) => a.service.id === t.serviceId)) continue;
    plan.add.push({ service: t.service, token: t.token });
  }
  // Ein Auswahlwert, der gleichzeitig wieder gesetzt wurde, darf seine Position nicht verlieren.
  plan.removePendingTokens = plan.removePendingTokens.filter(
    (tok) => !nextTicks.some((t) => normalizeToken(t.token) === normalizeToken(tok)),
  );
  return plan;
}

/**
 * Gleichlauf Liste -> Häkchen: Häkchen der entfernten Dienstleistungen verschwinden, Häkchen der Dienstleistungen, deren
 * Entfernen zurückgenommen wurde, kommen aus dem gespeicherten Stand zurück. Liefert nur geänderte Felder.
 */
export function syncTicksToRemoval(params: {
  values: Values;
  baseline: Values;
  env: TickEnv;
  prevRemoved: string[];
  nextRemoved: string[];
}): Values {
  const { values, baseline, env, prevRemoved, nextRemoved } = params;
  const next = new Set(nextRemoved);
  const restored = new Set(prevRemoved.filter((id) => !next.has(id)));
  const patch: Values = {};
  for (const f of serviceFields(env)) {
    const current = asList(values[f.field_key]);
    const serviceOf = (raw: unknown): string | null => {
      const entry = readServiceSelectionEntries({ [f.field_key]: [raw] }, [f], env.services)[0] as SelectionEntry | undefined;
      return entry ? resolveEntryService(entry, env.services).service?.id ?? null : null;
    };
    let list = current.filter((raw) => {
      const sid = serviceOf(raw);
      return !(sid && next.has(sid));
    });
    const have = new Set(list.map((r) => normalizeToken(rawToken(r))));
    for (const raw of asList(baseline[f.field_key])) {
      const sid = serviceOf(raw);
      if (sid && restored.has(sid) && !have.has(normalizeToken(rawToken(raw)))) {
        list = [...list, raw];
        have.add(normalizeToken(rawToken(raw)));
      }
    }
    const changed = list.length !== current.length || list.some((r, i) => r !== current[i]);
    if (changed) patch[f.field_key] = list;
  }
  return patch;
}

/**
 * Gleichlauf Karte -> Häkchen: Eine über die Karte hinzugefügte Dienstleistung setzt – falls es dafür ein Häkchen gibt und
 * noch keins gesetzt ist – das erste passende Häkchen. Wird eine NEU gesetzte, nicht gespeicherte Auswahl später überflüssig
 * (keine vorgemerkte Position, Dienstleistung nicht im Auftrag), verschwindet das Häkchen wieder. Liefert nur geänderte Felder.
 */
export function syncTicksToPending(params: {
  values: Values;
  baseline: Values;
  env: TickEnv;
  existingServiceIds: Set<string>;
  pending: PendingPosition[];
}): Values {
  const { values, baseline, env, existingServiceIds, pending } = params;
  const baselineKeys = new Set(readTicks(baseline, env).map(keyOf));
  const ticks = readTicks(values, env);
  const pendingServices = new Set(pending.map((p) => p.service_id));
  const patch: Values = {};
  const listOf = (key: string) => (key in patch ? (patch[key] as unknown[]) : asList(values[key]));

  // Häkchen anpassen: manuell hinzugefügte Positionen
  for (const p of pending) {
    if (p.origin === "template") continue;
    if (existingServiceIds.has(p.service_id)) continue;
    if (ticks.some((t) => t.serviceId === p.service_id)) continue;
    for (const f of serviceFields(env)) {
      const opt = (f.select_options ?? []).find((o) => {
        if (!o) return false;
        const entry: SelectionEntry =
          typeof o === "string"
            ? { token: o, aliases: [] }
            : { token: String(o.value ?? o.label ?? ""), aliases: o.label ? [String(o.label)] : [], service_id: o.service_id ?? null };
        return resolveEntryService(entry, env.services).service?.id === p.service_id;
      });
      if (!opt) continue;
      const token = typeof opt === "string" ? opt : String(opt.value ?? opt.label ?? "");
      if (!token) continue;
      patch[f.field_key] = [...listOf(f.field_key), token];
      break;
    }
  }
  // Häkchen zurücknehmen: neu gesetzte Häkchen ohne Position und ohne bestehende Dienstleistung
  for (const t of ticks) {
    if (!t.serviceId || baselineKeys.has(keyOf(t))) continue;
    if (existingServiceIds.has(t.serviceId) || pendingServices.has(t.serviceId)) continue;
    patch[t.fieldKey] = listOf(t.fieldKey).filter((raw) => normalizeToken(rawToken(raw)) !== normalizeToken(t.token));
  }
  return patch;
}
