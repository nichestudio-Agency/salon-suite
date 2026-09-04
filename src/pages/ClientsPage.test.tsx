import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ClientsPage } from "./ClientsPage";
import * as authContext from "../app/auth-context";
import * as clientRepo from "../firebase/client-repo";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(authContext, "useAuth").mockReturnValue({ loading: false, user: {} as never, role: "owner", salonId: "s1" });
});

describe("ClientsPage", () => {
  it("mostra anagrafica e attività dei clienti del salone", async () => {
    vi.spyOn(clientRepo, "listSalonClients").mockResolvedValue([{ id: "c1", nome: "Luca Bianchi", email: "luca@example.com", sesso: "maschile", dataNascita: "1990-01-01", hasPush: false, bookingCount: 4, lastBookingDate: "2026-08-20", orderCount: 2, lastOrderDate: "2026-07-10", totalSpent: 4200 }]);
    render(<MemoryRouter><ClientsPage /></MemoryRouter>);
    expect(await screen.findByText("Luca Bianchi")).toBeInTheDocument();
    expect(screen.getByText("4 prenotazioni")).toBeInTheDocument();
    expect(screen.getByText("€ 42,00")).toBeInTheDocument();
  });
});
