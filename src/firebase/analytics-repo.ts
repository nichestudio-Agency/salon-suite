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
  details: Array<{ date: string; client: string; quantity: number; revenue: number }>;
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
  averageDaysToUse: number;
}

export interface LoyaltyAnalytics {
  pointsIssued: number;
  pointsRedeemed: number;
  pointsCirculating: number;
  averageDaysToReward: number;
  bookingShare: number;
  favoriteWeekday: string;
  favoriteHour: string;
}

export interface SalonAnalytics {
  completedBookings: number;
  previousCompletedBookings: number;
  revenue: number;
  previousRevenue: number;
  averageTicket: number;
  noShowRate: number;
  occupancyRate: number;
  services: RankedMetric[];
  products: RankedMetric[];
  demand: DemandCell[];
  rewards: RewardMetric[];
  loyalty: LoyaltyAnalytics;
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

export async function getSalonAnalytics(salonId: string, periodDays = 30): Promise<SalonAnalytics> {
  const [bookingsSnap, salesSnap, redemptionsSnap, accountsSnap] = await Promise.all([
    getDocs(collection(db, `salons/${salonId}/bookings`)),
    getDocs(collection(db, `salons/${salonId}/sales`)),
    getDocs(collection(db, `salons/${salonId}/rewardRedemptions`)),
    getDocs(collection(db, `salons/${salonId}/loyaltyAccounts`)),
  ]);
  return calculateSalonAnalytics(
    bookingsSnap.docs.map((item) => item.data() as Booking),
    salesSnap.docs.map((item) => item.data() as Sale),
    redemptionsSnap.docs.map((item) => ({ id: item.id, ...item.data() } as RewardRedemption)),
    periodDays,
    accountsSnap.docs.map((item) => ({ clientId: item.id, ...item.data() } as { clientId: string; punti?: number; puntiTotali?: number; puntiRiscattati?: number })),
  );
}

export function calculateSalonAnalytics(bookings: Booking[], sales: Sale[], redemptions: RewardRedemption[], periodDays = 30, loyaltyAccounts: Array<{ clientId: string; punti?: number; puntiTotali?: number; puntiRiscattati?: number }> = []): SalonAnalytics {
  const currentFrom = isoOffset(-(periodDays - 1));
  const previousFrom = isoOffset(-(periodDays * 2 - 1));
  const previousTo = isoOffset(-periodDays);
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
        const row = rows.get(item.referenceId) ?? { id: item.referenceId, label: item.titolo, current: 0, previous: 0, revenue: 0, details: [] };
        row[period] += Number(item.qta) || 0;
        if (period === "current") {
          row.revenue += Number(item.totale) || 0;
          row.details.push({ date: sale.date, client: sale.clientNome || "Cliente al banco", quantity: Number(item.qta) || 0, revenue: Number(item.totale) || 0 });
        }
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

  const rewardRows = new Map<string, RewardMetric & { totalDays: number }>();
  const dateValue = (value: unknown) => { const raw = value as { toDate?: () => Date } | string | undefined; const date = typeof raw === "string" ? new Date(raw) : raw?.toDate?.(); return date && !Number.isNaN(date.getTime()) ? date : null; };
  for (const redemption of redemptions) {
    const row = rewardRows.get(redemption.rewardId) ?? { id: redemption.rewardId, label: redemption.rewardNome, issued: 0, used: 0, averageDaysToUse: 0, totalDays: 0 };
    row.issued++;
    if (redemption.stato === "utilizzato") {
      row.used++;
      const created = dateValue(redemption.createdAt); const used = dateValue(redemption.usedAt);
      if (created && used) row.totalDays += Math.max(0, Math.round((used.getTime() - created.getTime()) / 86_400_000));
    }
    rewardRows.set(redemption.rewardId, row);
  }
  const rewards = [...rewardRows.values()].map(({ totalDays, ...row }) => ({ ...row, averageDaysToUse: row.used ? Math.round(totalDays / row.used) : 0 })).sort((a, b) => b.used - a.used);

  const loyaltyIds = new Set(loyaltyAccounts.map((account) => account.clientId));
  const loyaltyBookings = currentBookings.filter((booking) => loyaltyIds.has(booking.clientId));
  const weekdayNames = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
  const loyaltyWeekdays = new Map<number, number>(); const loyaltyHours = new Map<number, number>();
  for (const booking of loyaltyBookings) { const weekday = new Date(`${booking.date}T12:00:00`).getDay(); const hour = Math.floor(booking.startMin / 60); loyaltyWeekdays.set(weekday, (loyaltyWeekdays.get(weekday) ?? 0) + 1); loyaltyHours.set(hour, (loyaltyHours.get(hour) ?? 0) + 1); }
  const favoriteWeekdayIndex = [...loyaltyWeekdays.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const favoriteHourValue = [...loyaltyHours.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const allUsedRewards = rewards.reduce((sum, reward) => sum + reward.used, 0);

  const activeOperators = new Set(currentBookings.map((booking) => booking.performedByOperatorId ?? booking.operatorId)).size || 1;
  const workingDays = Array.from({ length: periodDays }, (_, index) => new Date(`${isoOffset(-index)}T12:00:00`)).filter((date) => date.getDay() !== 0 && date.getDay() !== 1).length;
  const bookedMinutes = currentBookings.reduce((sum, booking) => sum + Math.max(0, booking.endMin - booking.startMin), 0);

  return {
    completedBookings: currentBookings.length,
    previousCompletedBookings: previousBookings.length,
    revenue: currentRevenue,
    previousRevenue,
    averageTicket: currentSales.length ? Math.round(currentRevenue / currentSales.length) : 0,
    noShowRate: recentBookings.length ? Math.round((noShows / recentBookings.length) * 100) : 0,
    occupancyRate: workingDays ? Math.min(100, Math.round((bookedMinutes / (workingDays * activeOperators * 10 * 60)) * 100)) : 0,
    services: rank("servizio"),
    products: rank("prodotto"),
    demand,
    rewards,
    loyalty: {
      pointsIssued: loyaltyAccounts.reduce((sum, account) => sum + (Number(account.puntiTotali) || 0), 0),
      pointsRedeemed: loyaltyAccounts.reduce((sum, account) => sum + (Number(account.puntiRiscattati) || 0), 0),
      pointsCirculating: loyaltyAccounts.reduce((sum, account) => sum + (Number(account.punti) || 0), 0),
      averageDaysToReward: allUsedRewards ? Math.round(rewards.reduce((sum, reward) => sum + reward.averageDaysToUse * reward.used, 0) / allUsedRewards) : 0,
      bookingShare: currentBookings.length ? Math.round((loyaltyBookings.length / currentBookings.length) * 100) : 0,
      favoriteWeekday: favoriteWeekdayIndex === undefined ? "—" : weekdayNames[favoriteWeekdayIndex],
      favoriteHour: favoriteHourValue === undefined ? "—" : `${String(favoriteHourValue).padStart(2, "0")}:00`,
    },
  };
}
