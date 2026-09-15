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
  puntiAccreditati: number;
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
  cancelledCount: number;
  occupancyRate: number;
  recentTrend: number;
  dailyBookings: Array<{ date: string; count: number }>;
  topServices: Array<{ id: string; label: string; quantity: number; revenue: number }>;
  topProducts: Array<{ id: string; label: string; quantity: number; revenue: number }>;
}

export async function manageBookingOutcome(input: ManageBookingOutcomeInput): Promise<ManageBookingOutcomeResult> {
  const callable = httpsCallable<ManageBookingOutcomeInput, ManageBookingOutcomeResult>(functions, "manageBookingOutcome");
  return (await callable(input)).data;
}

export async function listOperatorStats(salonId: string, fromDate?: string, toDate?: string): Promise<OperatorStats[]> {
  const [bookingsSnap, salesSnap] = await Promise.all([
    getDocs(collection(db, `salons/${salonId}/bookings`)),
    getDocs(collection(db, `salons/${salonId}/sales`)),
  ]);
  const bookings = bookingsSnap.docs.map((item) => item.data() as Booking);
  const sales = salesSnap.docs.map((item) => item.data() as Sale).filter((sale) => sale.stato === "pagata");
  return calculateOperatorStats(bookings, sales, fromDate, toDate);
}

export function calculateOperatorStats(bookings: Booking[], sales: Sale[], fromDate?: string, toDate?: string): OperatorStats[] {
  const paidSales = sales.filter((sale) => sale.stato === "pagata");
  const firstSaleByClient = new Map<string, Sale>();
  for (const sale of [...paidSales].sort((a, b) => a.date.localeCompare(b.date))) {
    if (sale.clientId && !firstSaleByClient.has(sale.clientId)) firstSaleByClient.set(sale.clientId, sale);
  }

  const rows = new Map<string, OperatorStats & { clients: Set<string>; bookingDates: Map<string, number>; bookedMinutes: number; serviceRows: Map<string, { id: string; label: string; quantity: number; revenue: number }>; productRows: Map<string, { id: string; label: string; quantity: number; revenue: number }> }>();
  const rowFor = (operatorId: string) => {
    const current = rows.get(operatorId) ?? {
      operatorId, bookingCount: 0, servedCount: 0, uniqueClients: 0, acquiredClients: 0,
      serviceRevenue: 0, productRevenue: 0, productsSold: 0, averageTicket: 0, noShowCount: 0,
      cancelledCount: 0, occupancyRate: 0, recentTrend: 0, dailyBookings: [], topServices: [], topProducts: [],
      clients: new Set<string>(), bookingDates: new Map<string, number>(), bookedMinutes: 0, serviceRows: new Map(), productRows: new Map(),
    };
    rows.set(operatorId, current);
    return current;
  };

  for (const booking of bookings) {
    if ((fromDate && booking.date < fromDate) || (toDate && booking.date > toDate)) continue;
    const row = rowFor(booking.performedByOperatorId ?? booking.operatorId);
    if (["annullata", "rifiutata"].includes(booking.stato)) { row.cancelledCount++; continue; }
    row.bookingCount++;
    row.bookingDates.set(booking.date, (row.bookingDates.get(booking.date) ?? 0) + 1);
    if (booking.stato === "no_show") row.noShowCount++;
    else row.bookedMinutes += Math.max(0, booking.endMin - booking.startMin);
  }

  for (const sale of paidSales) {
    if ((fromDate && sale.date < fromDate) || (toDate && sale.date > toDate)) continue;
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
        const product = row.productRows.get(item.referenceId) ?? { id: item.referenceId, label: item.titolo, quantity: 0, revenue: 0 };
        product.quantity += Number(item.qta) || 0; product.revenue += Number(item.totale) || 0; row.productRows.set(item.referenceId, product);
      } else {
        row.serviceRevenue += Number(item.totale) || 0;
        serviceOperators.add(operatorId);
        const service = row.serviceRows.get(item.referenceId) ?? { id: item.referenceId, label: item.titolo, quantity: 0, revenue: 0 };
        service.quantity += Number(item.qta) || 0; service.revenue += Number(item.totale) || 0; row.serviceRows.set(item.referenceId, service);
      }
      if (sale.clientId) row.clients.add(sale.clientId);
    }
    for (const operatorId of serviceOperators) {
      const row = rowFor(operatorId);
      row.servedCount++;
      if (sale.clientId && firstSaleByClient.get(sale.clientId) === sale) row.acquiredClients++;
    }
  }

  const dateAt = (daysAgo: number) => { const date = new Date(); date.setDate(date.getDate() - daysAgo); return date.toISOString().slice(0, 10); };
  const effectiveFrom = fromDate ?? bookings.map((booking) => booking.date).sort()[0] ?? dateAt(29);
  const start = new Date(`${effectiveFrom}T12:00:00`); const end = toDate ? new Date(`${toDate}T12:00:00`) : new Date(); end.setHours(12, 0, 0, 0);
  let workingDays = 0; for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) if (![0, 1].includes(day.getDay())) workingDays++;
  return [...rows.values()].map(({ clients, bookingDates, bookedMinutes, serviceRows, productRows, ...row }) => {
    const dailyBookings = Array.from({ length: 14 }, (_, index) => {
      const date = dateAt(13 - index);
      return { date, count: bookingDates.get(date) ?? 0 };
    });
    const previous = dailyBookings.slice(0, 7).reduce((sum, item) => sum + item.count, 0);
    const recent = dailyBookings.slice(7).reduce((sum, item) => sum + item.count, 0);
    return {
      ...row,
      dailyBookings,
      recentTrend: previous ? Math.round(((recent - previous) / previous) * 100) : recent ? 100 : 0,
      occupancyRate: workingDays ? Math.min(100, Math.round((bookedMinutes / (workingDays * 10 * 60)) * 100)) : 0,
      uniqueClients: clients.size,
      topServices: [...serviceRows.values()].sort((a, b) => b.quantity - a.quantity),
      topProducts: [...productRows.values()].sort((a, b) => b.quantity - a.quantity),
      averageTicket: row.servedCount > 0
        ? Math.round((row.serviceRevenue + row.productRevenue) / row.servedCount)
        : 0,
    };
  });
}
