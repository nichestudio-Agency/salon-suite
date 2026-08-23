import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CatalogPage } from "./CatalogPage";
import * as salonRepo from "../firebase/salon-repo";
import * as productRepo from "../firebase/product-repo";

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
    render(<MemoryRouter><CatalogPage /></MemoryRouter>);
    expect(await screen.findByText("Cera")).toBeInTheDocument();
    // il prodotto non attivo non viene mostrato
    expect(screen.queryByText("Vecchio")).not.toBeInTheDocument();
  });
});
