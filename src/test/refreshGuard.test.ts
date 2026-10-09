import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { refreshCurrentView, useRefreshGuard, UnsavedInputError, _guardCount } from "@/lib/refreshGuard";

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("refreshCurrentView", () => {
  it("lädt nur aktive Abfragen neu", async () => {
    const qc = client();
    const active = vi.fn().mockResolvedValue([1]);
    const inactive = vi.fn().mockResolvedValue([2]);
    const obs = new QueryObserver(qc, { queryKey: ["samples"], queryFn: active });
    const unsub = obs.subscribe(() => {});
    await qc.prefetchQuery({ queryKey: ["orders"], queryFn: inactive });
    await vi.waitFor(() => expect(active).toHaveBeenCalledTimes(1));
    inactive.mockClear();
    await refreshCurrentView(qc);
    expect(active).toHaveBeenCalledTimes(2);
    expect(inactive).not.toHaveBeenCalled();
    unsub();
  });

  it("meldet Ladefehler", async () => {
    const qc = client();
    const fn = vi.fn().mockResolvedValueOnce([1]).mockRejectedValue(new Error("net"));
    const obs = new QueryObserver(qc, { queryKey: ["x"], queryFn: fn });
    const unsub = obs.subscribe(() => {});
    await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
    await expect(refreshCurrentView(qc)).rejects.toThrow();
    unsub();
  });

  it("speichert vor dem Neuladen und bricht bei Speicherfehler ab", async () => {
    const qc = client();
    const refetch = vi.spyOn(qc, "refetchQueries");
    const ok = renderHook(() => useRefreshGuard(async () => {}));
    await refreshCurrentView(qc);
    expect(refetch).toHaveBeenCalledTimes(1);
    ok.unmount();

    const bad = renderHook(() => useRefreshGuard(async () => { throw new Error("save failed"); }));
    await expect(refreshCurrentView(qc)).rejects.toBeInstanceOf(UnsavedInputError);
    expect(refetch).toHaveBeenCalledTimes(1);
    bad.unmount();
    expect(_guardCount()).toBe(0);
  });

  it("löst keine Schreiboperationen aus", async () => {
    const qc = client();
    const mutate = vi.spyOn(qc.getMutationCache(), "build");
    await refreshCurrentView(qc);
    expect(mutate).not.toHaveBeenCalled();
  });
});
