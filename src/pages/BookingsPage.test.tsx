import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as authCtx from "../app/auth-context";
import * as bookingRepo from "../firebase/booking-repo";
import * as operatorRepo from "../firebase/operator-repo";
import * as salonRepo from "../firebase/salon-repo";
import * as serviceRepo from "../firebase/service-repo";
import * as salesRepo from "../firebase/sales-repo";
import { BookingsPage } from "./BookingsPage";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(authCtx, "useAuth").mockReturnValue({
    loading: false,
    user: {} as never,
    role: "owner",
    salonId: "s1",
  });
  vi.spyOn(serviceRepo, "listServices").mockResolvedValue([
    {
      id: "svc1",
      titolo: "Taglio",
      descrizione: "",
      prezzo: 2000,
      durataMin: 30,
      attivo: true,
    },
  ]);
  vi.spyOn(operatorRepo, "listOperators").mockResolvedValue([
    { id: "op1", nome: "Marco", attivo: true },
  ]);
  vi.spyOn(salonRepo, "getSalon").mockResolvedValue(null);
  vi.spyOn(salesRepo, "manageBookingOutcome").mockResolvedValue({ bookingId: "b1", stato: "completata", saleId: "booking_b1", alreadyProcessed: false, puntiAccreditati: 20 });
});

describe("BookingsPage", () => {
  it("mostra una richiesta e consente di confermarla", async () => {
    vi.spyOn(bookingRepo, "listBookings")
      .mockResolvedValueOnce([
        {
          id: "b1",
          clientId: "c1",
          clientNome: "Giulia",
          operatorId: "op1",
          serviceId: "svc1",
          date: "2026-08-24",
          startMin: 600,
          endMin: 630,
          stato: "in_attesa",
        },
      ])
      .mockResolvedValueOnce([]);
    const update = vi
      .spyOn(bookingRepo, "updateBookingStatus")
      .mockResolvedValue();

    render(<BookingsPage />);

    expect((await screen.findAllByText("Giulia")).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Agenda di Marco")).toBeInTheDocument();
    expect(screen.getByText(/Taglio con Marco/)).toBeInTheDocument();
    expect(screen.getByLabelText("Riepilogo della giornata selezionata")).toHaveTextContent(/1\s*prenotazione/);
    await userEvent.click(screen.getByRole("button", { name: /conferma/i }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("s1", "b1", "confermata"),
    );
  });

  it("rende la settimana più sintetica e mostra il carico per giornata", async () => {
    vi.spyOn(bookingRepo, "listBookings").mockResolvedValue([
      { id: "b1", clientId: "c1", clientNome: "Giulia", operatorId: "op1", serviceId: "svc1", date: "2026-08-25", startMin: 600, endMin: 630, stato: "confermata" },
      { id: "b2", clientId: "c2", clientNome: "Marta", operatorId: "op1", serviceId: "svc1", date: "2026-08-25", startMin: 660, endMin: 690, stato: "confermata" },
    ]);

    render(<BookingsPage />);
    await screen.findAllByText("Giulia");
    await userEvent.click(screen.getByRole("button", { name: "Settimana" }));

    expect(screen.getByText("2 app.")).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Giulia/)[0]).toHaveClass("is-compact");
  });

  it("chiude un appuntamento confermato attribuendolo all'operatore effettivo", async () => {
    vi.spyOn(bookingRepo, "listBookings")
      .mockResolvedValueOnce([{ id: "b1", clientId: "c1", clientNome: "Giulia", operatorId: "op1", serviceId: "svc1", date: "2026-08-24", startMin: 600, endMin: 630, stato: "confermata" }])
      .mockResolvedValueOnce([]);

    render(<BookingsPage />);
    await userEvent.click(await screen.findByRole("button", { name: /completa e incassa/i }));

    await waitFor(() => expect(salesRepo.manageBookingOutcome).toHaveBeenCalledWith({
      salonId: "s1", bookingId: "b1", outcome: "completata", performedByOperatorId: "op1",
    }));
    expect(await screen.findByText(/20 punti fidelity accreditati/i)).toBeInTheDocument();
  });
});
