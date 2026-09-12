import { describe, expect, it } from "vitest";
import type { Booking, Sale } from "../domain/models";
import { calculateOperatorStats } from "./sales-repo";

const booking = (stato: Booking["stato"], operatorId = "op1"): Booking => ({
  clientId: "c1", operatorId, serviceId: "s1", date: "2026-09-10",
  startMin: 600, endMin: 630, stato,
});

const sale = (date: string, clientId: string, operatorId = "op1"): Sale => ({
  clientId, date, stato: "pagata", subtotale: 2500, sconto: 0, totale: 2500,
  paymentMethod: "in_salone", performedByOperatorId: operatorId, createdByUserId: "owner",
  items: [
    { tipo: "servizio", referenceId: "s1", titolo: "Taglio", qta: 1, prezzoUnitario: 2000, totale: 2000, performedByOperatorId: operatorId },
    { tipo: "prodotto", referenceId: "p1", titolo: "Cera", qta: 1, prezzoUnitario: 500, totale: 500, soldByOperatorId: operatorId },
  ],
});

describe("calculateOperatorStats", () => {
  it("distingue prenotazioni, no-show, clienti e ricavi attribuiti", () => {
    const result = calculateOperatorStats(
      [booking("completata"), booking("no_show"), booking("annullata")],
      [sale("2026-09-10", "c1"), sale("2026-09-11", "c2")],
    );

    expect(result).toEqual([expect.objectContaining({
      operatorId: "op1", bookingCount: 2, noShowCount: 1, servedCount: 2,
      uniqueClients: 2, acquiredClients: 2, serviceRevenue: 4000,
      productRevenue: 1000, productsSold: 2, averageTicket: 2500,
    })]);
  });

  it("applica il periodo senza perdere l'attribuzione storica del primo cliente", () => {
    const result = calculateOperatorStats([], [
      sale("2026-07-01", "c1", "op2"),
      sale("2026-09-10", "c1", "op1"),
    ], "2026-09-01");

    expect(result[0]).toEqual(expect.objectContaining({ operatorId: "op1", acquiredClients: 0 }));
  });
});
