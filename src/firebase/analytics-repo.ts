import { collection, getDocs } from "firebase/firestore";
import type { Booking, RewardRedemption, Sale } from "../domain/models";
import { db } from "./app";

export interface RankedMetric {
  id: string;
  label: string;
  current: number;
  previous: number;
  trend: number;
  revenue: number;
}

export interface DemandCell {
  weekday: number;
  hour: number;
  count: number;
}

export interface RewardMetric {
  id: string;
  label: string;
  issued: number;
  used: number;
}

export interface SalonAnalytics {
  completedBookings: number;
  previousCompletedBookings: number;
  revenue: number;
  previousRevenue: number;
  averageTicket: number;
  noShowRate: number;
  services: RankedMetric[];
  products: RankedMetric[];
  demand: DemandCell[];
  rewards: RewardMetric[];
}

const isoOffset = (days: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

function trend(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export async function getSalonAnalytics(salonId: string): Promise<SalonAnalytics> {
  const [bookingsSnap, salesSnap, redemptionsSnap] = await Promise.all([
    getDocs(collection(db, `salons/${salonId}/bookings`)),
    getDocs(collection(db, `salons/${salonId}/sales`)),
    getDocs(collection(db, `salons/${salonId}/rewardRedemptions`)),
  ]);
  return calculateSalonAnalytics(
    bookingsSnap.docs.map((item) => item.data() as Booking),
    salesSnap.docs.map((item) => item.data() as Sale),
    redemptionsSnap.docs.map((item) => ({ id: item.id, ...item.data() } as RewardRedemption)),
  );
}

export function calculateSalonAnalytics(bookings: Booking[], sales: Sale[], redemptions: RewardRedemption[]): SalonAnalytics {
  const currentFrom = isoOffset(-29);
  const previousFrom = isoOffset(-59);
  const previousTo = isoOffset(-30);
  const paidSales = sales.filter((sale) => sale.stato === "pagata");
  const completed = bookings.filter((booking) => booking.stato === "completata");
  const currentBookings = completed.filter((booking) => booking.date >= currentFrom);
  const previousBookings = completed.filter((booking) => booking.date >= previousFrom && booking.date <= previousTo);
  const currentSales = paidSales.filter((sale) => sale.date >= currentFrom);
  const previousSales = paidSales.filter((sale) => sale.date >= previousFrom && sale.date <= previousTo);
  const currentRevenue = currentSales.reduce((sum, sale) => sum + sale.totale, 0);
  const previousRevenue = previousSales.reduce((sum, sale) => sum + sale.totale, 0);
  const recentBookings = bookings.filter((booking) => booking.date >= currentFrom && !["annullata", "rifiutata"].includes(booking.stato));
  const noShows = recentBookings.filter((booking) => booking.stato === "no_show").length;

  const rank = (type: "servizio" | "prodotto") => {
    const rows = new Map<string, Omit<RankedMetric, "trend">>();
    for (const sale of paidSales) {
      const period = sale.date >= currentFrom ? "current" : sale.date >= previousFrom && sale.date <= previousTo ? "previous" : null;
      if (!period) continue;
      for (const item of sale.items ?? []) {
        if (item.tipo !== type) continue;
        const row = rows.get(item.referenceId) ?? { id: item.referenceId, label: item.titolo, current: 0, previous: 0, revenue: 0 };
        row[period] += Number(item.qta) || 0;
        if (period === "current") row.revenue += Number(item.totale) || 0;
        rows.set(item.referenceId, row);
      }
    }
    return [...rows.values()].map((row) => ({ ...row, trend: trend(row.current, row.previous) })).sort((a, b) => b.current - a.current);
  };

  const demandMap = new Map<string, number>();
  for (const booking of completed.filter((item) => item.date >= isoOffset(-120))) {
    const weekday = new Date(`${booking.date}T12:00:00`).getDay();
    if (weekday === 0 || weekday === 1) continue;
    const hour = Math.floor(booking.startMin / 60);
    const key = `${weekday}-${hour}`;
    demandMap.set(key, (demandMap.get(key) ?? 0) + 1);
  }
  const demand = [2, 3, 4, 5, 6].flatMap((weekday) =>
    Array.from({ length: 10 }, (_, index) => ({ weekday, hour: index + 9, count: demandMap.get(`${weekday}-${index + 9}`) ?? 0 })),
  );

  const rewardRows = new Map<string, RewardMetric>();
  for (const redemption of redemptions) {
    const row = rewardRows.get(redemption.rewardId) ?? { id: redemption.rewardId, label: redemption.rewardNome, issued: 0, used: 0 };
    row.issued++;
    if (redemption.stato === "utilizzato") row.used++;
    rewardRows.set(redemption.rewardId, row);
  }

  return {
    completedBookings: currentBookings.length,
    previousCompletedBookings: previousBookings.length,
    revenue: currentRevenue,
    previousRevenue,
    averageTicket: currentSales.length ? Math.round(currentRevenue / currentSales.length) : 0,
    noShowRate: recentBookings.length ? Math.round((noShows / recentBookings.length) * 100) : 0,
    services: rank("servizio"),
    products: rank("prodotto"),
    demand,
    rewards: [...rewardRows.values()].sort((a, b) => b.used - a.used),
  };
}
