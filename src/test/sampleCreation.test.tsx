import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import SamplesPage from "@/pages/SamplesPage";

const mocks = vi.hoisted(() => ({ create: vi.fn(), error: vi.fn() }));
vi.mock("@/hooks/useSamples", () => ({
  useSamples: () => ({ data: [], isLoading: false }),
  useCreateSample: () => ({ mutateAsync: mocks.create, isPending: false }),
  useDeleteSample: () => ({ mutateAsync: vi.fn() }),
  useSampleOrderLinks: () => ({ data: new Map() }),
}));
vi.mock("@/hooks/useProjects", () => ({ useProjects: () => ({ data: [{ id: "project", project_number: "PR1" }] }) }));
vi.mock("@/hooks/useRawMaterials", () => ({ useStorageLocations: () => ({ data: [] }) }));
vi.mock("@/hooks/useEstimatedCompletion", () => ({ useEstimatedCompletion: () => new Map() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "user" }, role: "master" }) }));
vi.mock("@/lib/api", () => ({ api: { samples: { listMeasurementTypes: async () => [] } } }));
vi.mock("@/components/SampleParametersFields", () => ({ SampleParametersFields: () => null }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "de" } }) }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks(); mocks.create.mockResolvedValue({ id: "new-sample" });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function openForm(options: { name?: boolean; project?: boolean; action?: boolean; description?: string } = {}) {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><TooltipProvider><MemoryRouter><SamplesPage /></MemoryRouter></TooltipProvider></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "new_sample" }));
  const dialog = screen.getByRole("dialog");
  if (options.name !== false) fireEvent.change(within(dialog).getAllByRole("textbox")[0], { target: { value: "Probe A" } });
  if (options.description !== undefined) fireEvent.change(within(dialog).getByPlaceholderText("description_placeholder"), { target: { value: options.description } });
  if (options.project !== false) {
    fireEvent.click(within(dialog).getAllByRole("combobox")[0]);
    fireEvent.click(await screen.findByRole("option", { name: "PR1" }));
  }
  if (options.action !== false) {
    fireEvent.click(within(dialog).getAllByRole("combobox")[1]);
    fireEvent.click(await screen.findByRole("option", { name: "post_zurueck" }));
  }
  fireEvent.click(within(dialog).getByRole("button", { name: "create_sample" }));
}

describe("single sample creation requirements", () => {
  it("creates a sample with its description", async () => {
    await openForm({ description: "Beschreibung" });
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ description: "Beschreibung", sample_name: "Probe A", project_id: "project" })));
  });
  it("creates a sample without a description", async () => {
    await openForm();
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ description: "", sample_name: "Probe A", project_id: "project" })));
  });
  it.each(["name", "project", "action"] as const)("still rejects missing %s", async (field) => {
    await openForm({ [field]: false, description: "Beschreibung" });
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.error).toHaveBeenCalled();
  });
});