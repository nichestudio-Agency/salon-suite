import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingPage } from "./BookingPage";
import * as bookingApi from "../firebase/booking";
import * as operatorRepo from "../firebase/operator-repo";
import * as salonRepo from "../firebase/salon-repo";
import * as serviceRepo from "../firebase/service-repo";
import * as waitlistRepo from "../firebase/waitlist-repo";
import { SalonTenantProvider } from "../app/salon-tenant-context";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(salonRepo, "getSalon").mockResolvedValue(
    {
      nome: "Barberia X",
      timezone: "Europe/Rome",
      orariApertura: {},
      impostazioni: { passoMinuti: 15, modalitaConferma: "manuale" },
    },
  );
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
  vi.spyOn(waitlistRepo, "listMyWaitlist").mockResolvedValue([]);
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
      bookingIds: ["b1"],
      occurrenceCount: 1,
      endMin: 570,
      stato: "in_attesa",
      prezzoOriginale: 2000,
      sconto: 0,
      prezzoFinale: 2000,
    });

    render(<SalonTenantProvider><BookingPage /></SalonTenantProvider>);

    await screen.findByRole("option", { name: /Taglio/ });
    await userEvent.selectOptions(screen.getByLabelText("Servizio"), "svc1");
    await userEvent.selectOptions(await screen.findByLabelText("Operatore"), "op1");
    await userEvent.type(screen.getByLabelText("Data"), "2026-08-24");
    await userEvent.click(screen.getByRole("button", { name: /cerca orari/i }));

    expect(await screen.findByRole("button", { name: "09:00" })).toBeInTheDocument();
    expect(availability).toHaveBeenCalledWith({
      salonId: "salone-x",
      serviceId: "svc1",
      operatorId: "op1",
      date: "2026-08-24",
    });

    await userEvent.click(screen.getByRole("button", { name: "09:00" }));
    await userEvent.click(screen.getByRole("button", { name: /conferma prenotazione/i }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        salonId: "salone-x",
        serviceId: "svc1",
        operatorId: "op1",
        date: "2026-08-24",
        startMin: 540,
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/richiesta inviata/i);
  });

  it("calcola e crea una serie con più servizi", async () => {
    vi.spyOn(serviceRepo, "listServices").mockResolvedValue([
      { id: "svc1", titolo: "Taglio", descrizione: "", prezzo: 2000, durataMin: 30, attivo: true },
      { id: "svc2", titolo: "Barba", descrizione: "", prezzo: 1200, durataMin: 15, attivo: true },
    ]);
    const availability = vi.spyOn(bookingApi, "getAvailability").mockResolvedValue({
      date: "2026-08-24", dates: ["2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14"],
      durationMin: 45, stepMin: 15, starts: [540],
    });
    const create = vi.spyOn(bookingApi, "createBooking").mockResolvedValue({
      bookingId: "b1", bookingIds: ["b1", "b2", "b3", "b4"], occurrenceCount: 4,
      endMin: 585, stato: "in_attesa", prezzoOriginale: 3200, sconto: 0, prezzoFinale: 3200,
    });

    render(<SalonTenantProvider><BookingPage /></SalonTenantProvider>);
    await screen.findByRole("option", { name: /Taglio/ });
    await userEvent.selectOptions(screen.getByLabelText("Servizio"), "svc1");
    await userEvent.click(screen.getByRole("checkbox", { name: /Barba/ }));
    await userEvent.selectOptions(screen.getByLabelText("Operatore"), "op1");
    await userEvent.selectOptions(screen.getByLabelText("Frequenza"), "4");
    await userEvent.type(screen.getByLabelText("Data"), "2026-08-24");
    await userEvent.click(screen.getByRole("button", { name: /cerca orari/i }));

    await waitFor(() => expect(availability).toHaveBeenCalledWith({
      salonId: "salone-x", serviceId: "svc1", serviceIds: ["svc1", "svc2"], operatorId: "op1",
      date: "2026-08-24", recurrenceCount: 4,
    }));
    await userEvent.click(await screen.findByRole("button", { name: "09:00" }));
    await userEvent.click(screen.getByRole("button", { name: /conferma prenotazione/i }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({
      salonId: "salone-x", serviceId: "svc1", serviceIds: ["svc1", "svc2"], operatorId: "op1",
      date: "2026-08-24", startMin: 540, recurrenceCount: 4,
    }));
    expect(await screen.findByRole("status")).toHaveTextContent(/serie di 4 appuntamenti/i);
  });
});
