import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingPage } from "./BookingPage";
import * as bookingApi from "../firebase/booking";
import * as operatorRepo from "../firebase/operator-repo";
import * as salonRepo from "../firebase/salon-repo";
import * as serviceRepo from "../firebase/service-repo";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(salonRepo, "listSalons").mockResolvedValue([
    {
      id: "s1",
      nome: "Barberia X",
      timezone: "Europe/Rome",
      orariApertura: {},
      impostazioni: { passoMinuti: 15, modalitaConferma: "manuale" },
    },
  ]);
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
  vi.spyOn(bookingApi, "listMyBookings").mockResolvedValue([]);
});

describe("BookingPage", () => {
  it("cerca uno slot e crea la prenotazione selezionata", async () => {
    const availability = vi.spyOn(bookingApi, "getAvailability").mockResolvedValue({
      date: "2026-08-24",
      durationMin: 30,
      stepMin: 15,
      starts: [540, 555],
    });
    const create = vi.spyOn(bookingApi, "createBooking").mockResolvedValue({
      bookingId: "b1",
      endMin: 570,
      stato: "in_attesa",
    });

    render(<BookingPage />);

    await userEvent.selectOptions(await screen.findByLabelText("Salone"), "s1");
    await userEvent.selectOptions(await screen.findByLabelText("Servizio"), "svc1");
    await userEvent.selectOptions(await screen.findByLabelText("Operatore"), "op1");
    await userEvent.type(screen.getByLabelText("Data"), "2026-08-24");
    await userEvent.click(screen.getByRole("button", { name: /cerca orari/i }));

    expect(await screen.findByRole("button", { name: "09:00" })).toBeInTheDocument();
    expect(availability).toHaveBeenCalledWith({
      salonId: "s1",
      serviceId: "svc1",
      operatorId: "op1",
      date: "2026-08-24",
    });

    await userEvent.click(screen.getByRole("button", { name: "09:00" }));
    await userEvent.click(screen.getByRole("button", { name: /conferma prenotazione/i }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        salonId: "s1",
        serviceId: "svc1",
        operatorId: "op1",
        date: "2026-08-24",
        startMin: 540,
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/richiesta inviata/i);
  });
});
