import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { filterOptions, matchesPrefix, shouldShowSearch } from "@/lib/ui/optionFilter";
import { readFileSync } from "node:fs";
const css = readFileSync("src/index.css", "utf8");
(globalThis as any).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= function () {};

const labels = ["11.4", "11.5", "12.0", "007", "008", "070", "3001", "3002", "4300", "Abc", "abd"];
const opts = labels.map((l) => ({ value: `id-${l}`, label: l }));

describe("Live-Suche", () => {
  it("Präfixtreffer 11 / 00 / 300 als Zeichenfolge", () => {
    expect(filterOptions(opts, "11").map((o) => o.label)).toEqual(["11.4", "11.5"]);
    expect(filterOptions(opts, "00").map((o) => o.label)).toEqual(["007", "008"]);
    expect(filterOptions(opts, "300").map((o) => o.label)).toEqual(["3001", "3002"]);
  });
  it("Groß-/Kleinschreibung egal, leer zeigt alle, nicht auf Wert", () => {
    expect(filterOptions(opts, "AB").length).toBe(2);
    expect(filterOptions(opts, "  ").length).toBe(opts.length);
    expect(matchesPrefix("007", "id")).toBe(false);
  });
  it("Suchfeld erst ab mehr als 10 Einträgen", () => {
    expect(shouldShowSearch(10)).toBe(false);
    expect(shouldShowSearch(11)).toBe(true);
  });
  it("kurzes Dropdown zeigt kein Suchfeld", () => {
    render(<SearchableSelect value="" onValueChange={() => {}} options={opts.slice(0, 3)} placeholder="—" />);
    expect(screen.queryByRole("combobox", { expanded: false })).toBeTruthy();
    expect(screen.queryByPlaceholderText("Suchen …")).toBeNull();
  });
  it("langes Dropdown: Suche, Auswahl, inaktiv nicht wählbar, __none__ bleibt", () => {
    const onChange = vi.fn();
    const long = [{ value: "__none__", label: "–" }, ...opts, { value: "x", label: "009 alt", disabled: true }];
    render(<SearchableSelect value="__none__" onValueChange={onChange} options={long} />);
    fireEvent.click(screen.getByRole("combobox"));
    const input = screen.getByPlaceholderText("Suchen …");
    fireEvent.change(input, { target: { value: "00" } });
    expect(screen.getByText("007")).toBeTruthy();
    expect(screen.queryByText("3001")).toBeNull();
    fireEvent.click(screen.getByText("009 alt"));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("008"));
    expect(onChange).toHaveBeenCalledWith("id-008");
  });
});

describe("Scrollschutz Zahlenfelder", () => {
  it("Scrollen über fokussiertes Zahlenfeld ändert den Wert nicht und blockiert Scrollen nicht", () => {
    render(<Input type="number" defaultValue="25" aria-label="T" />);
    const el = screen.getByLabelText("T") as HTMLInputElement;
    el.focus();
    const ev = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 100 });
    el.dispatchEvent(ev);
    expect(document.activeElement).not.toBe(el);
    expect(el.value).toBe("25");
    expect(ev.defaultPrevented).toBe(false);
  });
  it("Textfelder und Tastatureingabe bleiben unverändert", () => {
    render(<><Input aria-label="txt" /><Input type="number" aria-label="n" min={0} max={100} /></>);
    const t = screen.getByLabelText("txt") as HTMLInputElement;
    t.focus();
    fireEvent.wheel(t);
    expect(document.activeElement).toBe(t);
    const n = screen.getByLabelText("n") as HTMLInputElement;
    fireEvent.change(n, { target: { value: "600" } });
    expect(n.value).toBe("600");
    expect(n.max).toBe("100");
  });
  it("Pfeile per CSS ausgeblendet", () => {
    expect(css).toMatch(/inner-spin-button[\s\S]*appearance:\s*none/);
  });
});
