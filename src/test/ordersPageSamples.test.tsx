import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import OrdersPage from "@/pages/OrdersPage";

const state = vi.hoisted(() => ({
  role: "master",
  rows: [
    { id: "o2", order_number: "ABC260002", order_kind: "labor", order_type: "rnd", status: "open", created_at: "2026-01-02", sample_id: "s2", current_sample: { id: "s2", sample_name: "B", sample_number: "P260002" }, projects: { project_number: "PR2", project_name: "Second" } },
    { id: "o1", order_number: "ABC260001", order_kind: "pilot_plant", pp_experiment_number: "TE123", order_type: "rnd", status: "completed", created_at: "2026-01-01", sample_id: "s1", current_sample: { id: "s1", sample_name: "A", sample_number: "P260001" }, projects: { project_number: "PR1", project_name: "First" } },
  ],
}));
vi.mock("@/hooks/useOrders", () => ({
  useOrders: () => ({ data: state.rows, isLoading: false }),
  useDeleteOrder: () => ({ mutateAsync: vi.fn() }),
  useCopyOrder: () => ({ mutateAsync: vi.fn() }),
  useUpdateOrderRanking: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/useMeasurements", () => ({
  useMyMeasurements: () => ({ data: [] }),
  useUnassignedQualifiedMeasurements: () => ({ data: [] }),
  useOpenMeasurementsOverview: () => ({ data: [] }),
  useClaimMeasurement: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "user" }, role: state.role, hasRole: (role: string) => state.role === role }) }));
vi.mock("@/hooks/useProjectMembers", () => ({ useIsAnyProjectLead: () => ({ data: false }) }));
vi.mock("@/components/measurementRun/MeasurementRunPicker", () => ({ default: () => null }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "de" } }) }));

function open() {
  render(<MemoryRouter initialEntries={["/auftraege"]}><Routes>
    <Route path="/auftraege" element={<OrdersPage />} />
    <Route path="/proben/:id" element={<div data-testid="sample-target" />} />
    <Route path="/auftraege/:id" element={<div data-testid="order-target" />} />
  </Routes></MemoryRouter>);
}
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); state.role = "master"; sessionStorage.clear(); vi.unstubAllGlobals(); });

describe("order overview regression with readable sample links", () => {
  it("keeps existing search fields and does not silently add sample-name search", () => {
    open();
    const input = screen.getByPlaceholderText("orders:search_placeholder");
    fireEvent.change(input, { target: { value: "TE123" } });
    expect(screen.getAllByRole("link").filter(link => link.getAttribute("href")?.startsWith("/proben/"))).toHaveLength(1);
    fireEvent.change(input, { target: { value: "ABC260001" } });
    expect(screen.getAllByRole("link").filter(link => link.getAttribute("href")?.startsWith("/proben/"))).toHaveLength(1);
    fireEvent.change(input, { target: { value: "P260002" } });
    expect(screen.queryByRole("link", { name: "B" })).toBeNull();
    fireEvent.change(input, { target: { value: "Second" } });
    expect(screen.getByRole("link", { name: "B" }).getAttribute("href")).toBe("/proben/s2");
  });
  it("keeps number sorting and existing order detail navigation", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "orders:order_number" }));
    const body = screen.getAllByRole("rowgroup")[1];
    const rows = within(body).getAllByRole("row");
    expect(within(rows[0]).getByRole("link", { name: "ABC260002" }).getAttribute("href")).toBe("/auftraege/o2");
    expect(within(rows[1]).getByRole("link", { name: "TE123" }).getAttribute("href")).toBe("/auftraege/o1");
    fireEvent.click(within(rows[0]).getByRole("link", { name: "ABC260002" }));
    expect(screen.getByTestId("order-target")).toBeTruthy();
  });
  it("navigates a readable sample link to the existing sample route", () => {
    open();
    fireEvent.click(screen.getByRole("link", { name: "B" }));
    expect(screen.getByTestId("sample-target")).toBeTruthy();
  });
  it("preserves requester access to the list and existing creation action", () => {
    state.role = "auftraggeber";
    open();
    expect(screen.getByRole("link", { name: "B" }).getAttribute("href")).toBe("/proben/s2");
    expect(screen.getByRole("link", { name: "orders:new_order" }).getAttribute("href")).toBe("/auftraege/neu");
  });
  it("leaves the provider-only task view separate from the requester list", () => {
    state.role = "durchfuehrer";
    open();
    expect(screen.queryByRole("link", { name: "B" })).toBeNull();
    expect(screen.queryByRole("link", { name: "orders:new_order" })).toBeNull();
  });
});