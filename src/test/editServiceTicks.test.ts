import { describe, it, expect } from "vitest";
import {
  lockedTickGroups,
  planTickChange,
  readTicks,
  syncTicksToPending,
  syncTicksToRemoval,
  tickDelta,
} from "@/lib/orders/editServiceTicks";
import { planServiceSync, resolveEntryService } from "@/lib/orderServiceSelection";

const services = [
  { id: "svc-rfa", service_name: "RFA" },
  { id: "svc-bet", service_name: "BET" },
  { id: "svc-dsc", service_name: "DSC" },
  { id: "svc-name", service_name: "Dichte" },
];
const fields = [
  {
    field_key: "dienstleistungen", display_name: "Dienstleistungen", field_type: "multiselect",
    select_options: [
      { value: "rfa", label: "RFA", service_id: "svc-rfa" },
      { value: "bet", label: "BET", service_id: "svc-bet" },
      { value: "bet2", label: "BET (Variante)", service_id: "svc-bet" },
    ],
  },
  {
    field_key: "standardpruefungen", display_name: "Standardprüfungen", field_type: "multiselect",
    select_options: [{ value: "dsc", label: "DSC", service_id: "svc-dsc" }, { value: "Dichte", label: "Dichte" }],
  },
  { field_key: "bemerkung", display_name: "Bemerkung", field_type: "text" },
];
const env = { fields, services };

describe("Häkchen -> Dienstleistung (gemeinsame Auflösung mit dem Erstellen)", () => {
  it("löst über service_id, sonst über den Namen auf; ungültige service_id gibt keinen Namens-Rückfall", () => {
    expect(resolveEntryService({ token: "x", aliases: [], service_id: "svc-rfa" }, services).service?.id).toBe("svc-rfa");
    expect(resolveEntryService({ token: "Dichte", aliases: [] }, services).service?.id).toBe("svc-name");
    expect(resolveEntryService({ token: "dichte ", aliases: [] }, services).service?.id).toBe("svc-name");
    const bad = resolveEntryService({ token: "RFA", aliases: [], service_id: "weg" }, services);
    expect(bad.service).toBeUndefined();
    expect(bad.invalidRef).toBe(true);
  });

  it("planServiceSync (Erstellen) verhält sich unverändert", () => {
    const plan = planServiceSync({
      selection: [{ token: "rfa", aliases: ["RFA"], service_id: "svc-rfa" }, { token: "kaputt", aliases: [], service_id: "weg" }, { token: "nix", aliases: [] }],
      services, measurements: [],
    });
    expect(plan.add.map((a) => a.service.id)).toEqual(["svc-rfa"]);
    expect(plan.unresolved).toEqual(["kaputt (zugeordnete Dienstleistung nicht verfügbar)", "nix"]);
  });

  it("liest die gesetzten Häkchen aller Dienstleistungs-Felder mit Dienstleistung", () => {
    const ticks = readTicks({ dienstleistungen: ["rfa", "bet2"], standardpruefungen: ["dsc"], bemerkung: "egal" }, env);
    expect(ticks.map((t) => `${t.fieldKey}:${t.token}:${t.serviceId}`)).toEqual([
      "dienstleistungen:rfa:svc-rfa", "dienstleistungen:bet2:svc-bet", "standardpruefungen:dsc:svc-dsc",
    ]);
  });
});

describe("Sperre pro Gruppe", () => {
  const baseline = { dienstleistungen: ["rfa", "bet"], standardpruefungen: ["dsc"] };
  it("Gruppe ist gesperrt, sobald eine Dienstleistung eines gesetzten Häkchens nicht entfernbar ist", () => {
    expect(lockedTickGroups(baseline, env, new Set(["svc-bet"]))).toEqual(["dienstleistungen"]);
    expect(lockedTickGroups(baseline, env, new Set(["svc-dsc"]))).toEqual(["standardpruefungen"]);
    expect(lockedTickGroups(baseline, env, new Set())).toEqual([]);
  });
  it("nicht gesetzte Häkchen sperren nichts", () => {
    expect(lockedTickGroups({ dienstleistungen: ["rfa"] }, env, new Set(["svc-bet"]))).toEqual([]);
  });
});

