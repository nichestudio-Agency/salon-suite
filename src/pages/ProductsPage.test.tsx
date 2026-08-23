import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductsPage } from "./ProductsPage";
import * as repo from "../firebase/product-repo";
import * as authCtx from "../app/auth-context";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(authCtx, "useAuth").mockReturnValue({
    loading: false, user: {} as never, role: "owner", salonId: "s1",
  });
});

describe("ProductsPage", () => {
  it("elenca i prodotti esistenti", async () => {
    vi.spyOn(repo, "listProducts").mockResolvedValue([
      { id: "a", titolo: "Cera", descrizione: "", prezzo: 1500, attivo: true },
    ]);
    render(<ProductsPage />);
    expect(await screen.findByText("Cera")).toBeInTheDocument();
    expect(screen.getByText(/15,00/)).toBeInTheDocument();
  });

  it("crea un prodotto convertendo il prezzo in centesimi", async () => {
    vi.spyOn(repo, "listProducts").mockResolvedValue([]);
    const create = vi.spyOn(repo, "createProduct").mockResolvedValue("newid");
    render(<ProductsPage />);
    await userEvent.type(screen.getByLabelText("Titolo"), "Balsamo");
    await userEvent.type(screen.getByLabelText("Prezzo (€)"), "12");
    await userEvent.click(screen.getByRole("button", { name: /aggiungi prodotto/i }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({ titolo: "Balsamo", prezzo: 1200, attivo: true })
      )
    );
  });
});
