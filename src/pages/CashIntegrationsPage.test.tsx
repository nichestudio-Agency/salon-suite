import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CashIntegrationsPage } from "./CashIntegrationsPage";
import * as cashRepo from "../firebase/cash-integration-repo";
import * as ticketRepo from "../firebase/ticket-repo";
import * as clientRepo from "../firebase/client-repo";
import * as loyaltyRepo from "../firebase/loyalty-repo";

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
  vi.spyOn(cashRepo, "recordManualSale").mockResolvedValue({
    saleId: "manual-1",
    alreadyProcessed: false,
    puntiAccreditati: 24,
  });
  vi.spyOn(clientRepo, "listSalonClients").mockResolvedValue([
    {
      id: "client-1",
      nome: "Anna Verdi",
      email: "anna@example.com",
      sesso: "femminile",
      dataNascita: "1990-02-03",
      hasPush: true,
      bookingCount: 1,
      lastBookingDate: "2026-09-01",
      orderCount: 0,
      lastOrderDate: null,
      totalSpent: 0,
      source: "account",
    },
  ]);
  vi.spyOn(ticketRepo, "createTicket").mockResolvedValue("ticket-1");
  vi.spyOn(loyaltyRepo, "lookupLoyaltyCard").mockResolvedValue({
    account: {
      clientId: "client-1",
      nome: "Anna Verdi",
      email: "anna@example.com",
      codice: "CARD-ANNA",
      punti: 42,
      puntiTotali: 80,
      puntiRiscattati: 0,
      visite: 3,
    },
    config: {
      attiva: true,
      puntiPerEuro: 1,
      sogliaPremio: 100,
      premioNome: "Buono da 10 €",
      premioValore: 1000,
    },
  });
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

  it("registra un incasso rapido associato al cliente", async () => {
    const recordSale = vi.spyOn(cashRepo, "recordManualSale");
    render(<CashIntegrationsPage />);
    await screen.findByText("Anna Verdi · account app");
    await userEvent.selectOptions(screen.getByLabelText("Cliente"), "client-1");
    await userEvent.type(screen.getByLabelText("Descrizione"), "Taglio diretto");
    await userEvent.type(screen.getByLabelText("Importo (€)"), "24");
    await userEvent.click(screen.getByRole("button", { name: "Registra incasso" }));
    await waitFor(() => expect(recordSale).toHaveBeenCalledWith(expect.objectContaining({
      salonId: "salone-x",
      clientId: "client-1",
      clientSource: "account",
      amount: 2400,
      description: "Taglio diretto",
    })));
    expect(await screen.findByText(/24 punti fidelity accreditati/i)).toBeInTheDocument();
  });

  it("associa il cliente inserendo il codice della fidelity card", async () => {
    const lookupCard = vi.spyOn(loyaltyRepo, "lookupLoyaltyCard");
    render(<CashIntegrationsPage />);
    await screen.findByText("Anna Verdi · account app");

    await userEvent.type(
      screen.getByLabelText("Codice fidelity"),
      "salon-fidelity:salone-x:CARD-ANNA",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Associa card" }),
    );

    await waitFor(() =>
      expect(lookupCard).toHaveBeenCalledWith("salone-x", "CARD-ANNA"),
    );
    expect(screen.getByLabelText("Cliente")).toHaveValue("client-1");
    expect(
      await screen.findByText("Card associata a Anna Verdi."),
    ).toBeInTheDocument();
  });
});
