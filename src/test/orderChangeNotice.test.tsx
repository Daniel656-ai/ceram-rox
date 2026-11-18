import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const apiMock = vi.hoisted(() => ({ activityLog: { listForOrder: vi.fn() } }));
vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("@/hooks/useUsers", () => ({ useUsers: () => ({ data: [{ user_id: "u1", first_name: "Anna", last_name: "Meier" }] }) }));

import OrderChangeNotice, { isRelevantOrderUpdate } from "@/components/order/OrderChangeNotice";

const ev = (id: string, fields: string[], extra: Record<string, unknown> = {}) => ({
  id, event_type: "order_updated", actor_user_id: "u1", created_at: "2026-11-18T10:00:00Z", metadata: { fields, ...extra },
});
const mount = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><OrderChangeNotice orderId="o1" /></QueryClientProvider>);
};
beforeEach(() => vi.clearAllMocks());

describe("Relevanz einer Auftragsänderung für Messdienstleister", () => {
  it("Proben, Auftragsformular, Fälligkeit, Priorität, Dienstleistungen zählen – Anmerkungen, Typ, Projekt nicht", () => {
    for (const f of ["samples_added", "samples_removed", "template", "due_date", "priority", "services_added", "services_removed"]) {
      expect(isRelevantOrderUpdate(ev("x", [f]))).toBe(true);
    }
    for (const f of ["notes", "order_type", "project_id"]) expect(isRelevantOrderUpdate(ev("x", [f]))).toBe(false);
    expect(isRelevantOrderUpdate(ev("x", ["notes", "priority"]))).toBe(true);
    expect(isRelevantOrderUpdate({ event_type: "order_spec_updated", metadata: { fields: ["priority"] } })).toBe(false);
    expect(isRelevantOrderUpdate({ event_type: "order_updated", metadata: null })).toBe(false);
  });
});

describe("Hinweisleiste in der Messaufgabe", () => {
  it("zeigt relevante Änderungen mit Person und Inhalt", async () => {
    apiMock.activityLog.listForOrder.mockResolvedValue([ev("a", ["due_date", "samples_added"], { samples_added: ["P7"] })]);
    mount();
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(screen.getByText(/Anna Meier/)).toBeTruthy();
    expect(screen.getByText(/Fälligkeit, Proben \(\+P7\)/)).toBeTruthy();
  });

  it("zeigt nichts bei irrelevanten Änderungen oder ohne Ereignisse; höchstens drei Einträge", async () => {
    apiMock.activityLog.listForOrder.mockResolvedValue([ev("a", ["notes"])]);
    const first = mount();
    await waitFor(() => expect(apiMock.activityLog.listForOrder).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
    first.unmount();
    apiMock.activityLog.listForOrder.mockResolvedValue([1, 2, 3, 4, 5].map((i) => ev(`e${i}`, ["priority"])));
    mount();
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
