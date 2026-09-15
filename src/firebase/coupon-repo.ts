import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs,
} from "firebase/firestore";
import { db } from "./app";
import type { Coupon } from "../domain/models";

export type CouponWithId = Coupon & { id: string };
export interface CouponAnalytics {
  couponId: string;
  inviati: number;
  utilizzati: number;
  nonUtilizzati: number;
  scaduti: number;
  recipientIds: string[];
  usedClientIds: string[];
  redemptionSeries: Array<{ label: string; count: number }>;
  conversionRate: number;
  averageDaysToUse: number;
  usagePhases: { iniziale: number; centrale: number; finale: number };
  segments: string[];
  lastSentAt?: string;
  usedAtByClient: Record<string, string>;
}

const dateFromValue = (value: unknown): Date | null => { const raw = value as { toDate?: () => Date } | string | undefined; const date = typeof raw === "string" ? new Date(raw) : raw?.toDate?.(); return date && !Number.isNaN(date.getTime()) ? date : null; };

const couponsCol = (salonId: string) =>
  collection(db, "salons", salonId, "coupons");

export async function listCoupons(salonId: string): Promise<CouponWithId[]> {
  const snap = await getDocs(couponsCol(salonId));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Coupon) }));
}

export async function createCoupon(salonId: string, data: Coupon): Promise<string> {
  const ref = await addDoc(couponsCol(salonId), { ...data, codice: data.codice.trim().toUpperCase() });
  return ref.id;
}

export async function updateCoupon(
  salonId: string, id: string, data: Partial<Coupon>
): Promise<void> {
  await updateDoc(doc(db, "salons", salonId, "coupons", id), {
    ...data,
    ...(data.codice ? { codice: data.codice.trim().toUpperCase() } : {}),
  });
}

export async function getCouponAnalytics(
  salonId: string,
  coupons: CouponWithId[],
): Promise<CouponAnalytics[]> {
  const [campaignsSnap, redemptionsSnap] = await Promise.all([
    getDocs(collection(db, "salons", salonId, "campaigns")),
    getDocs(collection(db, "salons", salonId, "couponRedemptions")),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  return coupons.map((coupon) => {
    const recipients = new Set<string>();
    const campaignDates: Date[] = [];
    const segments = new Set<string>();
    let legacyRecipients = 0;
    for (const campaignDoc of campaignsSnap.docs) {
      const campaign = campaignDoc.data();
      if (campaign.couponId !== coupon.id) continue;
      const sentDate = dateFromValue(campaign.sentAt);
      if (sentDate) campaignDates.push(sentDate);
      const filters = (campaign.filtri ?? {}) as Record<string, unknown>;
      if (Array.isArray(filters.recipientIds) && filters.recipientIds.length) segments.add("Selezione manuale");
      if (filters.bookingInactiveDays) segments.add("Clienti inattivi");
      if (filters.productInactiveDays) segments.add("Acquisti inattivi");
      if (filters.sesso) segments.add(`Target ${String(filters.sesso)}`);
      if (!Object.keys(filters).length) segments.add("Tutti i clienti");
      if (Array.isArray(campaign.recipientIds)) {
        campaign.recipientIds.forEach((id: unknown) => {
          if (typeof id === "string") recipients.add(id);
        });
      } else {
        legacyRecipients += Number(campaign.recipientCount) || 0;
      }
    }
    const usedClients = new Set<string>();
    const usedAtByClient: Record<string, string> = {};
    const redemptionDates: Date[] = [];
    for (const redemptionDoc of redemptionsSnap.docs) {
      const redemption = redemptionDoc.data();
      if (redemption.couponId === coupon.id && typeof redemption.clientId === "string") {
        usedClients.add(redemption.clientId);
        const date = dateFromValue(redemption.redeemedAt);
        if (date && !Number.isNaN(date.getTime())) redemptionDates.push(date);
        if (date) usedAtByClient[redemption.clientId] = date.toISOString();
      }
    }
    const inviati = recipients.size + legacyRecipients;
    const utilizzati = usedClients.size;
    const nonUtilizzati = Math.max(inviati - utilizzati, 0);
    const expired = (coupon.scadenza && coupon.scadenza < today)
      || (coupon.dataAppuntamento && coupon.dataAppuntamento < today);
    const redemptionSeries = Array.from({ length: 8 }, (_, index) => {
      const endDaysAgo = (7 - index) * 7;
      const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - endDaysAgo - 6);
      const end = new Date(); end.setHours(23, 59, 59, 999); end.setDate(end.getDate() - endDaysAgo);
      return { label: `${start.getDate()}/${start.getMonth() + 1}`, count: redemptionDates.filter((date) => date >= start && date <= end).length };
    });
    const sentAt = campaignDates.sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    const expiresAt = coupon.scadenza ? new Date(`${coupon.scadenza}T23:59:59`) : coupon.dataAppuntamento ? new Date(`${coupon.dataAppuntamento}T23:59:59`) : new Date();
    const totalWindow = sentAt ? Math.max(1, expiresAt.getTime() - sentAt.getTime()) : 1;
    const usagePhases = { iniziale: 0, centrale: 0, finale: 0 };
    let totalDaysToUse = 0;
    for (const date of redemptionDates) {
      if (!sentAt) continue;
      const elapsed = Math.max(0, date.getTime() - sentAt.getTime()); totalDaysToUse += elapsed / 86_400_000;
      const ratio = Math.min(1, elapsed / totalWindow);
      if (ratio <= 1 / 3) usagePhases.iniziale++; else if (ratio <= 2 / 3) usagePhases.centrale++; else usagePhases.finale++;
    }
    return {
      couponId: coupon.id,
      inviati,
      utilizzati,
      nonUtilizzati,
      scaduti: expired ? nonUtilizzati : 0,
      recipientIds: [...recipients],
      usedClientIds: [...usedClients],
      redemptionSeries,
      conversionRate: inviati ? Math.round((utilizzati / inviati) * 100) : 0,
      averageDaysToUse: redemptionDates.length && sentAt ? Math.round(totalDaysToUse / redemptionDates.length) : 0,
      usagePhases,
      segments: [...segments],
      ...(campaignDates.length ? { lastSentAt: campaignDates.sort((a, b) => b.getTime() - a.getTime())[0].toISOString() } : {}),
      usedAtByClient,
    };
  });
}

export async function deleteCoupon(salonId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "salons", salonId, "coupons", id));
}
