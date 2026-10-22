// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { printHtml } from "./printHtml";

const frames = () => document.querySelectorAll("iframe[data-print-frame]");

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ""; });

describe("printHtml", () => {
  it("schreibt HTML ins Iframe und ruft print() des Iframes auf", async () => {
    const spy = vi.fn();
    const orig = HTMLIFrameElement.prototype.focus;
    const proto = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "contentWindow")!;
    vi.spyOn(HTMLIFrameElement.prototype, "contentWindow", "get").mockImplementation(function (this: HTMLIFrameElement) {
      const w = proto.get!.call(this) as Window;
      (w as any).print = spy;
      return w;
    });
    await printHtml("<html><body><svg id='dmc'></svg></body></html>", { settleMs: 0 });
    expect(spy).toHaveBeenCalledTimes(1);
    const f = frames()[0] as HTMLIFrameElement;
    expect(f.contentDocument!.getElementById("dmc")).not.toBeNull();
    void orig;
  });

  it("entfernt das Iframe nach afterprint", async () => {
    await printHtml("<p>x</p>", { settleMs: 0 });
    const f = frames()[0] as HTMLIFrameElement;
    f.contentWindow!.dispatchEvent(new Event("afterprint"));
    await new Promise((r) => setTimeout(r, 5));
    expect(frames().length).toBe(0);
  });

  it("entfernt das Iframe per Sicherheitsfrist, falls afterprint ausbleibt", async () => {
    await printHtml("<p>x</p>", { settleMs: 0, cleanupTimeoutMs: 10 });
    await new Promise((r) => setTimeout(r, 30));
    expect(frames().length).toBe(0);
  });

  it("meldet Fehler beim Druck und räumt auf", async () => {
    const proto = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "contentWindow")!;
    vi.spyOn(HTMLIFrameElement.prototype, "contentWindow", "get").mockImplementation(function (this: HTMLIFrameElement) {
      const w = proto.get!.call(this) as Window;
      (w as any).print = () => { throw new Error("denied"); };
      return w;
    });
    await expect(printHtml("<p>x</p>", { settleMs: 0 })).rejects.toThrow("denied");
    expect(frames().length).toBe(0);
  });
});
