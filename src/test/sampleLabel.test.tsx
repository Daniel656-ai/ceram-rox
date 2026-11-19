import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SampleLabel from "@/components/results/SampleLabel";

describe("SampleLabel: Bezeichnung groß, Nummer klein und grau", () => {
  it("mit Bezeichnung: Bezeichnung als Hauptbezeichnung, Nummer klein grau", () => {
    render(<SampleLabel number="P260760" name="FG26_0315" />);
    expect(screen.getByText("FG26_0315").className).toContain("font-medium");
    expect(screen.getByText("P260760").className).toContain("text-muted-foreground");
  });
  it("ohne Bezeichnung: Nummer als Hauptbezeichnung", () => {
    render(<SampleLabel number="P260761" name="  " />);
    expect(screen.getByText("P260761").className).not.toContain("text-muted-foreground");
  });
});
