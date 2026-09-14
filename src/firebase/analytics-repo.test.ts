import { describe, expect, it } from "vitest";
import type { Booking, RewardRedemption, Sale } from "../domain/models";
import { calculateSalonAnalytics } from "./analytics-repo";

const dateOffset = (days: number) => { const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); };

describe("calculateSalonAnalytics", () => {
  it("confronta i periodi e aggrega servizi, prodotti e premi", () => {
    const bookings: Booking[] = [
      { clientId: "c1", operatorId: "op1", serviceId: "taglio", date: dateOffset(-4), startMin: 600, endMin: 645, stato: "completata" },
      { clientId: "c2", operatorId: "op1", serviceId: "taglio", date: dateOffset(-34), startMin: 600, endMin: 645, stato: "completata" },
      { clientId: "c3", operatorId: "op1", serviceId: "taglio", date: dateOffset(-3), startMin: 660, endMin: 705, stato: "no_show" },
    ];
    const sale = (date: string, total: number): Sale => ({ clientId: "c1", date, stato: "pagata", subtotale: total, sconto: 0, totale: total, paymentMethod: "in_salone", performedByOperatorId: "op1", createdByUserId: "owner", items: [{ tipo: "servizio", referenceId: "taglio", titolo: "Taglio", qta: 1, prezzoUnitario: 3000, totale: 3000 }, { tipo: "prodotto", referenceId: "cera", titolo: "Cera", qta: 1, prezzoUnitario: total - 3000, totale: total - 3000 }] });
    const rewards: RewardRedemption[] = [{ id: "r1", clientId: "c1", clientNome: "Cliente", rewardId: "buono", rewardNome: "Buono", punti: 100, codice: "X", stato: "utilizzato", createdAt: new Date().toISOString() }];

    const result = calculateSalonAnalytics(bookings, [sale(dateOffset(-4), 4800), sale(dateOffset(-34), 4500)], rewards);

    expect(result.completedBookings).toBe(1);
    expect(result.previousCompletedBookings).toBe(1);
    expect(result.revenue).toBe(4800);
    expect(result.occupancyRate).toEqual(expect.any(Number));
    expect(result.services[0]).toMatchObject({ label: "Taglio", current: 1, previous: 1, trend: 0 });
    expect(result.products[0]).toMatchObject({ label: "Cera", current: 1, previous: 1 });
    expect(result.rewards[0]).toMatchObject({ label: "Buono", issued: 1, used: 1 });
  });

  it("rispetta il periodo selezionato e confronta una finestra equivalente", () => {
    const makeSale = (date: string): Sale => ({ clientId: "c1", clientNome: "Mario Rossi", date, stato: "pagata", subtotale: 3000, sconto: 0, totale: 3000, paymentMethod: "in_salone", createdByUserId: "owner", items: [{ tipo: "servizio", referenceId: "taglio", titolo: "Taglio", qta: 1, prezzoUnitario: 3000, totale: 3000 }] });
    const result = calculateSalonAnalytics([], [makeSale(dateOffset(-65)), makeSale(dateOffset(-120))], [], 90);

    expect(result.revenue).toBe(3000);
    expect(result.previousRevenue).toBe(3000);
    expect(result.services[0].details[0]).toMatchObject({ client: "Mario Rossi", revenue: 3000 });
  });
});
