import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOrderDraftAutosave } from "@/hooks/useOrderDraftAutosave";
const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { orderDrafts: mocks } }));
const args = { enabled: true, userId: "u", draftId: null, onDraftCreated: vi.fn(), payload: { notes: "a" }, title: "Draft", hasContent: true };
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); mocks.create.mockResolvedValue({ id: "d" }); mocks.update.mockResolvedValue(undefined); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("single draft writer", () => {
  it("does not write restored data while metadata is delayed or after it is ready", async () => {
    const loaded = { ...args, enabled: false, draftId: "d", restoredPayload: args.payload };
    const h = renderHook(p => useOrderDraftAutosave(p), { initialProps: loaded });
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(mocks.update).not.toHaveBeenCalled();
    h.rerender({ ...loaded, enabled: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("creates once, announces URL id once, and drains edits during the request before close resolves", async () => {
    let resolve: (v: {id: string}) => void = () => {};
    mocks.create.mockImplementation(() => new Promise(r => { resolve = r; }));
    const h = renderHook(p => useOrderDraftAutosave(p), { initialProps: args });
    let first: Promise<string | null> = Promise.resolve(null);
    let second: Promise<string | null> = Promise.resolve(null);
    act(() => { first = h.result.current.saveNow(); second = h.result.current.saveNow(); });
    expect(first).toBe(second);
    h.rerender({ ...args, payload: { notes: "newest" } });
    await act(async () => { resolve({ id: "d" }); await first; });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(args.onDraftCreated).toHaveBeenCalledExactlyOnceWith("d");
    expect(mocks.update).toHaveBeenCalledWith("d", expect.objectContaining({ payload: { notes: "newest" } }));
    expect(await second).toBe("d");
    expect(h.result.current.state).toBe("saved");
  });
  it("returns no confirmed id on failure and allows retry", async () => {
    mocks.create.mockRejectedValueOnce(new Error("offline"));
    const h = renderHook(() => useOrderDraftAutosave(args));
    await act(async () => { expect(await h.result.current.saveNow()).toBeNull(); });
    expect(h.result.current.state).toBe("error");
    await act(async () => { expect(await h.result.current.saveNow()).toBe("d"); });
  });
  it("warns before unload with unsaved changes", () => {
    renderHook(() => useOrderDraftAutosave(args));
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
  it("clearing all values in an existing draft persists the empty payload", async () => {
    const old = { ...args, draftId: "d", restoredPayload: args.payload };
    const h = renderHook(p => useOrderDraftAutosave(p), { initialProps: old });
    h.rerender({ ...old, hasContent: false, payload: { notes: "" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    expect(mocks.update).toHaveBeenCalledWith("d", expect.objectContaining({ payload: { notes: "" } }));
  });
  it("switching identity after a confirmed save never writes old data to the new draft", async () => {
    const old = { ...args, draftId: "d", restoredPayload: args.payload };
    const h = renderHook(p => useOrderDraftAutosave(p), { initialProps: old });
    h.rerender({ ...old, enabled: false });
    h.rerender({ ...old, draftId: "new", payload: { notes: "new draft" }, restoredPayload: { notes: "new draft" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(mocks.update).not.toHaveBeenCalled();
    h.rerender({ ...old, draftId: "new", payload: { notes: "edit new" }, restoredPayload: { notes: "new draft" } });
    await act(async () => { expect(await h.result.current.saveNow()).toBe("new"); });
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith("new", expect.objectContaining({ payload: { notes: "edit new" } }));
  });
});
