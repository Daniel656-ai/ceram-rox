import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";

const exportOrder = vi.fn();
vi.mock("@/hooks/useOrderExcelExport", () => ({
  useOrderExcelExport: () => ({ exportOrder, exporting: false }),
}));

import OrderExcelExportButton from "@/components/order/OrderExcelExportButton";
import OrderComparisonView from "@/components/results/OrderComparisonView";
import type { OrderGroup } from "@/lib/results/orderGroups";

(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

describe("Knopf „Auftrag als Excel exportieren“", () => {
  it("startet den Export für genau diesen Auftrag", () => {
    exportOrder.mockClear();
    render(<OrderExcelExportButton orderId="order-42" label="Auftrag als Excel exportieren" />);
    fireEvent.click(screen.getByRole("button", { name: "Auftrag als Excel exportieren" }));
    expect(exportOrder).toHaveBeenCalledWith("order-42");
  });

  it("ohne Auftrags-ID ist der Knopf deaktiviert", () => {
    render(<OrderExcelExportButton orderId="" />);
    expect((screen.getByRole("button", { name: "Als Excel exportieren" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("steht in der Ergebnisübersicht des Auftrags (Seitenleiste)", () => {
    exportOrder.mockClear();
    const order = {
      orderKey: "k", orderId: "order-7", displayNumber: "MWI260003", projectNames: [], samples: [],
      measurementCount: 0, officialCount: 0, interimCount: 0, lastActivityAt: null,
    } as unknown as OrderGroup;
    render(
      <TooltipProvider>
        <OrderComparisonView order={order} onClose={() => {}} onSelectSample={() => {}} />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Excel" }));
    expect(exportOrder).toHaveBeenCalledWith("order-7");
  });
});
