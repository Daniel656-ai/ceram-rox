import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Aufgabe 018: Der Reiter „Pilot Plant“ (alte Bausteine) erscheint nur noch, wenn der Auftrag Bausteine
 * mit ausgefüllten Daten hat.
 */
const apiMock = vi.hoisted(() => ({ pilotPlantBlocks: { listForOrder: vi.fn() } }));
vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => (k === "orders:tabs.pilot_plant" ? "Pilot Plant" : k) }) }));
vi.mock("@/components/pilotplant/PilotPlantProcessPanel", () => ({ PilotPlantProcessPanel: () => <div>ALTE-BAUSTEINE</div> }));
vi.mock("@/components/order/OrderSamplesTab", () => ({ default: () => null }));
vi.mock("@/components/order/OrderWorkflowTab", () => ({ default: () => null }));
vi.mock("@/components/order/OrderClosureTab", () => ({ default: () => null }));
vi.mock("@/components/order/OrderRawDataTab", () => ({ default: () => null }));
vi.mock("@/components/order/OrderPreparationTab", () => ({ default: () => null }));

import { OrderWorkflowTabs } from "@/components/OrderWorkflowTabs";

const mount = (order: any) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <OrderWorkflowTabs order={order} />
    </QueryClientProvider>,
  );
};
const block = (over: any) => ({ id: "b", block_key: "stammdaten", status: "pending", data: {}, ...over });

beforeEach(() => apiMock.pilotPlantBlocks.listForOrder.mockReset());

describe("Reiter „Pilot Plant“ (alte Bausteine)", () => {
  it("Pilot-Plant-Auftrag mit leeren Bausteinen: kein Reiter", async () => {
    apiMock.pilotPlantBlocks.listForOrder.mockResolvedValue([block({}), block({ id: "c", block_key: "rezeptur" })]);
    mount({ id: "o1", order_kind: "pilot_plant" });
    await waitFor(() => expect(apiMock.pilotPlantBlocks.listForOrder).toHaveBeenCalledWith("o1"));
    expect(screen.queryByRole("tab", { name: "Pilot Plant" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Workflow" })).toBeTruthy();
  });

  it("Baustein mit ausgefüllten Daten: Reiter wird gezeigt", async () => {
    apiMock.pilotPlantBlocks.listForOrder.mockResolvedValue([block({ data: { menge: 5 } })]);
    mount({ id: "o2", order_kind: "pilot_plant" });
    expect(await screen.findByRole("tab", { name: "Pilot Plant" })).toBeTruthy();
  });

  it("abgeschlossener Baustein: Reiter wird gezeigt", async () => {
    apiMock.pilotPlantBlocks.listForOrder.mockResolvedValue([block({ status: "completed" })]);
    mount({ id: "o3", order_kind: "pilot_plant" });
    expect(await screen.findByRole("tab", { name: "Pilot Plant" })).toBeTruthy();
  });

  it("Laborauftrag: kein Reiter und keine Abfrage der Bausteine", async () => {
    mount({ id: "o4", order_kind: "labor" });
    expect(screen.queryByRole("tab", { name: "Pilot Plant" })).toBeNull();
    expect(apiMock.pilotPlantBlocks.listForOrder).not.toHaveBeenCalled();
  });
});
