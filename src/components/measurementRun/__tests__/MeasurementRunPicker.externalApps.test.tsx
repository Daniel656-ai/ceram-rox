import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MeasurementRunPicker from "@/components/measurementRun/MeasurementRunPicker";

const state = vi.hoisted(() => ({
  role: "durchfuehrer" as string,
  qualified: ["svc-extrusion"] as string[],
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" }, role: state.role }),
}));
vi.mock("@/hooks/useMeasurements", () => ({
  useQualifiedServiceIds: () => ({ data: state.qualified }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "de" } }),
}));

const openSpy = vi.fn();

function extrusionTask(id: string, sample: string) {
  return {
    id,
    service_id: "svc-extrusion",
    status: "open",
    measurement_number: `M-${id}`,
    samples: { sample_number: sample, sample_name: `Probe ${sample}` },
    measurement_services: { service_name: "Extrusion" },
    measurement_orders: { order_number: "ABC260001" },
  };
}

function renderPicker(tasks: any[]) {
  return render(
    <MemoryRouter>
      <MeasurementRunPicker tasks={tasks} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  openSpy.mockReset();
  vi.stubGlobal("open", openSpy);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  state.role = "durchfuehrer";
  state.qualified = ["svc-extrusion"];
});

describe("MeasurementRunPicker externe Apps", () => {
  it("zeigt den Button in der Leistungszeile für Qualifizierte und öffnet die Startseite", () => {
    renderPicker([extrusionTask("m1", "P260001")]);
    const btn = screen.getByRole("button", { name: /In Extruder-App öffnen/ });
    fireEvent.click(btn);
    expect(openSpy).toHaveBeenCalledWith("http://172.30.100.162:8080/", "_blank", "noopener");
  });

  it("zeigt den Button für Master auch ohne Qualifikationseintrag", () => {
    state.role = "master";
    state.qualified = [];
    renderPicker([extrusionTask("m1", "P260001")]);
    expect(screen.getByRole("button", { name: /In Extruder-App öffnen/ })).toBeInTheDocument();
  });

  it("zeigt den Button nicht für nicht qualifizierte Nutzer", () => {
    state.qualified = [];
    renderPicker([extrusionTask("m1", "P260001")]);
    expect(screen.queryByRole("button", { name: /In Extruder-App öffnen/ })).not.toBeInTheDocument();
  });

  it("zeigt keinen Button bei nicht konfigurierten Leistungen", () => {
    const task = { ...extrusionTask("m1", "P260001"), service_id: "svc-rfa", measurement_services: { service_name: "RFA" } };
    renderPicker([task]);
    expect(screen.queryByRole("button", { name: /App öffnen/ })).not.toBeInTheDocument();
  });

  it("Klick auf den Button klappt die Zeile nicht auf und wählt nichts aus", () => {
    renderPicker([extrusionTask("m1", "P260001")]);
    // Gruppe ist zu Beginn eingeklappt: keine Probenzeile sichtbar.
    expect(screen.queryByText("P260001")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /In Extruder-App öffnen/ }));
    // Weiterhin eingeklappt und keine Auswahl ausgelöst.
    expect(screen.queryByText("P260001")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Messdurchlauf starten/ })).toBeDisabled();
    expect(openSpy).toHaveBeenCalledTimes(1);
  });
});
