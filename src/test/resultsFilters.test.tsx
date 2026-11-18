import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import ResultsFilterBar from "@/components/results/ResultsFilterBar";
import {
  activeFilterChips,
  countSecondaryActive,
  EMPTY_RESULTS_FILTERS,
  type ResultsFilters,
} from "@/lib/results/resultsFilters";

const f = (over: Partial<ResultsFilters>): ResultsFilters => ({ ...EMPTY_RESULTS_FILTERS, ...over });

describe("activeFilterChips", () => {
  it("liefert ohne aktive Filter keine Chips", () => {
    expect(activeFilterChips(EMPTY_RESULTS_FILTERS)).toEqual([]);
    expect(countSecondaryActive(EMPTY_RESULTS_FILTERS)).toBe(0);
  });

  it("ignoriert reine Leerzeichen in Textfiltern", () => {
    expect(activeFilterChips(f({ searchText: "   ", sampleFilter: " " }))).toEqual([]);
  });

  it("erzeugt je aktivem Filter einen Chip in fester Reihenfolge", () => {
    const chips = activeFilterChips(
      f({
        dateTo: "2026-10-31",
        searchText: "glasur",
        projectFilter: "Projekt A",
        creatorFilter: "Müller",
        conditionKey: "Temperatur",
        conditionValue: "300 °C",
      })
    );
    expect(chips.map((c) => c.label)).toEqual([
      "Suche: glasur",
      "Projekt: Projekt A",
      "Auftraggeber: Müller",
      "Temperatur: 300 °C",
      "Bis 31.10.2026",
    ]);
    expect(chips.filter((c) => c.secondary).map((c) => c.id)).toEqual(["creator", "condition", "dateTo"]);
  });

  it("zählt nur Filter hinter „Weitere Filter“", () => {
    expect(countSecondaryActive(f({ serviceFilter: "XRF", sampleFilter: "P-1" }))).toBe(0);
    expect(countSecondaryActive(f({ technicianFilter: "Meier", dateFrom: "2026-01-01" }))).toBe(2);
  });

  it("setzt beim Merkmal-Chip auch den Wert zurück", () => {
    const [chip] = activeFilterChips(f({ conditionKey: "Temperatur" }));
    expect(chip.label).toBe("Merkmal: Temperatur");
    expect(chip.reset).toEqual({ conditionKey: "all", conditionValue: "all" });
  });
});

function Harness({ initial, spy }: { initial: ResultsFilters; spy?: (f: ResultsFilters) => void }) {
  const [filters, setFilters] = useState(initial);
  return (
    <ResultsFilterBar
      filters={filters}
      onChange={(patch) =>
        setFilters((prev) => {
          const next = { ...prev, ...patch };
          spy?.(next);
          return next;
        })
      }
      services={["XRF"]}
      projects={["Projekt A"]}
      creators={["Müller"]}
      technicians={["Meier"]}
      conditionDimensions={[]}
    />
  );
}

describe("ResultsFilterBar", () => {
  it("zeigt Suche, Messart, Projekt und Proben-ID immer an, weitere Filter erst nach Klick", () => {
    render(<Harness initial={EMPTY_RESULTS_FILTERS} />);
    expect(screen.getByLabelText("Volltextsuche")).toBeInTheDocument();
    expect(screen.getByLabelText("Messart")).toBeInTheDocument();
    expect(screen.getByLabelText("Projekt")).toBeInTheDocument();
    expect(screen.getByLabelText("Proben-ID")).toBeInTheDocument();
    expect(screen.queryByText("Abgeschlossen ab")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Weitere Filter/ }));
    expect(screen.getByText("Abgeschlossen ab")).toBeInTheDocument();
    expect(screen.getByText("Auftraggeber")).toBeInTheDocument();
  });

  it("zeigt die Anzahl versteckter aktiver Filter am Knopf", () => {
    render(<Harness initial={f({ creatorFilter: "Müller", dateFrom: "2026-01-01" })} />);
    expect(screen.getByRole("button", { name: /Weitere Filter\s*2/ })).toBeInTheDocument();
  });

  it("entfernt einen einzelnen Filter über seinen Chip", () => {
    const spy = vi.fn();
    render(<Harness initial={f({ searchText: "glasur", creatorFilter: "Müller" })} spy={spy} />);
    fireEvent.click(screen.getByRole("button", { name: "Filter Auftraggeber: Müller entfernen" }));
    expect(spy).toHaveBeenLastCalledWith(f({ searchText: "glasur" }));
    expect(screen.queryByText("Auftraggeber: Müller")).not.toBeInTheDocument();
    expect(screen.getByText("Suche: glasur")).toBeInTheDocument();
  });

  it("setzt mit „Zurücksetzen“ alle Filter zurück", () => {
    const spy = vi.fn();
    render(<Harness initial={f({ searchText: "glasur", dateTo: "2026-02-01" })} spy={spy} />);
    fireEvent.click(screen.getByRole("button", { name: /Zurücksetzen/ }));
    expect(spy).toHaveBeenLastCalledWith(EMPTY_RESULTS_FILTERS);
    expect(screen.queryByText("Aktiv:")).not.toBeInTheDocument();
  });
});
