import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CatalogPage } from "./CatalogPage";
import * as salonRepo from "../firebase/salon-repo";
import * as productRepo from "../firebase/product-repo";
import { CartProvider, useCart } from "../app/cart-context";

beforeEach(() => vi.restoreAllMocks());

describe("CatalogPage", () => {
  it("mostra i prodotti attivi del salone selezionato", async () => {
    vi.spyOn(salonRepo, "listSalons").mockResolvedValue([
      { id: "s1", nome: "Salone Uno", timezone: "Europe/Rome", orariApertura: {},
        impostazioni: { passoMinuti: 15, modalitaConferma: "manuale" } },
    ]);
    vi.spyOn(productRepo, "listProducts").mockResolvedValue([
      { id: "p1", titolo: "Cera", descrizione: "Tenuta forte", prezzo: 1500, attivo: true },
      { id: "p2", titolo: "Vecchio", descrizione: "", prezzo: 500, attivo: false },
    ]);
    render(<MemoryRouter><CartProvider><CatalogPage /></CartProvider></MemoryRouter>);
    expect(await screen.findByText("Cera")).toBeInTheDocument();
    // il prodotto non attivo non viene mostrato
    expect(screen.queryByText("Vecchio")).not.toBeInTheDocument();
  });

  it("aggiunge un prodotto al carrello", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    vi.spyOn(salonRepo, "listSalons").mockResolvedValue([
      { id: "s1", nome: "Salone Uno", timezone: "Europe/Rome", orariApertura: {},
        impostazioni: { passoMinuti: 15, modalitaConferma: "manuale" } },
    ]);
    vi.spyOn(productRepo, "listProducts").mockResolvedValue([
      { id: "p1", titolo: "Cera", descrizione: "", prezzo: 1500, attivo: true },
    ]);
    function Count() { return <span data-testid="n">{useCart().items.length}</span>; }
    render(
      <MemoryRouter>
        <CartProvider>
          <CatalogPage />
          <Count />
        </CartProvider>
      </MemoryRouter>
    );
    await userEvent.click(await screen.findByRole("button", { name: /aggiungi al carrello/i }));
    expect(screen.getByTestId("n").textContent).toBe("1");
  });
});
