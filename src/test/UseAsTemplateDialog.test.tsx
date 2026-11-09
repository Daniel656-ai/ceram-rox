import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import UseAsTemplateDialog from "@/components/orders/UseAsTemplateDialog";

const mocks = vi.hoisted(() => ({ create: vi.fn(), build: vi.fn(), navigate: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { orderDrafts: { create: mocks.create } } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "user" } }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.error } }));
vi.mock("@/lib/orderTemplateCopy", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/orderTemplateCopy")>(), buildPayloadFromOrder: mocks.build,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.build.mockResolvedValue({ payload: { measurements: [], measurementFormValues: {} }, label: "Auftrag Quelle", warnings: [
    { serviceId: "s", serviceName: "Gas", measurementId: "m", parameterName: "NO", formIds: ["A", "B"] },
  ] });
  mocks.create.mockResolvedValue({ id: "new-draft" });
});
afterEach(cleanup);
const open = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <UseAsTemplateDialog open onOpenChange={vi.fn()} sourceOrderId="source" />
</QueryClientProvider>);

describe("partial template copy acknowledgement", () => {
  it("creates once, keeps warning acknowledgement before navigation and never persists warning metadata", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Entwurf erstellen" }));
    const acknowledge = await screen.findByRole("button", { name: "Entwurf prüfen" });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0][0].payload).toEqual({ measurements: [], measurementFormValues: {} });
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty("warnings");
    expect(mocks.navigate).not.toHaveBeenCalled();
    fireEvent.click(acknowledge);
    expect(mocks.navigate).toHaveBeenCalledWith("/auftraege/neu?draft=new-draft");
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("a complete copy still opens its draft immediately", async () => {
    mocks.build.mockResolvedValue({ payload: { measurements: [] }, label: "Quelle", warnings: [] });
    open();
    fireEvent.click(screen.getByRole("button", { name: "Entwurf erstellen" }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/auftraege/neu?draft=new-draft"));
  });
  it("a failed draft save never reports completion or navigates", async () => {
    mocks.create.mockRejectedValue(new Error("save failed"));
    open();
    fireEvent.click(screen.getByRole("button", { name: "Entwurf erstellen" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
});