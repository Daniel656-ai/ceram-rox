import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const apiMock = vi.hoisted(() => ({ orders: { deleteSummary: vi.fn() } }));
vi.mock("@/lib/api", () => ({ api: apiMock }));

import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { OrderDeleteBody } from "@/components/orders/OrderDeleteInfo";

const mount = (onConfirm = vi.fn()) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Auftrag löschen?</AlertDialogTitle>
          <AlertDialogDescription>Test</AlertDialogDescription>
          <OrderDeleteBody orderId="o1" pending={false} onConfirm={onConfirm} />
        </AlertDialogContent>
      </AlertDialog>
    </QueryClientProvider>,
  );
  return onConfirm;
};
const del = () => screen.getByText("Löschen").closest("button") as HTMLButtonElement;

beforeEach(() => vi.clearAllMocks());

describe("Löschdialog: Auftrag löschen", () => {
  it("zeigt, was mitgelöscht, gelöst wird und was bestehen bleibt; Löschen ist möglich", async () => {
    apiMock.orders.deleteSummary.mockResolvedValue({
      blockers: [], has_results: false, documents: ["a.pdf"], upload_files: [], prefilled_values: 2, reports: 0, m3_requests: 0, audit_entries: 1,
      production_releases: ["FR-1"], process_links: 1, samples: 1, measurements: 1,
      sample_plan: [{ name: "P-NEU", deletable: true, reason: null }, { name: "P-ALT", deletable: false, reason: "Status nicht „neu“" }],
    });
    const onConfirm = mount();
    expect(await screen.findByText("Beim Löschen werden mitgelöscht:")).toBeTruthy();
    expect(screen.getByText("1 Datei(en): a.pdf")).toBeTruthy();
    expect(screen.getByText("2 vorläufige Formularwert(e) vom Anlegen")).toBeTruthy();
    expect(screen.getByText("Beim Löschen werden gelöst (bleiben bestehen):")).toBeTruthy();
    expect(screen.getByText(/Fertigungsfreigabe FR-1/)).toBeTruthy();
    expect(screen.getByText("Probe P-ALT bleibt bestehen (Status nicht „neu“)")).toBeTruthy();
    await waitFor(() => expect(del().disabled).toBe(false));
    fireEvent.click(del());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("mit Messdaten: klare Meldung, Löschen gesperrt", async () => {
    apiMock.orders.deleteSummary.mockResolvedValue({
      blockers: ["Auftrag enthält Messergebnisse, Rohdaten oder Korrekturen und darf nicht gelöscht werden.", "Auftrag hat einen offiziellen Bericht und darf nicht gelöscht werden."],
      has_results: true, documents: [], upload_files: [],
    });
    const onConfirm = mount();
    expect(await screen.findByText("Löschen nicht möglich:")).toBeTruthy();
    expect(screen.getByText(/Messergebnisse, Rohdaten oder Korrekturen/)).toBeTruthy();
    expect(screen.getByText(/offiziellen Bericht/)).toBeTruthy();
    expect(del().disabled).toBe(true);
    fireEvent.click(del());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("während des Ladens ist Löschen gesperrt; ohne Prüfergebnis (Fehler) bleibt es möglich – die Datenbank prüft verbindlich", async () => {
    apiMock.orders.deleteSummary.mockReturnValue(new Promise(() => {}));
    mount();
    expect(del().disabled).toBe(true);
  });

  it("Fehler beim Laden der Prüfung: Hinweis, Löschen bleibt möglich", async () => {
    apiMock.orders.deleteSummary.mockRejectedValue(new Error("x"));
    mount();
    expect(await screen.findByText(/Anhänge konnten nicht geprüft werden/)).toBeTruthy();
    await waitFor(() => expect(del().disabled).toBe(false));
  });

  it("alte Datenbank ohne neue Felder: bisherige Darstellung", async () => {
    apiMock.orders.deleteSummary.mockResolvedValue({ documents: ["a.pdf"], upload_files: [], reports: 0, production_releases: [], m3_requests: 0, samples: 0, measurements: 0, has_results: false });
    mount();
    expect(await screen.findByText("Beim Löschen werden mit entfernt bzw. gelöst:")).toBeTruthy();
    await waitFor(() => expect(del().disabled).toBe(false));
  });
});

describe("Löschdialog: Auftrag mit Messdaten (Master/Ersteller dürfen immer löschen)", () => {
  const withData = {
    blockers: [], has_results: true, documents: [], upload_files: [], reports: 1, official_reports: 1,
    real_results: 5, raw_datasets: 2, corrections: 1, work_logs: 3, started: true, measurements: 1,
    needs_confirmation: true, confirm_numbers: ["6666", "DT0260001"], production_releases: ["FR-1"],
  };

  it("listet die Messdaten auf; Löschen erst nach Eingabe der Auftragsnummer", async () => {
    apiMock.orders.deleteSummary.mockResolvedValue(withData);
    const onConfirm = mount();
    expect(await screen.findByText(/enthält Messdaten/)).toBeTruthy();
    expect(screen.getByText("5 Messergebnis(se)")).toBeTruthy();
    expect(screen.getByText("2 Rohdatensatz/-sätze")).toBeTruthy();
    expect(screen.getByText("1 Korrektur(en)/Korrekturhistorie")).toBeTruthy();
    expect(screen.getByText("3 Arbeitszeit-Eintrag/-Einträge")).toBeTruthy();
    expect(screen.getByText("1 offizielle(r) Bericht(e)")).toBeTruthy();
    expect(screen.getByText("begonnene oder abgeschlossene Aufgaben/Prozesse")).toBeTruthy();
    expect(del().disabled).toBe(true);
    const input = screen.getByLabelText(/Auftragsnummer eingeben/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "falsch" } });
    expect(del().disabled).toBe(true);
    fireEvent.change(input, { target: { value: "  dt0260001 " } });
    expect(del().disabled).toBe(false);
    fireEvent.click(del());
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith("dt0260001");
  });

  it("ohne Messdaten: keine Nummer nötig, onConfirm ohne Nummer", async () => {
    apiMock.orders.deleteSummary.mockResolvedValue({ ...withData, real_results: 0, raw_datasets: 0, corrections: 0, work_logs: 0, started: false, official_reports: 0, needs_confirmation: false });
    const onConfirm = mount();
    await waitFor(() => expect(del().disabled).toBe(false));
    expect(screen.queryByLabelText(/Auftragsnummer eingeben/)).toBeNull();
    fireEvent.click(del());
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(undefined);
  });
});
