import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("mostra un alert se l'annullamento fallisce", async () => {
    vi.spyOn(salonRepo, "listSalons").mockResolvedValue([
      { id: "s1", nome: "Salone Uno", timezone: "Europe/Rome", orariApertura: {},
        impostazioni: { passoMinuti: 15, modalitaConferma: "manuale" } },
    ]);
    vi.spyOn(orderApi, "listMyOrders").mockResolvedValue([
      { id: "o1", clientId: "c", items: [{ productId: "p1", titolo: "Cera", prezzo: 1500, qta: 2 }], totale: 3000, stato: "in_attesa" },
    ]);
    vi.spyOn(orderApi, "cancelOrder").mockRejectedValue(new Error("boom"));
    render(<MyOrdersPage />);
    expect(await screen.findByText(/Cera/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /annulla/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
