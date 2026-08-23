import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServicesPage } from "./ServicesPage";
import * as repo from "../firebase/service-repo";
import * as authCtx from "../app/auth-context";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(authCtx, "useAuth").mockReturnValue({
    loading: false, user: {} as never, role: "owner", salonId: "s1",
  });
});

describe("ServicesPage", () => {
  it("elenca i servizi esistenti", async () => {
    vi.spyOn(repo, "listServices").mockResolvedValue([
      { id: "a", titolo: "Taglio", descrizione: "", prezzo: 2000, durataMin: 30, attivo: true },
    ]);
    render(<ServicesPage />);
    expect(await screen.findByText("Taglio")).toBeInTheDocument();
    expect(screen.getByText(/20,00/)).toBeInTheDocument(); // prezzo in euro
  });

  it("crea un servizio convertendo il prezzo in centesimi", async () => {
    vi.spyOn(repo, "listServices").mockResolvedValue([]);
    const create = vi.spyOn(repo, "createService").mockResolvedValue("newid");
    render(<ServicesPage />);
    await userEvent.type(screen.getByLabelText("Titolo"), "Barba");
    await userEvent.type(screen.getByLabelText("Prezzo (€)"), "15");
    await userEvent.type(screen.getByLabelText("Durata (min)"), "20");
    await userEvent.click(screen.getByRole("button", { name: /aggiungi servizio/i }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({ titolo: "Barba", prezzo: 1500, durataMin: 20, attivo: true })
      )
    );
  });
});
