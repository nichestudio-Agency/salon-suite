import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CashIntegrationsPage } from "./CashIntegrationsPage";
import * as cashRepo from "../firebase/cash-integration-repo";
import * as ticketRepo from "../firebase/ticket-repo";

vi.mock("../app/auth-context", () => ({
  useAuth: () => ({
    salonId: "salone-x",
    user: { displayName: "Titolare Test" },
  }),
}));
vi.mock("../app/salon-tenant-context", () => ({
  useSalonTenant: () => ({ salon: { id: "salone-x", nome: "Salone X" } }),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(cashRepo, "getCashIntegration").mockResolvedValue(
    cashRepo.DEFAULT_CASH_INTEGRATION,
  );
  vi.spyOn(cashRepo, "listCashActivity").mockResolvedValue([
    {
      id: "sale-1",
      date: "2026-09-12",
      customer: "Mario Rossi",
      total: 3200,
      source: "salon_suite",
    },
  ]);
  vi.spyOn(cashRepo, "saveCashIntegration").mockResolvedValue();
  vi.spyOn(ticketRepo, "createTicket").mockResolvedValue("ticket-1");
});

describe("CashIntegrationsPage", () => {
  it("mostra lo stato manuale e il registro reale", async () => {
    render(<CashIntegrationsPage />);
    expect(
      await screen.findByRole("heading", { name: "Cassa e gestionale" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Mario Rossi")).toBeInTheDocument();
    expect(screen.getAllByText(/32,00/)).toHaveLength(2);
    expect(screen.getByRole("checkbox", { name: /Sincronizza prodotti/ })).toBeDisabled();
  });

  it("invia una richiesta tecnica con i dati del gestionale", async () => {
    const createTicket = vi.spyOn(ticketRepo, "createTicket");
    render(<CashIntegrationsPage />);
    await screen.findByText("Mario Rossi");
    await userEvent.click(
      screen.getByRole("button", { name: /API \/ Webhook/ }),
    );
    await userEvent.type(
      screen.getByLabelText("Produttore o gestionale"),
      "Cassa Demo",
    );
    await userEvent.type(
      screen.getByLabelText("Riferimento punto vendita"),
      "STORE-42",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Richiedi verifica tecnica" }),
    );
    await waitFor(() =>
      expect(createTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          salonId: "salone-x",
          categoria: "Integrazione cassa",
          testo: expect.stringContaining("Cassa Demo"),
        }),
      ),
    );
    expect(await screen.findByText(/Richiesta inviata/)).toBeInTheDocument();
  });
});
