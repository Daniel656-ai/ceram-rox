import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskOrderIdentity } from "@/components/orders/TaskOrderIdentity";

describe("TaskOrderIdentity", () => {
  it("Pilot Plant mit Spalten-Versuchsnummer: fett + Auftrag darunter", () => {
    render(<TaskOrderIdentity order={{ order_kind: "pilot_plant", order_number: "SW-260025", pp_experiment_number: "V26-027_CC" }} />);
    expect(screen.getByTestId("experiment-number").textContent).toBe("V26-027_CC");
    expect(screen.getByText("Auftrag: SW-260025")).toBeTruthy();
  });
  it("Historischer Pilot-Plant-Auftrag (Legacy-Pfad)", () => {
    render(<TaskOrderIdentity order={{ order_kind: "pilot_plant", order_number: "SW-1", shared_form_data: { pp: { stammdaten: { versuchsnummer: "V25-001" } } } }} />);
    expect(screen.getByTestId("experiment-number").textContent).toBe("V25-001");
  });
  it("Pilot Plant ohne Versuchsnummer: Hinweis", () => {
    render(<TaskOrderIdentity order={{ order_kind: "pilot_plant", order_number: "SW-2" }} />);
    expect(screen.getByText("Keine Versuchsnummer")).toBeTruthy();
    expect(screen.getByText("Auftrag: SW-2")).toBeTruthy();
  });
  it("Laborauftrag: nur Auftragsnummer, kein Versuchsnummernfeld", () => {
    const { container } = render(<TaskOrderIdentity order={{ order_kind: "labor", order_number: "FG-1", pp_experiment_number: "X" }} />);
    expect(container.textContent).toBe("FG-1");
  });
});
