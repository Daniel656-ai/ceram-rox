import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { buildSampleDetailSections } from "@/lib/samples/sampleDetailRows";

const t = (k: string) => `T:${k}`;
const rows = (s: any) => Object.fromEntries(buildSampleDetailSections(s, t).flatMap((x) => x.rows).map((r) => [r.key, r.value]));

describe("buildSampleDetailSections", () => {
  it("empty values stay null, never 0", () => {
    const r = rows({ sample_number: "P260001", operating_hours: null, v2o5_content: null, lot_number: "  ", tags: [] });
    expect(r.operating_hours).toBeNull();
    expect(r.v2o5_content).toBeNull();
    expect(r.lot_number).toBeNull();
    expect(r.tags).toBeNull();
    expect(r.is_used_catalyst).toBeNull();
  });
  it("real zero stays 0, numbers formatted, selections readable", () => {
    const r = rows({ operating_hours: 0, v2o5_content: 1.5, category: "heat_media", is_used_catalyst: false,
      projects: { project_number: "PR-1", project_name: "Kat" }, storage_locations: { hall: "H1", room: "R2" }, hazard_categories: ["toxisch"] });
    expect(r.operating_hours).toBe("0");
    expect(r.v2o5_content).toBe("1,50 %");
    expect(r.category).toBe("T:category_heat_media");
    expect(r.is_used_catalyst).toBe("T:hazard_no");
    expect(r.project).toBe("PR-1 – Kat");
    expect(r.location).toBe("H1 › R2");
    expect(r.hazard_categories).toBe("T:hazard_toxisch");
  });
});

const samples: Record<string, any> = {
  a: { id: "a", sample_number: "P260001", sample_name: "Alpha", lot_number: "L-A", operating_hours: null },
  b: { id: "b", sample_number: "P260002", sample_name: "Beta", lot_number: "L-B", operating_hours: 120 },
};
vi.mock("@/hooks/useSamples", async () => {
  const { useQuery } = await import("@tanstack/react-query");
  return { useSampleDetail: (id?: string) => useQuery({ queryKey: ["sample", id], queryFn: async () => samples[id!], enabled: !!id }) };
});
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string, o?: any) => o?.defaultValue ?? k }) }));

import SampleDetailsDialog from "@/components/samples/SampleDetailsDialog";

function Harness() {
  const [id, setId] = useState<string | null>(null);
  const [selection] = useState(["a", "b"]);
  return <QueryClientProvider client={new QueryClient()}>
    {selection.map((s) => <button key={s} onClick={() => setId(s)}>open-{s}</button>)}
    <output data-testid="sel">{selection.join(",")}</output>
    <SampleDetailsDialog sampleId={id} onClose={() => setId(null)} />
  </QueryClientProvider>;
}
afterEach(cleanup);

describe("SampleDetailsDialog", () => {
  it("opens, shows the right sample, switches without mixing, closes; selection untouched", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("open-a"));
    await waitFor(() => expect(screen.getByText("P260001 – Alpha")).toBeTruthy());
    expect(screen.getByText("L-A")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.getAllByText("Nicht angegeben").length).toBeGreaterThan(0);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByText("P260001 – Alpha")).toBeNull());
    fireEvent.click(screen.getByText("open-b"));
    await waitFor(() => expect(screen.getByText("P260002 – Beta")).toBeTruthy());
    expect(screen.getByText("L-B")).toBeTruthy();
    expect(screen.queryByText("L-A")).toBeNull();
    expect(screen.getByText("120")).toBeTruthy();
    expect(screen.getByTestId("sel").textContent).toBe("a,b");
  });
});
