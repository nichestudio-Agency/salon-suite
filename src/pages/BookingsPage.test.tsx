import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as authCtx from "../app/auth-context";
import * as bookingRepo from "../firebase/booking-repo";
import * as operatorRepo from "../firebase/operator-repo";
import * as serviceRepo from "../firebase/service-repo";
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

    expect(await screen.findByText("Giulia")).toBeInTheDocument();
    expect(screen.getByText(/Taglio con Marco/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /conferma/i }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("s1", "b1", "confermata"),
    );
  });
});