describe("Änderung der Häkchen", () => {
  const prev = { dienstleistungen: ["rfa"], standardpruefungen: [] as string[] };
  const common = { env, existingServiceIds: new Set(["svc-rfa"]), removedServiceIds: [] as string[], pending: [] };

  it("Delta: gesetzt/entfernt", () => {
    const d = tickDelta(prev, { dienstleistungen: ["bet"], standardpruefungen: [] }, env);
    expect(d.ticked.map((t) => t.token)).toEqual(["bet"]);
    expect(d.unticked.map((t) => t.token)).toEqual(["rfa"]);
  });

  it("Häkchen setzen -> neue Dienstleistung", () => {
    const plan = planTickChange({ ...common, prev, next: { dienstleistungen: ["rfa", "bet"] } });
    expect(plan.add.map((a) => a.service.id)).toEqual(["svc-bet"]);
    expect(plan.removeServiceIds).toEqual([]);
  });

  it("Häkchen entfernen (bestehende Dienstleistung) -> zum Entfernen vormerken", () => {
    const plan = planTickChange({ ...common, prev, next: { dienstleistungen: [] } });
    expect(plan.removeServiceIds).toEqual(["svc-rfa"]);
  });

  it("Entfernen verhindert nicht, wenn ein anderes Häkchen noch auf dieselbe Dienstleistung zeigt", () => {
    const two = { dienstleistungen: ["bet", "bet2"] };
    const c = { ...common, existingServiceIds: new Set(["svc-bet"]) };
    expect(planTickChange({ ...c, prev: two, next: { dienstleistungen: ["bet2"] } }).removeServiceIds).toEqual([]);
    expect(planTickChange({ ...c, prev: { dienstleistungen: ["bet2"] }, next: { dienstleistungen: [] } }).removeServiceIds).toEqual(["svc-bet"]);
  });

  it("keine Doppelbuchung: Häkchen für vorhandene oder schon vorgemerkte Dienstleistung fügt nichts hinzu", () => {
    expect(planTickChange({ ...common, prev: { dienstleistungen: [] }, next: { dienstleistungen: ["rfa"] } }).add).toEqual([]);
    const pending = [{ uid: "u1", service_id: "svc-bet", origin: "manual" }];
    expect(planTickChange({ ...common, pending, prev, next: { dienstleistungen: ["rfa", "bet"] } }).add).toEqual([]);
  });

  it("Häkchen wieder setzen hebt das vorgemerkte Entfernen auf", () => {
    const plan = planTickChange({
      ...common, removedServiceIds: ["svc-rfa"], prev: { dienstleistungen: [] }, next: { dienstleistungen: ["rfa"] },
    });
    expect(plan.unremoveServiceIds).toEqual(["svc-rfa"]);
    expect(plan.add).toEqual([]);
  });

  it("Häkchen einer neuen (noch nicht gespeicherten) Position wieder entfernen -> Position fällt weg", () => {
    const plan = planTickChange({
      ...common, prev: { dienstleistungen: ["rfa", "bet"] }, next: { dienstleistungen: ["rfa"] },
      pending: [{ uid: "u1", service_id: "svc-bet", origin: "template", selection_token: "bet" }],
    });
    expect(plan.removePendingTokens).toEqual(["bet"]);
    expect(plan.removeServiceIds).toEqual([]);
  });

  it("Auswahlwert ohne passende Dienstleistung: keine Wirkung", () => {
    const plan = planTickChange({ ...common, prev, next: { dienstleistungen: ["rfa", "unbekannt"] } });
    expect(plan.add).toEqual([]);
  });
});

describe("Gleichlauf Liste -> Häkchen", () => {
  const baseline = { dienstleistungen: ["rfa", "bet"], standardpruefungen: ["dsc"] };
  it("Entfernen über die Liste nimmt alle Häkchen der Dienstleistung heraus", () => {
    const patch = syncTicksToRemoval({ values: baseline, baseline, env, prevRemoved: [], nextRemoved: ["svc-bet"] });
    expect(patch).toEqual({ dienstleistungen: ["rfa"] });
  });
  it("Rückgängig bringt das gespeicherte Häkchen zurück – aber nicht ein von Hand entferntes anderes", () => {
    const current = { dienstleistungen: ["rfa"], standardpruefungen: [] as string[] };
    const patch = syncTicksToRemoval({ values: current, baseline, env, prevRemoved: ["svc-bet"], nextRemoved: [] });
    expect(patch).toEqual({ dienstleistungen: ["rfa", "bet"] });
  });
  it("ohne Änderung kein Patch", () => {
    expect(syncTicksToRemoval({ values: baseline, baseline, env, prevRemoved: [], nextRemoved: [] })).toEqual({});
  });
});

describe("Gleichlauf Karte -> Häkchen", () => {
  const baseline = { dienstleistungen: ["rfa"], standardpruefungen: [] as string[] };
  it("über die Karte hinzugefügte Dienstleistung setzt das passende Häkchen", () => {
    const patch = syncTicksToPending({
      values: baseline, baseline, env, existingServiceIds: new Set(["svc-rfa"]),
      pending: [{ uid: "u1", service_id: "svc-dsc", origin: "manual" }],
    });
    expect(patch).toEqual({ standardpruefungen: ["dsc"] });
  });
  it("Dienstleistung ohne passendes Häkchen: kein Eingriff", () => {
    expect(syncTicksToPending({
      values: baseline, baseline, env, existingServiceIds: new Set(["svc-rfa"]),
      pending: [{ uid: "u1", service_id: "svc-unbekannt", origin: "manual" }],
    })).toEqual({});
  });
  it("neu gesetztes Häkchen ohne Position verschwindet wieder; gespeicherte Häkchen bleiben", () => {
    const values = { dienstleistungen: ["rfa", "bet"], standardpruefungen: [] as string[] };
    const patch = syncTicksToPending({ values, baseline, env, existingServiceIds: new Set(["svc-rfa"]), pending: [] });
    expect(patch).toEqual({ dienstleistungen: ["rfa"] });
  });
  it("Häkchen mit vorgemerkter Position bleibt; bereits getickte Dienstleistung wird nicht doppelt gesetzt", () => {
    const values = { dienstleistungen: ["rfa", "bet"], standardpruefungen: [] as string[] };
    const pending = [{ uid: "u1", service_id: "svc-bet", origin: "template", selection_token: "bet" }];
    expect(syncTicksToPending({ values, baseline, env, existingServiceIds: new Set(["svc-rfa"]), pending })).toEqual({});
    const manual = [{ uid: "u2", service_id: "svc-bet", origin: "manual" }];
    expect(syncTicksToPending({ values, baseline, env, existingServiceIds: new Set(["svc-rfa"]), pending: manual })).toEqual({});
  });
});
