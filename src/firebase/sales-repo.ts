import { collection, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { Booking, Sale } from "../domain/models";
import { db, functions } from "./app";

export type BookingOutcome = "completata" | "no_show";

export interface ManageBookingOutcomeInput {
  salonId: string;
  bookingId: string;
  outcome: BookingOutcome;
  performedByOperatorId?: string;
}

export interface ManageBookingOutcomeResult {
  bookingId: string;
  stato: BookingOutcome;
  saleId: string | null;
  alreadyProcessed: boolean;
}

export interface OperatorStats {
  operatorId: string;
  bookingCount: number;
  servedCount: number;
  uniqueClients: number;
  acquiredClients: number;
  serviceRevenue: number;
  productRevenue: number;
  productsSold: number;
  averageTicket: number;
  noShowCount: number;
}

export async function manageBookingOutcome(input: ManageBookingOutcomeInput): Promise<ManageBookingOutcomeResult> {
  const callable = httpsCallable<ManageBookingOutcomeInput, ManageBookingOutcomeResult>(functions, "manageBookingOutcome");
  return (await callable(input)).data;
}

export async function listOperatorStats(salonId: string, fromDate?: string): Promise<OperatorStats[]> {
  const [bookingsSnap, salesSnap] = await Promise.all([
    getDocs(collection(db, `salons/${salonId}/bookings`)),
    getDocs(collection(db, `salons/${salonId}/sales`)),
  ]);
  const bookings = bookingsSnap.docs.map((item) => item.data() as Booking);
  const sales = salesSnap.docs.map((item) => item.data() as Sale).filter((sale) => sale.stato === "pagata");
  return calculateOperatorStats(bookings, sales, fromDate);
}

export function calculateOperatorStats(bookings: Booking[], sales: Sale[], fromDate?: string): OperatorStats[] {
  const paidSales = sales.filter((sale) => sale.stato === "pagata");
  const firstSaleByClient = new Map<string, Sale>();
  for (const sale of [...paidSales].sort((a, b) => a.date.localeCompare(b.date))) {
    if (sale.clientId && !firstSaleByClient.has(sale.clientId)) firstSaleByClient.set(sale.clientId, sale);
  }

  const rows = new Map<string, OperatorStats & { clients: Set<string> }>();
  const rowFor = (operatorId: string) => {
    const current = rows.get(operatorId) ?? {
      operatorId, bookingCount: 0, servedCount: 0, uniqueClients: 0, acquiredClients: 0,
      serviceRevenue: 0, productRevenue: 0, productsSold: 0, averageTicket: 0, noShowCount: 0,
      clients: new Set<string>(),
    };
    rows.set(operatorId, current);
    return current;
  };

  for (const booking of bookings) {
    if (fromDate && booking.date < fromDate) continue;
    if (["annullata", "rifiutata"].includes(booking.stato)) continue;
    const row = rowFor(booking.performedByOperatorId ?? booking.operatorId);
    row.bookingCount++;
    if (booking.stato === "no_show") row.noShowCount++;
  }

  for (const sale of paidSales) {
    if (fromDate && sale.date < fromDate) continue;
    const serviceOperators = new Set<string>();
    for (const item of sale.items ?? []) {
      const operatorId = item.tipo === "prodotto"
        ? item.soldByOperatorId ?? sale.performedByOperatorId
        : item.performedByOperatorId ?? sale.performedByOperatorId;
      if (!operatorId) continue;
      const row = rowFor(operatorId);
      if (item.tipo === "prodotto") {
        row.productRevenue += Number(item.totale) || 0;
        row.productsSold += Number(item.qta) || 0;
      } else {
        row.serviceRevenue += Number(item.totale) || 0;
        serviceOperators.add(operatorId);
      }
      if (sale.clientId) row.clients.add(sale.clientId);
    }
    for (const operatorId of serviceOperators) {
      const row = rowFor(operatorId);
      row.servedCount++;
      if (sale.clientId && firstSaleByClient.get(sale.clientId) === sale) row.acquiredClients++;
    }
  }

  return [...rows.values()].map(({ clients, ...row }) => ({
    ...row,
    uniqueClients: clients.size,
    averageTicket: row.servedCount > 0
      ? Math.round((row.serviceRevenue + row.productRevenue) / row.servedCount)
      : 0,
  }));
}
