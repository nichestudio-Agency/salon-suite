import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MyOrdersPage } from "./MyOrdersPage";
import * as salonRepo from "../firebase/salon-repo";
import * as orderApi from "../firebase/order";

beforeEach(() => vi.restoreAllMocks());

describe("MyOrdersPage", () => {
  it("elenca gli ordini del cliente per il salone selezionato", async () => {
    vi.spyOn(salonRepo, "listSalons").mockResolvedValue([
      { id: "s1", nome: "Salone Uno", timezone: "Europe/Rome", orariApertura: {},
        impostazioni: { passoMinuti: 15, modalitaConferma: "manuale" } },
    ]);
    vi.spyOn(orderApi, "listMyOrders").mockResolvedValue([
      { id: "o1", clientId: "c", items: [{ productId: "p1", titolo: "Cera", prezzo: 1500, qta: 2 }], totale: 3000, stato: "pronto" },
    ]);
    render(<MyOrdersPage />);
    expect(await screen.findByText(/Cera/)).toBeInTheDocument();
    expect(screen.getByText(/pronto/i)).toBeInTheDocument();
    expect(screen.getByText(/30,00/)).toBeInTheDocument();
  });
});
